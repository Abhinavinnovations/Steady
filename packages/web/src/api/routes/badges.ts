import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { computeDayStatuses, bestStreak } from "../lib/streak";

/**
 * Badges stay minimal and automatic — earned lazily whenever this endpoint
 * runs, never revoked, nothing to configure. Six quiet milestones.
 */

export const BADGE_DEFS = [
  {
    code: "first-day",
    title: "First full day",
    description: "Completed every task in a single day.",
  },
  {
    code: "streak-7",
    title: "One week steady",
    description: "A 7-day streak of full days.",
  },
  {
    code: "streak-30",
    title: "One month steady",
    description: "A 30-day streak of full days.",
  },
  {
    code: "streak-100",
    title: "Hundred steady",
    description: "A 100-day streak of full days.",
  },
  {
    code: "century",
    title: "Century",
    description: "100 full days in total.",
  },
  {
    code: "perfect-month",
    title: "Perfect month",
    description: "A finished calendar month with zero missed days.",
  },
] as const;

type BadgeCode = (typeof BADGE_DEFS)[number]["code"];

export const badges = {
  /** All badge definitions with earned state. Awards anything newly earned. */
  get: authed.handler(async ({ context }) => {
    const [p] = await db
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, context.user.id));
    if (!p?.onboardedAt)
      throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });

    const { today, statuses } = await computeDayStatuses(
      context.user.id,
      p.timezone,
    );

    let totalComplete = 0;
    const byMonth = new Map<string, { complete: number; missed: number }>();
    for (const [d, s] of statuses) {
      if (s === "complete") totalComplete++;
      const m = d.slice(0, 7);
      let agg = byMonth.get(m);
      if (!agg) byMonth.set(m, (agg = { complete: 0, missed: 0 }));
      if (s === "complete") agg.complete++;
      else if (s === "missed") agg.missed++;
    }
    const best = bestStreak(statuses);
    const currentMonth = today.slice(0, 7);
    const hasPerfectMonth = [...byMonth.entries()].some(
      ([m, agg]) => m < currentMonth && agg.missed === 0 && agg.complete >= 7,
    );

    const earnedNow = new Set<BadgeCode>();
    if (totalComplete >= 1) earnedNow.add("first-day");
    if (best >= 7) earnedNow.add("streak-7");
    if (best >= 30) earnedNow.add("streak-30");
    if (best >= 100) earnedNow.add("streak-100");
    if (totalComplete >= 100) earnedNow.add("century");
    if (hasPerfectMonth) earnedNow.add("perfect-month");

    const existing = await db
      .select()
      .from(schema.badges)
      .where(eq(schema.badges.userId, context.user.id));
    const have = new Set(existing.map((b) => b.code));

    const missing = [...earnedNow].filter((c) => !have.has(c));
    if (missing.length > 0) {
      await db
        .insert(schema.badges)
        .values(missing.map((code) => ({ userId: context.user.id, code })))
        .onConflictDoNothing();
    }

    const earnedAt = new Map(existing.map((b) => [b.code, b.earnedAt]));
    const now = new Date();
    return BADGE_DEFS.map((def) => {
      const earned = have.has(def.code) || earnedNow.has(def.code);
      return {
        code: def.code,
        title: def.title,
        description: def.description,
        earned,
        earnedAt: earned ? (earnedAt.get(def.code) ?? now) : null,
      };
    });
  }),
};
