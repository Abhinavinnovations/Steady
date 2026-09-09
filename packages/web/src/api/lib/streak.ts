import { and, eq, gte } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, shiftDay } from "./dates";

export type DayStatus = "complete" | "missed" | "rest" | "pending";

/**
 * A day is COMPLETE when every active task that day has a completion.
 * Active task for day D = task whose month == D's month and startDate <= D.
 * Days with zero active tasks are "rest" days — they neither extend nor break a streak.
 * Today, while incomplete, is "pending" — it does not break the streak yet.
 */
export async function computeDayStatuses(
  userId: string,
  timezone: string,
  daysBack = 400,
  /** Restrict to one task mode — used for the per-mode leaderboards and partner views. */
  mode?: "basic" | "challenge",
): Promise<{ today: string; statuses: Map<string, DayStatus> }> {
  const today = localDate(timezone);
  const firstDay = shiftDay(today, -daysBack);

  const tasks = await db
    .select({
      id: schema.tasks.id,
      month: schema.tasks.month,
      startDate: schema.tasks.startDate,
    })
    .from(schema.tasks)
    .where(
      mode
        ? and(eq(schema.tasks.userId, userId), eq(schema.tasks.mode, mode))
        : eq(schema.tasks.userId, userId),
    );

  const comps = await db
    .select({
      taskId: schema.completions.taskId,
      localDate: schema.completions.localDate,
    })
    .from(schema.completions)
    .where(
      and(
        eq(schema.completions.userId, userId),
        gte(schema.completions.localDate, firstDay),
      ),
    );

  const doneByDay = new Map<string, Set<number>>();
  for (const c of comps) {
    let s = doneByDay.get(c.localDate);
    if (!s) doneByDay.set(c.localDate, (s = new Set()));
    s.add(c.taskId);
  }

  const statuses = new Map<string, DayStatus>();
  // Only bother from the user's first-ever task start date.
  const firstStart = tasks.reduce<string | null>(
    (min, t) => (min === null || t.startDate < min ? t.startDate : min),
    null,
  );
  if (!firstStart) return { today, statuses };

  let d = firstStart > firstDay ? firstStart : firstDay;
  while (d <= today) {
    const month = d.slice(0, 7);
    const active = tasks.filter((t) => t.month === month && t.startDate <= d);
    if (active.length === 0) {
      statuses.set(d, "rest");
    } else {
      const done = doneByDay.get(d) ?? new Set<number>();
      const allDone = active.every((t) => done.has(t.id));
      if (allDone) statuses.set(d, "complete");
      else statuses.set(d, d === today ? "pending" : "missed");
    }
    d = shiftDay(d, 1);
  }
  return { today, statuses };
}

export function activeStreak(
  today: string,
  statuses: Map<string, DayStatus>,
): number {
  let streak = 0;
  let d = today;
  // Today counts if complete; if pending/rest, skip it and look back.
  const t = statuses.get(d);
  if (t === "complete") streak++;
  d = shiftDay(d, -1);
  while (statuses.has(d)) {
    const s = statuses.get(d);
    if (s === "complete") streak++;
    else if (s === "rest") {
      // rest days neither break nor extend
    } else break;
    d = shiftDay(d, -1);
  }
  return streak;
}

export function bestStreak(statuses: Map<string, DayStatus>): number {
  let best = 0;
  let run = 0;
  const days = [...statuses.keys()].sort();
  for (const d of days) {
    const s = statuses.get(d);
    if (s === "complete") {
      run++;
      if (run > best) best = run;
    } else if (s === "missed") {
      run = 0;
    }
    // rest/pending: run unchanged
  }
  return best;
}
