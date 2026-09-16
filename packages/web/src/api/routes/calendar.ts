import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate } from "../lib/dates";
import { occurrencesBetween } from "../../shared/recurrence";
import { computeDayStatuses } from "../lib/streak";

/**
 * Calendar tab — everything scheduled in one month, in one call:
 * - consistent tasks committed for that month (they apply every day)
 * - to-dos due inside the month (including completed ones)
 * - per-day statuses (complete / missed / rest / pending) for coloring past days
 */
export const calendar = {
  get: authed
    .input(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      }),
    )
    .handler(async ({ context, input }) => {
      const [p] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, context.user.id));
      if (!p?.onboardedAt)
        throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });

      const today = localDate(p.timezone);
      const monthStart = `${input.month}-01`;

      const taskRows = await db
        .select({
          id: schema.tasks.id,
          title: schema.tasks.title,
          scheduledTime: schema.tasks.scheduledTime,
          startDate: schema.tasks.startDate,
          mode: schema.tasks.mode,
        })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.userId, context.user.id),
            eq(schema.tasks.month, input.month),
          ),
        )
        .orderBy(schema.tasks.id);

      const rows = await db.select().from(schema.todos).where(eq(schema.todos.userId, context.user.id));
      const checks = await db.select().from(schema.todoCompletions).where(eq(schema.todoCompletions.userId, context.user.id));
      const done = new Map(checks.map(c => [`${c.todoId}:${c.localDate}`, c.completedAt]));
      const [year, monthNo] = input.month.split("-").map(Number);
      const end = `${input.month}-${new Date(Date.UTC(year, monthNo, 0)).getUTCDate()}`;
      const todoRows = rows.flatMap(t => occurrencesBetween(t.dueDate, t.repeat, monthStart, end).map(day => ({ ...t, scheduleLocked: !!t.completedAt || checks.some(c => c.todoId === t.id), anchorDate: t.dueDate, dueDate: day, occurrenceDate: day, completedAt: t.repeat === "none" ? t.completedAt : done.get(`${t.id}:${day}`) ?? null })));

      const { statuses } = await computeDayStatuses(context.user.id, p.timezone);
      const days: Record<string, string> = {};
      for (const [d, s] of statuses) {
        if (d.startsWith(input.month)) days[d] = s;
      }

      return {
        today,
        month: input.month,
        tasks: taskRows,
        todos: todoRows.map(t => ({ ...t, completed: !!t.completedAt })),
        days,
      };
    }),
};
