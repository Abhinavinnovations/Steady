import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, localMonth, shiftDay } from "../lib/dates";
import { computeDayStatuses, activeStreak } from "../lib/streak";
import { sendEmail, emailShell } from "../services/email";

const appUrl = () => process.env.WEBSITE_URL ?? "";

/**
 * High-level status only — this is the privacy boundary.
 * A partner NEVER sees task titles, notes, or task counts.
 */
async function highLevelStatus(ownerId: string) {
  const [p] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, ownerId));
  if (!p) return null;

  const today = localDate(p.timezone);
  const month = localMonth(p.timezone);
  const yesterday = shiftDay(today, -1);
  const { statuses } = await computeDayStatuses(ownerId, p.timezone);

  let complete = 0;
  let missed = 0;
  for (const [d, s] of statuses) {
    if (!d.startsWith(month)) continue;
    if (s === "complete") complete++;
    else if (s === "missed") missed++;
  }
  const tracked = complete + missed;

  return {
    displayName: p.displayName,
    streak: activeStreak(today, statuses),
    todayStatus: statuses.get(today) ?? "rest",
    consistency: tracked > 0 ? Math.round((complete / tracked) * 100) : null,
    missedYesterday: statuses.get(yesterday) === "missed",
    yesterday,
  };
}

function requireVerified(user: { emailVerified: boolean }) {
  if (!user.emailVerified)
    throw new ORPCError("FORBIDDEN", {
      message: "Verify your email first — one verified account per person.",
    });
}

