import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { emailConfigured, sendEmail, type SendEmailOptions } from "./email";
import { canReplayEmail, emailProvider } from "./email-config";
import { createRecipientLink, isSuppressed, recipientBaseUrl, recipientFlowEnabled, recipientKey } from "./recipient-consent";
import { freezePayload, thawPayload } from "./invitation-payload";

type Attempt = typeof s.invitationDeliveries.$inferSelect;
export type DeliveryStatus = { outcome: "accepted" | "failed" | "unknown" | "sending"; code: string; updatedAt: Date | null; retryAt: Date | null };
const enabled = () => process.env.INVITATION_DELIVERY_ENABLED === "true";
function mayReplay(a: Attempt) {
  try { return canReplayEmail(thawPayload(a.payload).provider ?? "resend"); }
  catch { return false; }
}
function view(a: Attempt): DeliveryStatus {
  const expiredLease = a.outcome === "sending" && a.leaseUntil.getTime() <= Date.now();
  const uncertain = a.outcome === "unknown" || expiredLease;
  const manual = uncertain && (!mayReplay(a) || Date.now() - a.createdAt.getTime() >= 23 * 60 * 60_000);
  return { outcome: uncertain ? "unknown" : a.outcome,
    code: manual ? "manual_provider_check_required" : expiredLease ? "provider_unconfirmed" : a.code,
    updatedAt: a.updatedAt,
    retryAt: manual ? null : new Date(Math.max(a.createdAt.getTime() + 60_000, a.leaseUntil.getTime())) };
}
const unavailable = (): DeliveryStatus => ({ outcome: "failed", code: "delivery_not_configured", updatedAt: null, retryAt: null });

export async function invitationStatus(partnerId: number): Promise<DeliveryStatus> {
  if (!enabled()) return { ...unavailable(), outcome: "unknown" };
  const [a] = await db.select().from(s.invitationDeliveries).where(eq(s.invitationDeliveries.partnerId, partnerId)).orderBy(desc(s.invitationDeliveries.createdAt)).limit(1);
  return a ? view(a) : { outcome: "unknown", code: "legacy_unknown", updatedAt: null, retryAt: null };
}
function invitationPayload(name: string, to: string, link: string, stop: string): SendEmailOptions {
  return {
    provider: emailProvider() ?? undefined,
    from: process.env.EMAIL_FROM!.trim(), to,
    subject: `${name.replace(/[\r\n]/g, " ").slice(0, 100)} invited you on Steady`,
    text: `${name} invited you to be their accountability contact on Steady.\n\nReview and accept or decline: ${link}\n\nNo account or app needed. The invitation expires in 7 days. Opening it does not accept it.\n\nIf you accept, Steady may email you when they miss a future Challenge day, at most once per missed day. Task names, notes and Basic tasks stay private.\n\nNot interested? Ignore this invitation, or stop invitations and alerts from this person: ${stop}\n\nSteady`,
  };
}

