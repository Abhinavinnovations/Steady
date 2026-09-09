import { z } from "zod";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { sendEmail, emailShell } from "../services/email";

/**
 * Challenge accountability contact: any email address (not an app account)
 * that gets told when the owner misses a day. The contact must be verified
 * with a 6-digit code so nobody can point alerts at a stranger.
 */

const CODE_TTL_MS = 30 * 60 * 1000;

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getContact(userId: string) {
  const [c] = await db
    .select()
    .from(schema.accountabilityContacts)
    .where(eq(schema.accountabilityContacts.userId, userId));
  return c ?? null;
}

async function sendVerifyEmail(to: string, ownerName: string, code: string) {
  await sendEmail({
    to,
    subject: `Verify: be ${ownerName}'s accountability contact`,
    text: `${ownerName} wants you as their accountability contact on Steady — you'll get an email when they miss a day. Their verification code is ${code}. Share it with them to confirm. Expires in 30 minutes.`,
    html: emailShell(
      "Someone wants you to keep them honest",
      `<p style="margin:0 0 12px;font-size:14px;color:#3a3a44;line-height:1.6;"><strong>${ownerName}</strong> wants you as their accountability contact on Steady. If they miss a day of their commitments, you'll get an email.</p>
       <p style="margin:0 0 12px;font-size:14px;color:#3a3a44;line-height:1.6;">Give them this code to confirm:</p>
       <p style="margin:0 0 12px;font-size:28px;letter-spacing:6px;font-weight:700;color:#17171f;">${code}</p>
       <p style="margin:0;font-size:12px;color:#8e8e9a;">Expires in 30 minutes. Didn't expect this? Just ignore it.</p>`,
    ),
  });
}

export const accountability = {
  /** Current contact state: null, pending verification, or verified. */
  get: authed.handler(async ({ context }) => {
    const c = await getContact(context.user.id);
    if (!c) return null;
    return {
      email: c.email,
      verified: !!c.verifiedAt,
      verifiedAt: c.verifiedAt,
      codeExpired:
        !c.verifiedAt &&
        (!c.verifyExpiresAt || c.verifyExpiresAt.getTime() < Date.now()),
    };
  }),

  /** Set (or replace) the contact email — sends a 6-digit code to that address. */
  set: authed
    .input(z.object({ email: z.string().trim().toLowerCase().email().max(120) }))
    .handler(async ({ context, input }) => {
      const [p] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, context.user.id));
      if (!p?.onboardedAt)
        throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
      if (input.email === context.user.email.toLowerCase())
        throw new ORPCError("BAD_REQUEST", {
          message: "Pick someone else — alerts to yourself don't keep you honest",
        });

      const code = makeCode();
      const expires = new Date(Date.now() + CODE_TTL_MS);
      const existing = await getContact(context.user.id);
      if (existing) {
        await db
          .update(schema.accountabilityContacts)
          .set({
            email: input.email,
            verifyCode: code,
            verifyExpiresAt: expires,
            verifiedAt: null,
          })
          .where(eq(schema.accountabilityContacts.id, existing.id));
      } else {
        await db.insert(schema.accountabilityContacts).values({
          userId: context.user.id,
          email: input.email,
          verifyCode: code,
          verifyExpiresAt: expires,
        });
      }
      await sendVerifyEmail(
        input.email,
        p.displayName || context.user.name || "A friend",
        code,
      );
      return { ok: true, email: input.email };
    }),

  /** Confirm the 6-digit code the contact received. */
  verify: authed
    .input(z.object({ code: z.string().trim().length(6) }))
    .handler(async ({ context, input }) => {
      const c = await getContact(context.user.id);
      if (!c)
        throw new ORPCError("NOT_FOUND", { message: "No contact set yet" });
      if (c.verifiedAt) return { ok: true, alreadyVerified: true };
      if (!c.verifyCode || !c.verifyExpiresAt)
        throw new ORPCError("BAD_REQUEST", { message: "Request a new code" });
      if (c.verifyExpiresAt.getTime() < Date.now())
        throw new ORPCError("BAD_REQUEST", {
          message: "Code expired — send a new one",
        });
      if (c.verifyCode !== input.code)
        throw new ORPCError("BAD_REQUEST", { message: "Wrong code" });
      await db
        .update(schema.accountabilityContacts)
        .set({ verifiedAt: new Date(), verifyCode: null, verifyExpiresAt: null })
        .where(eq(schema.accountabilityContacts.id, c.id));
      return { ok: true };
    }),

  /** Resend the code to the same address. */
  resend: authed.handler(async ({ context }) => {
    const c = await getContact(context.user.id);
    if (!c) throw new ORPCError("NOT_FOUND", { message: "No contact set yet" });
    if (c.verifiedAt) return { ok: true, alreadyVerified: true };
    const [p] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, context.user.id));
    const code = makeCode();
    await db
      .update(schema.accountabilityContacts)
      .set({ verifyCode: code, verifyExpiresAt: new Date(Date.now() + CODE_TTL_MS) })
      .where(eq(schema.accountabilityContacts.id, c.id));
    await sendVerifyEmail(
      c.email,
      p?.displayName || context.user.name || "A friend",
      code,
    );
    return { ok: true };
  }),

  /** Remove the contact — alerts stop. */
  remove: authed.handler(async ({ context }) => {
    await db
      .delete(schema.accountabilityContacts)
      .where(eq(schema.accountabilityContacts.userId, context.user.id));
    return { ok: true };
  }),
};