export const partners = {
  /** Everything the Partner screen needs in one call. */
  get: authed.handler(async ({ context }) => {
    const myEmail = context.user.email.toLowerCase();

    const [outgoing] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.ownerId, context.user.id));

    // Invites addressed to my email, still pending
    const incomingRows = await db
      .select({
        id: schema.partners.id,
        ownerId: schema.partners.ownerId,
        status: schema.partners.status,
        partnerEmail: schema.partners.partnerEmail,
      })
      .from(schema.partners)
      .where(
        and(
          eq(schema.partners.partnerEmail, myEmail),
          eq(schema.partners.status, "invited"),
        ),
      );
    const incoming = [];
    for (const row of incomingRows) {
      const [op] = await db
        .select({ displayName: schema.profiles.displayName })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, row.ownerId));
      incoming.push({ id: row.id, ownerName: op?.displayName ?? "Someone" });
    }

    // People I hold accountable (I accepted their invite)
    const watchingRows = await db
      .select()
      .from(schema.partners)
      .where(
        and(
          eq(schema.partners.partnerUserId, context.user.id),
          eq(schema.partners.status, "accepted"),
        ),
      );
    const watching = [];
    for (const row of watchingRows) {
      const status = await highLevelStatus(row.ownerId);
      if (!status) continue;
      const [nudged] = await db
        .select({ id: schema.nudges.id })
        .from(schema.nudges)
        .where(
          and(
            eq(schema.nudges.partnerId, row.id),
            eq(schema.nudges.missedDate, status.yesterday),
          ),
        );
      watching.push({
        partnerId: row.id,
        ...status,
        canNudge: status.missedYesterday && !nudged,
      });
    }

    return {
      emailVerified: context.user.emailVerified,
      outgoing: outgoing
        ? {
            id: outgoing.id,
            partnerEmail: outgoing.partnerEmail,
            status: outgoing.status,
            createdAt: outgoing.createdAt,
          }
        : null,
      incoming,
      watching,
    };
  }),

  /** Invite one accountability partner by email. Challenge mode + verified email required. */
  invite: authed
    .input(z.object({ email: z.string().trim().toLowerCase().email().max(254) }))
    .handler(async ({ context, input }) => {
      requireVerified(context.user);

      const [p] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, context.user.id));
      if (!p?.onboardedAt)
        throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
      if (p.mode !== "challenge")
        throw new ORPCError("FORBIDDEN", {
          message: "Switch to Challenge mode to add a partner",
        });
      if (input.email === context.user.email.toLowerCase())
        throw new ORPCError("BAD_REQUEST", {
          message: "You can't be your own partner",
        });

      const [existing] = await db
        .select()
        .from(schema.partners)
        .where(eq(schema.partners.ownerId, context.user.id));
      if (existing && existing.status !== "declined")
        throw new ORPCError("CONFLICT", {
          message: "One partner at a time — remove the current one first",
        });
      if (existing) {
        await db.delete(schema.partners).where(eq(schema.partners.id, existing.id));
      }

      const [row] = await db
        .insert(schema.partners)
        .values({
          ownerId: context.user.id,
          partnerEmail: input.email,
          inviteToken: randomUUID(),
        })
        .returning();

      // Best-effort email; the invite is also visible in-app when they sign in.
      void sendEmail({
        to: input.email,
        subject: `${p.displayName} wants you as their accountability partner`,
        text: `${p.displayName} is building a daily habit on Steady and asked you to keep them honest. Sign in with this email address to accept: ${appUrl()}`,
        html: emailShell(
          `${p.displayName} asked you to keep them honest`,
          `<p style="margin:0 0 20px;font-size:14px;color:#44444f;line-height:1.6;">They're committing to daily tasks on Steady. If you accept, you'll see only their high-level progress — a streak and a daily done/missed — never their tasks or notes. Nothing is shared until you accept.</p>
           <a href="${appUrl()}" style="display:inline-block;background:#6C63FF;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:14px;">Open Steady</a>
           <p style="margin:16px 0 0;font-size:12px;color:#8e8e9a;">Sign in with ${input.email} to see the invite.</p>`,
        ),
      });

      return { id: row.id, partnerEmail: row.partnerEmail, status: row.status };
    }),

  /** Accept or decline an invite addressed to my email. Verified account required. */
  respond: authed
    .input(z.object({ partnerId: z.number(), accept: z.boolean() }))
    .handler(async ({ context, input }) => {
      requireVerified(context.user);
      const [row] = await db
        .select()
        .from(schema.partners)
        .where(eq(schema.partners.id, input.partnerId));
      if (!row || row.partnerEmail !== context.user.email.toLowerCase())
        throw new ORPCError("NOT_FOUND", { message: "Invite not found" });
      if (row.status !== "invited")
        throw new ORPCError("CONFLICT", { message: "Invite already answered" });

      const [updated] = await db
        .update(schema.partners)
        .set({
          status: input.accept ? "accepted" : "declined",
          partnerUserId: input.accept ? context.user.id : null,
          respondedAt: new Date(),
        })
        .where(eq(schema.partners.id, row.id))
        .returning();

      if (input.accept) {
        const [owner] = await db
          .select({ email: schema.user.email })
          .from(schema.user)
          .where(eq(schema.user.id, row.ownerId));
        if (owner) {
          void sendEmail({
            to: owner.email,
            subject: "Your accountability partner accepted",
            text: `${context.user.name || context.user.email} accepted your Steady invite. They now see your high-level progress.`,
            html: emailShell(
              "Partner locked in",
              `<p style="margin:0;font-size:14px;color:#44444f;line-height:1.6;"><b>${context.user.name || context.user.email}</b> accepted. They'll see your streak and daily status — never your tasks or notes. Show up.</p>`,
            ),
          });
        }
      }
      return { status: updated.status };
    }),

  /** Owner removes their partner / cancels a pending invite. */
  remove: authed.handler(async ({ context }) => {
    const res = await db
      .delete(schema.partners)
      .where(eq(schema.partners.ownerId, context.user.id))
      .returning({ id: schema.partners.id });
    if (res.length === 0)
      throw new ORPCError("NOT_FOUND", { message: "No partner to remove" });
    return { ok: true };
  }),

  /** Gentle nudge — only when they missed yesterday, max one per missed day. */
  nudge: authed
    .input(z.object({ partnerId: z.number() }))
    .handler(async ({ context, input }) => {
      const [row] = await db
        .select()
        .from(schema.partners)
        .where(
          and(
            eq(schema.partners.id, input.partnerId),
            eq(schema.partners.partnerUserId, context.user.id),
            eq(schema.partners.status, "accepted"),
          ),
        );
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Partner not found" });

      const status = await highLevelStatus(row.ownerId);
      if (!status?.missedYesterday)
        throw new ORPCError("BAD_REQUEST", {
          message: "They didn't miss yesterday — no nudge needed",
        });

      const [dup] = await db
        .select({ id: schema.nudges.id })
        .from(schema.nudges)
        .where(
          and(
            eq(schema.nudges.partnerId, row.id),
            eq(schema.nudges.missedDate, status.yesterday),
          ),
        );
      if (dup)
        throw new ORPCError("CONFLICT", { message: "Already nudged for that day" });

      await db
        .insert(schema.nudges)
        .values({ partnerId: row.id, missedDate: status.yesterday });

      const [owner] = await db
        .select({ email: schema.user.email })
        .from(schema.user)
        .where(eq(schema.user.id, row.ownerId));
      if (owner) {
        void sendEmail({
          to: owner.email,
          subject: "A gentle nudge from your partner",
          text: `${context.user.name || "Your partner"} noticed you missed yesterday. Fresh start today — one task, one line.`,
          html: emailShell(
            "Fresh start today",
            `<p style="margin:0;font-size:14px;color:#44444f;line-height:1.6;"><b>${context.user.name || "Your partner"}</b> noticed yesterday slipped. No guilt — just do one thing today and write one line.</p>`,
          ),
        });
      }
      return { ok: true };
    }),
};