/** Claim in a write transaction; send outside it. Unknown attempts replay the exact payload/key. */
export async function deliverInvitation(ownerId: string, partnerId: number, requestId: string): Promise<DeliveryStatus> {
  // Ownership and pending state are enforced even when delivery is disabled.
  const [owned] = await db.select().from(s.partners).where(and(eq(s.partners.id, partnerId), eq(s.partners.ownerId, ownerId)));
  if (!owned) throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
  if (owned.status !== "invited") throw new ORPCError("CONFLICT", { message: "Only pending invitations can be resent" });
  if (!enabled() || !recipientFlowEnabled()) return unavailable();
  const claim = await db.transaction(async tx => {
    const [row] = await tx.select().from(s.partners).where(and(eq(s.partners.id, partnerId), eq(s.partners.ownerId, ownerId)));
    if (!row || row.status !== "invited") throw new ORPCError("CONFLICT", { message: "Invitation is no longer pending" });
    if (await isSuppressed(recipientKey(row.ownerId, row.partnerEmail), tx)) throw new ORPCError("FORBIDDEN", { message: "This contact has stopped emails from you. Choose someone else." });
    const [same] = await tx.select().from(s.invitationDeliveries).where(eq(s.invitationDeliveries.id, requestId));
    if (same && same.partnerId !== partnerId) throw new ORPCError("CONFLICT", { message: "Use a new invitation attempt ID" });
    const [latest] = await tx.select().from(s.invitationDeliveries).where(eq(s.invitationDeliveries.partnerId, partnerId)).orderBy(desc(s.invitationDeliveries.createdAt)).limit(1);
    const now = new Date();
    if (same && (same.outcome === "accepted" || same.outcome === "failed")) return { status: view(same) };
    if (latest?.outcome === "sending" && latest.leaseUntil > now) return { status: view(latest) };
    const uncertain = latest && (latest.outcome === "unknown" || latest.outcome === "sending") ? latest : undefined;
    if (uncertain) {
      // Gmail SMTP has no idempotent replay. Provider changes also require manual review.
      // Resend retains keys for 24h; stop short of expiry rather than risk duplicates.
      if (!mayReplay(uncertain) || now.getTime() - uncertain.createdAt.getTime() >= 23 * 60 * 60_000) return { status: { ...view(uncertain), outcome: "unknown" as const, code: "manual_provider_check_required", retryAt: null } };
      const [retry] = await tx.update(s.invitationDeliveries).set({ outcome: "sending", leaseUntil: new Date(now.getTime() + 30_000), updatedAt: now }).where(eq(s.invitationDeliveries.id, uncertain.id)).returning();
      return { attempt: retry, replayingUnknown: true };
    }
    if (latest && now.getTime() - latest.createdAt.getTime() < 60_000) throw new ORPCError("TOO_MANY_REQUESTS", { message: "Wait one minute before resending this invitation" });
    const [profile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, ownerId));
    const configured = !!recipientBaseUrl() && emailConfigured() && !!process.env.BETTER_AUTH_SECRET;
    const payload = configured ? invitationPayload(profile?.displayName || "Someone", row.partnerEmail,
      await createRecipientLink(tx, row, "invite", now), await createRecipientLink(tx, row, "stop", now)) : null;
    const [attempt] = await tx.insert(s.invitationDeliveries).values({ id: requestId, partnerId, payload: payload ? freezePayload(payload) : "{}", outcome: payload ? "sending" : "failed", code: payload ? "sending" : "sender_or_link_not_configured", leaseUntil: new Date(now.getTime() + (payload ? 30_000 : 0)), createdAt: now, updatedAt: now }).returning();
    return payload ? { attempt } : { status: view(attempt) };
  });
  if (claim.status) return claim.status;
  const a = claim.attempt!;
  // Recheck cancellation/opt-out just before transport. Already in-flight SMTP cannot be recalled.
  const [currentPartner] = await db.select().from(s.partners).where(eq(s.partners.id, partnerId));
  const blocked = !currentPartner || currentPartner.status !== "invited" || await isSuppressed(recipientKey(ownerId, owned.partnerEmail));
  const response = blocked ? { outcome: "failed" as const, providerId: null, code: "recipient_unavailable" }
    : await sendEmail({ ...thawPayload(a.payload), idempotencyKey: `steady-invite/${a.id}` });
  // A rejected retry cannot prove that an earlier uncertain request was never sent.
  const result = claim.replayingUnknown && response.outcome === "failed"
    ? { outcome: "unknown" as const, providerId: null, code: "retry_failed_delivery_unconfirmed" }
    : response;
  const [updated] = await db.update(s.invitationDeliveries).set({ ...result, updatedAt: new Date(), leaseUntil: new Date() }).where(and(eq(s.invitationDeliveries.id, a.id), eq(s.invitationDeliveries.outcome, "sending"), eq(s.invitationDeliveries.leaseUntil, a.leaseUntil))).returning();
  if (updated) return view(updated);
  // A newer claim/result wins; a delayed response must not overwrite it.
  const [current] = await db.select().from(s.invitationDeliveries).where(eq(s.invitationDeliveries.id, a.id));
  return current ? view(current) : { outcome: result.outcome, code: result.code, updatedAt: new Date(), retryAt: null };
}
