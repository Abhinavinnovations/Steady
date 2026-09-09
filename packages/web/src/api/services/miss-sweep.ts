import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, shiftDay } from "../lib/dates";
import { computeDayStatuses } from "../lib/streak";
import { sendEmail, emailShell } from "./email";

/**
 * $0 "lazy cron": piggybacks on normal traffic. Whenever anyone uses the app,
 * this checks (at most once per interval) whether any user with CHALLENGE
 * tasks missed yesterday, and emails their verified accountability contact
 * and/or accepted partner. Basic tasks never trigger emails — fully private.
 * One alert per user per missed date — deduped via the miss_alerts table
 * (a single claim covers both sends).
 */

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
let lastSweepAt = 0;
let running = false;

export function maybeSweepMissAlerts() {
  const now = Date.now();
  if (running || now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  running = true;
  sweep()
    .catch((e) => console.error("[miss-sweep] failed:", e))
    .finally(() => {
      running = false;
    });
}

async function sweep() {
  // Users with at least one challenge task — the only ones whose misses
  // are anyone else's business.
  const challengeTaskRows = await db
    .selectDistinct({ userId: schema.tasks.userId })
    .from(schema.tasks)
    .where(eq(schema.tasks.mode, "challenge"));
  if (challengeTaskRows.length === 0) return;

  for (const { userId } of challengeTaskRows) {
    const [p] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, userId));
    if (!p?.onboardedAt) continue;

    // Who hears about it: verified contact and/or accepted partner.
    const [contact] = await db
      .select()
      .from(schema.accountabilityContacts)
      .where(
        and(
          eq(schema.accountabilityContacts.userId, userId),
          isNotNull(schema.accountabilityContacts.verifiedAt),
        ),
      );
    const [partner] = await db
      .select()
      .from(schema.partners)
      .where(
        and(
          eq(schema.partners.ownerId, userId),
          eq(schema.partners.status, "accepted"),
        ),
      );
    const recipients = [contact?.email, partner?.partnerEmail].filter(
      (e): e is string => !!e,
    );
    if (recipients.length === 0) continue;

    const yesterday = shiftDay(localDate(p.timezone), -1);

    const [already] = await db
      .select({ id: schema.missAlerts.id })
      .from(schema.missAlerts)
      .where(
        and(
          eq(schema.missAlerts.userId, userId),
          eq(schema.missAlerts.missedDate, yesterday),
        ),
      );
    if (already) continue;

    // Only challenge tasks count — a missed basic task stays private.
    const { statuses } = await computeDayStatuses(
      userId,
      p.timezone,
      400,
      "challenge",
    );
    if (statuses.get(yesterday) !== "missed") continue;

    // Claim the date first — races just mean a lost row, never a double email.
    const inserted = await db
      .insert(schema.missAlerts)
      .values({ userId, missedDate: yesterday })
      .onConflictDoNothing()
      .returning({ id: schema.missAlerts.id });
    if (inserted.length === 0) continue;

    const name = p.displayName || "Your friend";
    for (const to of recipients) {
      await sendEmail({
        to,
        subject: `${name} missed their commitment yesterday`,
        text: `${name} signed you up for accountability on Steady. Yesterday (${yesterday}) they didn't finish their challenge tasks. A small check-in from you goes a long way.`,
        html: emailShell(
          `${name} missed a day`,
          `<p style="margin:0 0 12px;font-size:14px;color:#3a3a44;line-height:1.6;">${name} asked you to keep them accountable on Steady — the deal is you hear about it when they break their streak.</p>
           <p style="margin:0 0 12px;font-size:14px;color:#3a3a44;line-height:1.6;">Yesterday (<strong>${yesterday}</strong>) they didn't finish their challenge tasks.</p>
           <p style="margin:0;font-size:14px;color:#3a3a44;line-height:1.6;">No shaming — a small check-in from you goes a long way.</p>`,
        ),
      });
    }
  }
}
