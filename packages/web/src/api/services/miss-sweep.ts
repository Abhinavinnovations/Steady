import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, shiftDay } from "../lib/dates";
import { computeDayStatuses } from "../lib/streak";
import { sendEmail, emailShell } from "./email";

/**
 * $0 "lazy cron": piggybacks on normal traffic. Whenever anyone uses the app,
 * this checks (at most once per interval) whether any challenge user with a
 * verified accountability contact missed yesterday, and emails the contact.
 * One email per user per missed date — deduped via the miss_alerts table.
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
  const contacts = await db
    .select()
    .from(schema.accountabilityContacts)
    .where(isNotNull(schema.accountabilityContacts.verifiedAt));
  if (contacts.length === 0) return;

  for (const contact of contacts) {
    const [p] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, contact.userId));
    if (!p?.onboardedAt || p.mode !== "challenge") continue;

    const yesterday = shiftDay(localDate(p.timezone), -1);

    const [already] = await db
      .select({ id: schema.missAlerts.id })
      .from(schema.missAlerts)
      .where(
        and(
          eq(schema.missAlerts.userId, contact.userId),
          eq(schema.missAlerts.missedDate, yesterday),
        ),
      );
    if (already) continue;

    const { statuses } = await computeDayStatuses(contact.userId, p.timezone);
    if (statuses.get(yesterday) !== "missed") continue;

    // Claim the date first — races just mean a lost row, never a double email.
    const inserted = await db
      .insert(schema.missAlerts)
      .values({ userId: contact.userId, missedDate: yesterday })
      .onConflictDoNothing()
      .returning({ id: schema.missAlerts.id });
    if (inserted.length === 0) continue;

    const name = p.displayName || "Your friend";
    await sendEmail({
      to: contact.email,
      subject: `${name} missed their commitment yesterday`,
      text: `${name} signed you up as their accountability contact on Steady. Yesterday (${yesterday}) they didn't finish everything they committed to. A small check-in from you goes a long way.`,
      html: emailShell(
        `${name} missed a day`,
        `<p style="margin:0 0 12px;font-size:14px;color:#3a3a44;line-height:1.6;">${name} made you their accountability contact on Steady — the deal is you hear about it when they miss a day.</p>
         <p style="margin:0 0 12px;font-size:14px;color:#3a3a44;line-height:1.6;">Yesterday (<strong>${yesterday}</strong>) they didn't finish what they committed to.</p>
         <p style="margin:0;font-size:14px;color:#3a3a44;line-height:1.6;">No shaming — a small check-in from you goes a long way.</p>`,
      ),
    });
  }
}
