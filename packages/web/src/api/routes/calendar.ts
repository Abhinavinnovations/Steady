import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate } from "../lib/dates";
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
      const monthEnd = `${input.month}-31`; // string compare — safe upper bound

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

      const todoRows = await db
        .select({
          id: schema.todos.id,
          title: schema.todos.title,
          dueDate: schema.todos.dueDate,
          scheduledTime: schema.todos.scheduledTime,
          completedAt: schema.todos.completedAt,
        })
        .from(schema.todos)
        .where(
          and(
            eq(schema.todos.userId, context.user.id),
            gte(schema.todos.dueDate, monthStart),
            lte(schema.todos.dueDate, monthEnd),
          ),
        )
        .orderBy(schema.todos.dueDate, schema.todos.id);

      const { statuses } = await computeDayStatuses(context.user.id, p.timezone);
      const days: Record<string, string> = {};
      for (const [d, s] of statuses) {
        if (d.startsWith(input.month)) days[d] = s;
      }

      return {
        today,
        month: input.month,
        tasks: taskRows,
        todos: todoRows.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          scheduledTime: t.scheduledTime,
          completed: !!t.completedAt,
        })),
        days,
      };
    }),
};
