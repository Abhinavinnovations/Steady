import { and, eq } from "drizzle-orm";
import { db } from "../database";
import * as s from "../database/schema";
import { localDate, shiftDay } from "../lib/dates";
import { computeDayStatuses } from "../lib/streak";
import { eligibleForCommitmentEmail } from "../lib/add-commitment";
import { sendEmail } from "./email";
import { CONSENT_VERSION, createRecipientLink, isSuppressed, recipientBaseUrl, recipientFlowEnabled, recipientKey } from "./recipient-consent";

// Free, traffic-triggered check, not a scheduled delivery guarantee.
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
let lastSweepAt = 0;
let running = false;
const enabled = () => recipientFlowEnabled() && process.env.MISS_ALERTS_ENABLED === "true" && /^\d{4}-\d{2}-\d{2}$/.test(process.env.MISS_ALERTS_START_DATE || "") && !!recipientBaseUrl();

export function maybeSweepMissAlerts() {
  if (!enabled()) return;
  const now = Date.now();
  if (running || now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  running = true;
  sweepMissAlerts().catch(() => console.error("[miss-sweep] sweep_failed"))
    .finally(() => { running = false; });
}

export async function sweepMissAlerts() {
  if (!enabled()) return;
  const users = await db.selectDistinct({ userId: s.tasks.userId }).from(s.tasks).where(eq(s.tasks.mode, "challenge"));
  for (const { userId } of users) {
    try { await sweepOwner(userId); }
    catch { console.error("[miss-sweep] owner_check_failed"); }
  }
}
async function sweepOwner(userId: string) {
  const [p] = await db.select().from(s.profiles).where(eq(s.profiles.userId, userId));
  if (!p?.onboardedAt) return;
  const yesterday = shiftDay(localDate(p.timezone), -1);
  if (yesterday < process.env.MISS_ALERTS_START_DATE!) return;
  const [partner] = await db.select().from(s.partners).where(and(eq(s.partners.ownerId, userId), eq(s.partners.status, "accepted")));
  if (!partner) return;
  const key = recipientKey(userId, partner.partnerEmail);
  const [consent] = await db.select().from(s.recipientConsents).where(eq(s.recipientConsents.partnerId, partner.id));
  if (!consent || consent.version !== CONSENT_VERSION || yesterday < consent.startDate || yesterday <= localDate(p.timezone, consent.acceptedAt) || await isSuppressed(key)) return;
  const [old] = await db.select().from(s.missAlerts).where(and(eq(s.missAlerts.userId, userId), eq(s.missAlerts.missedDate, yesterday)));
  if (old) return;
  const { statuses } = await computeDayStatuses(userId, p.timezone, 400, "challenge");
  if (statuses.get(yesterday) !== "missed") return;
  const dayTasks = await db.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.mode, "challenge"), eq(s.tasks.month, yesterday.slice(0, 7))));
  const eligible = dayTasks.filter(task => eligibleForCommitmentEmail(task, yesterday));
  const completed = await db.select({ taskId: s.completions.taskId }).from(s.completions).where(and(eq(s.completions.userId, userId), eq(s.completions.localDate, yesterday)));
  const done = new Set(completed.map(row => row.taskId));
  // A newly added task is immediately completable, but its partial first day
  // must never cause an email. Older unfinished tasks still count normally.
  if (!eligible.some(task => !done.has(task.id))) return;

  const claim = await db.transaction(async tx => {
    const [fresh] = await tx.select().from(s.partners).where(eq(s.partners.id, partner.id));
    const [freshConsent] = await tx.select().from(s.recipientConsents).where(eq(s.recipientConsents.partnerId, partner.id));
    if (!fresh || fresh.status !== "accepted" || !freshConsent || await isSuppressed(key, tx)) return null;
    const [attempt] = await tx.insert(s.missAlertDeliveries).values({ userId, partnerId: partner.id, missedDate: yesterday, outcome: "sending", code: "sending" }).onConflictDoNothing().returning();
    if (!attempt) return null;
    const stop = await createRecipientLink(tx, fresh, "stop");
    return { attempt, stop };
  });
  if (!claim) return;
  // Stop/cancel commits before this check suppress delivery. SMTP already in flight
  // cannot be recalled, and ambiguous transport results are never retried.
  const [fresh] = await db.select().from(s.partners).where(eq(s.partners.id, partner.id));
  const blocked = !enabled() || !fresh || fresh.status !== "accepted" || await isSuppressed(key);
  let outcome: { outcome: "accepted" | "failed" | "unknown" | "suppressed"; code: string; providerId: string | null };
  if (blocked) outcome = { outcome: "suppressed", code: "recipient_unavailable", providerId: null };
  else {
    const name = p.displayName || "Your friend";
    try {
      outcome = await sendEmail({ to: partner.partnerEmail,
        subject: `${name.replace(/[\r\n]/g, " ").slice(0, 100)} missed a Challenge day`,
        text: `${name} did not finish their Challenge day on ${yesterday} (${p.timezone}). A small check-in from you may help.\n\nYou receive this because you accepted their Steady invitation. No task names, notes or Basic tasks are shared.\n\nStop invitations and missed-day emails from this person: ${claim.stop}\n\nSteady`,
      });
    } catch { outcome = { outcome: "unknown", code: "provider_unconfirmed", providerId: null }; }
  }
  await db.update(s.missAlertDeliveries).set({ ...outcome, updatedAt: new Date() }).where(and(eq(s.missAlertDeliveries.id, claim.attempt.id), eq(s.missAlertDeliveries.outcome, "sending")));
}
