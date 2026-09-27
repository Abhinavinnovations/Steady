import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { randomUUID } from "node:crypto";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, localMonth, shiftDay } from "../lib/dates";
import { computeDayStatuses, activeStreak } from "../lib/streak";
import { sendEmail, emailShell, escapeHtml } from "../services/email";

import { deliverInvitation, invitationStatus } from "../services/invitation-delivery";
import { CONSENT_VERSION, contactEmailState, decidePartner, isSuppressed, recipientFlowEnabled, recipientKey } from "../services/recipient-consent";

/**
 * High-level status only — this is the privacy boundary.
 * A partner NEVER sees task titles, notes, or task counts, and only
 * CHALLENGE tasks count here — basic tasks stay fully private.
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
  const { statuses } = await computeDayStatuses(
    ownerId,
    p.timezone,
    400,
    "challenge",
  );

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
        emailState: await contactEmailState(row),
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
            emailState: await contactEmailState(outgoing),
            accountLinked: !!outgoing.partnerUserId,
            delivery: await invitationStatus(outgoing.id),
          }
        : null,
      incoming,
      watching,
    };
  }),

  /** Invite one accountability contact by email. Verified email required. */
  invite: authed
    .input(z.object({ email: z.string().trim().toLowerCase().email().max(254), requestId: z.string().uuid().optional() }))
    .handler(async ({ context, input }) => {
      requireVerified(context.user);

      const [p] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, context.user.id));
      if (!p?.onboardedAt)
        throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
      if (input.email === context.user.email.toLowerCase())
        throw new ORPCError("BAD_REQUEST", {
          message: "You can't be your own accountability contact",
        });

      const row = await db.transaction(async tx => {
        if (recipientFlowEnabled() && await isSuppressed(recipientKey(context.user.id, input.email), tx))
          throw new ORPCError("FORBIDDEN", { message: "This contact has stopped emails from you. Choose someone else." });
        const [existing] = await tx.select().from(schema.partners).where(eq(schema.partners.ownerId, context.user.id));
        // A lost invite response retries the same relationship, never recreates it.
        if (existing && input.requestId && existing.inviteToken === input.requestId && existing.partnerEmail === input.email) return existing;
        if (existing && existing.status !== "declined") throw new ORPCError("CONFLICT", { message: "One accountability contact at a time — check the existing invitation first" });
        if (existing) await tx.delete(schema.partners).where(eq(schema.partners.id, existing.id));
        const [created] = await tx.insert(schema.partners).values({ ownerId: context.user.id, partnerEmail: input.email, inviteToken: input.requestId ?? randomUUID() }).returning();
        return created;
      });
      const delivery = row.status === "invited" ? await deliverInvitation(context.user.id, row.id, row.inviteToken) : await invitationStatus(row.id);
      return { id: row.id, partnerEmail: row.partnerEmail, status: row.status, delivery };
    }),

  resend: authed.input(z.object({ partnerId: z.number().int(), requestId: z.string().uuid() })).handler(async ({ context, input }) => {
    requireVerified(context.user);
    return { delivery: await deliverInvitation(context.user.id, input.partnerId, input.requestId) };
  }),

  /** Accept or decline an invite addressed to my email. Verified account required. */
  respond: authed
    .input(z.object({ partnerId: z.number(), accept: z.boolean(), consentVersion: z.literal(CONSENT_VERSION).optional() }))
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

      const updated = await db.transaction(async tx => {
        const [fresh] = await tx.select().from(schema.partners).where(eq(schema.partners.id, row.id));
        if (!fresh) throw new ORPCError("NOT_FOUND");
        return decidePartner(tx, fresh, input.accept, input.consentVersion === CONSENT_VERSION, context.user.id);
      });

      if (input.accept) {
        const [owner] = await db
          .select({ email: schema.user.email })
          .from(schema.user)
          .where(eq(schema.user.id, row.ownerId));
        if (owner) {
          void sendEmail({
            to: owner.email,
            subject: "Your accountability contact accepted",
            text: `${context.user.name || context.user.email} accepted your Steady invite. They can see your high-level progress. Email alerts require their separate consent.`,
            html: emailShell(
              "Accountability contact accepted",
              `<p style="margin:0;font-size:14px;color:#44444f;line-height:1.6;"><b>${escapeHtml(context.user.name || context.user.email)}</b> accepted. They'll see your streak and daily status — never your tasks or notes. Show up.</p>`,
            ),
          });
        }
      }
      return { status: updated.status };
    }),

  stopEmails: authed.input(z.object({ partnerId: z.number().int() })).handler(async ({ context, input }) => {
    requireVerified(context.user);
    if (!recipientFlowEnabled()) throw new ORPCError("FORBIDDEN", { message: "Email preferences are temporarily unavailable." });
    return db.transaction(async tx => {
      const [row] = await tx.select().from(schema.partners).where(and(eq(schema.partners.id, input.partnerId), eq(schema.partners.partnerEmail, context.user.email.toLowerCase())));
      if (!row) throw new ORPCError("NOT_FOUND");
      await tx.insert(schema.recipientSuppressions).values({ recipientKey: recipientKey(row.ownerId, row.partnerEmail), stoppedAt: new Date() }).onConflictDoNothing();
      return { ok: true };
    });
  }),

  /** Owner removes their partner / cancels a pending invite. */
  remove: authed.handler(async ({ context }) => {
    const res = await db
      .delete(schema.partners)
      .where(eq(schema.partners.ownerId, context.user.id))
      .returning({ id: schema.partners.id });
    if (res.length === 0)
      throw new ORPCError("NOT_FOUND", { message: "No accountability contact to remove" });
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
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Accountability contact not found" });

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
          subject: "A gentle nudge from your accountability contact",
          text: `${context.user.name || "Your accountability contact"} noticed you missed yesterday. Fresh start today — one task, one line.`,
          html: emailShell(
            "Fresh start today",
            `<p style="margin:0;font-size:14px;color:#44444f;line-height:1.6;"><b>${escapeHtml(context.user.name || "Your accountability contact")}</b> noticed yesterday slipped. No guilt — just do one thing today and write one line.</p>`,
          ),
        });
      }
      return { ok: true };
    }),
};
