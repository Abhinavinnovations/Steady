import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { localDate, shiftDay } from "../lib/dates";

type Writer = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<typeof db, "select">;
export const CONSENT_VERSION = "challenge-email-v1";
export const recipientFlowEnabled = () => process.env.RECIPIENT_FLOW_ENABLED === "true";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const recipientKey = (ownerId: string, email: string) => tokenHash(JSON.stringify([ownerId, email.trim().toLowerCase()]));
export function recipientBaseUrl() {
  try {
    const u = new URL(process.env.INVITATION_APP_URL || "");
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash || u.pathname !== "/invitation") return null;
    return u.href;
  } catch { return null; }
}
export async function isSuppressed(key: string, reader: Reader = db) {
  const [row] = await reader.select().from(s.recipientSuppressions).where(eq(s.recipientSuppressions.recipientKey, key));
  return !!row;
}
export async function createRecipientLink(tx: Writer, row: typeof s.partners.$inferSelect, kind: "invite" | "stop", now = new Date()) {
  const base = recipientBaseUrl();
  if (!base) throw new Error("recipient_link_not_configured");
  const token = randomBytes(32).toString("base64url");
  await tx.insert(s.recipientLinks).values({ tokenHash: tokenHash(token), partnerId: row.id, ownerId: row.ownerId,
    recipientKey: recipientKey(row.ownerId, row.partnerEmail), kind,
    expiresAt: kind === "invite" ? new Date(now.getTime() + 7 * 86400_000) : null, createdAt: now });
  return `${base}#${token}`;
}
export async function contactEmailState(row: typeof s.partners.$inferSelect, reader: Reader = db) {
  if (!recipientFlowEnabled()) return "not_enrolled" as const;
  if (await isSuppressed(recipientKey(row.ownerId, row.partnerEmail), reader)) return "stopped" as const;
  const [consent] = await reader.select().from(s.recipientConsents).where(eq(s.recipientConsents.partnerId, row.id));
  return consent ? (process.env.MISS_ALERTS_ENABLED === "true" ? "enabled" as const : "paused" as const) : "not_enrolled" as const;
}

/** Only an explicit new client consent can enroll mail. Older app clients stay unenrolled. */
export async function decidePartner(tx: Writer, row: typeof s.partners.$inferSelect, accept: boolean, consent: boolean, partnerUserId: string | null = null) {
  const status = accept ? "accepted" : "declined";
  if (row.status === status) return { status };
  if (row.status !== "invited") throw new ORPCError("CONFLICT", { message: "This invitation has already been answered." });
  if (accept && recipientFlowEnabled() && await isSuppressed(recipientKey(row.ownerId, row.partnerEmail), tx))
    throw new ORPCError("FORBIDDEN", { message: "Emails from this person have been stopped. This invitation cannot enroll you again." });
  const now = new Date();
  const [updated] = await tx.update(s.partners).set({ status, partnerUserId: accept ? partnerUserId : null, respondedAt: now })
    .where(and(eq(s.partners.id, row.id), eq(s.partners.status, "invited"))).returning();
  if (!updated) throw new ORPCError("CONFLICT", { message: "This invitation has changed. Open it again." });
  if (accept && consent && recipientFlowEnabled()) {
    const [profile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, row.ownerId));
    // First whole local day after consent. Never catch up earlier misses.
    const startDate = shiftDay(localDate(profile?.timezone || "UTC"), 1);
    await tx.insert(s.recipientConsents).values({ partnerId: row.id, acceptedAt: now, startDate, version: CONSENT_VERSION }).onConflictDoNothing();
  }
  return { status: updated.status };
}

export async function inspectRecipient(token: string) {
  if (!recipientFlowEnabled()) return { state: "unavailable" as const };
  const [link] = await db.select().from(s.recipientLinks).where(eq(s.recipientLinks.tokenHash, tokenHash(token)));
  if (!link) return { state: "invalid" as const };
  if (await isSuppressed(link.recipientKey)) return { state: "stopped" as const };
  if (link.kind === "stop") return { state: "stop" as const };
  if (!link.partnerId) return { state: "cancelled" as const };
  const [row] = await db.select().from(s.partners).where(eq(s.partners.id, link.partnerId));
  if (!row) return { state: "cancelled" as const };
  if (row.status !== "invited") return { state: row.status };
  if (link.expiresAt && link.expiresAt <= new Date()) return { state: "expired" as const };
  const [profile] = await db.select({ name: s.profiles.displayName }).from(s.profiles).where(eq(s.profiles.userId, row.ownerId));
  return { state: "invited" as const, ownerName: profile?.name || "Someone", expiresAt: link.expiresAt };
}

export async function respondRecipient(token: string, action: "accept" | "decline" | "stop") {
  if (!recipientFlowEnabled()) throw new ORPCError("FORBIDDEN", { message: "Invitations are temporarily unavailable." });
  return db.transaction(async tx => {
    const [link] = await tx.select().from(s.recipientLinks).where(eq(s.recipientLinks.tokenHash, tokenHash(token)));
    if (!link) throw new ORPCError("NOT_FOUND", { message: "This link is not valid. Open the full link from your email." });
    // Stop is always available, including expired or cancelled invitations, and is idempotent.
    if (action === "stop") {
      await tx.insert(s.recipientSuppressions).values({ recipientKey: link.recipientKey, stoppedAt: new Date() }).onConflictDoNothing();
      return { state: "stopped" as const };
    }
    if (await isSuppressed(link.recipientKey, tx)) return { state: "stopped" as const };
    if (link.kind !== "invite" || !link.partnerId) throw new ORPCError("NOT_FOUND", { message: "This invitation is no longer available." });
    const [row] = await tx.select().from(s.partners).where(eq(s.partners.id, link.partnerId));
    if (!row) throw new ORPCError("NOT_FOUND", { message: "This invitation was cancelled." });
    if (link.expiresAt && link.expiresAt <= new Date()) throw new ORPCError("FORBIDDEN", { message: "This invitation has expired. Ask the sender for a fresh invitation." });
    const result = await decidePartner(tx, row, action === "accept", true);
    await tx.update(s.recipientLinks).set({ decision: result.status as "accepted" | "declined" }).where(eq(s.recipientLinks.tokenHash, link.tokenHash));
    return { state: result.status };
  });
}
