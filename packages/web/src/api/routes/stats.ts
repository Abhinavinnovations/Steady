import { z } from "zod";
import { and, eq, gte } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, shiftDay, dayRange } from "../lib/dates";
import {
  computeDayStatuses,
  activeStreak,
  bestStreak,
  type DayStatus,
} from "../lib/streak";

async function requireProfile(userId: string) {
  const [p] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId));
  if (!p?.onboardedAt)
    throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
  return p;
}

export const stats = {
  /**
   * Day-by-day statuses for a range, plus streak numbers.
   * range: week = last 7 days, month = current month, year = last 365 days.
   */
  summary: authed
    .input(z.object({ range: z.enum(["week", "month", "year"]) }))
    .handler(async ({ context, input }) => {
      const p = await requireProfile(context.user.id);
      const today = localDate(p.timezone);
      const { statuses } = await computeDayStatuses(context.user.id, p.timezone);

      let start: string;
      if (input.range === "week") start = shiftDay(today, -6);
      else if (input.range === "month") start = `${today.slice(0, 7)}-01`;
      else start = shiftDay(today, -364);

      const days = dayRange(start, today).map((d) => ({
        date: d,
        status: (statuses.get(d) ?? "rest") as DayStatus,
      }));

      const complete = days.filter((d) => d.status === "complete").length;
      const missed = days.filter((d) => d.status === "missed").length;
      const tracked = complete + missed;

      // Notes journal for the range (most recent first)
      const notes = await db
        .select({
          taskId: schema.completions.taskId,
          localDate: schema.completions.localDate,
          note: schema.completions.note,
        })
        .from(schema.completions)
        .where(
          and(
            eq(schema.completions.userId, context.user.id),
            gte(schema.completions.localDate, start),
          ),
        );
      const taskRows = await db
        .select({ id: schema.tasks.id, title: schema.tasks.title })
        .from(schema.tasks)
        .where(eq(schema.tasks.userId, context.user.id));
      const titles = new Map(taskRows.map((t) => [t.id, t.title]));

      return {
        range: input.range,
        start,
        end: today,
        days,
        completeDays: complete,
        missedDays: missed,
        consistency: tracked > 0 ? Math.round((complete / tracked) * 100) : 0,
        streak: activeStreak(today, statuses),
        bestStreak: bestStreak(statuses),
        notes: notes
          .sort((a, b) => (a.localDate < b.localDate ? 1 : -1))
          .slice(0, 100)
          .map((n) => ({
            date: n.localDate,
            task: titles.get(n.taskId) ?? "Task",
            note: n.note,
          })),
      };
    }),
};
