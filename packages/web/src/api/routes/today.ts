import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, localMonth } from "../lib/dates";
import { computeDayStatuses, activeStreak } from "../lib/streak";
import { maybeSweepMissAlerts } from "../services/miss-sweep";

async function requireProfile(userId: string) {
  const [p] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId));
  if (!p?.onboardedAt)
    throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
  return p;
}

export const today = {
  /** Everything the Today screen needs in one call. */
  get: authed.handler(async ({ context }) => {
    // $0 lazy cron — fires the missed-day alert sweep off normal traffic.
    maybeSweepMissAlerts();
    const p = await requireProfile(context.user.id);
    const day = localDate(p.timezone);
    const month = localMonth(p.timezone);

    const [commitment] = await db
      .select()
      .from(schema.commitments)
      .where(
        and(
          eq(schema.commitments.userId, context.user.id),
          eq(schema.commitments.month, month),
        ),
      );

    const taskList = await db
      .select()
      .from(schema.tasks)
      .where(
        and(eq(schema.tasks.userId, context.user.id), eq(schema.tasks.month, month)),
      )
      .orderBy(schema.tasks.id);

    const comps = await db
      .select()
      .from(schema.completions)
      .where(
        and(
          eq(schema.completions.userId, context.user.id),
          eq(schema.completions.localDate, day),
        ),
      );
    const doneByTask = new Map(comps.map((c) => [c.taskId, c]));

    const activeTasks = taskList
      .filter((t) => t.startDate <= day)
      .map((t) => {
        const c = doneByTask.get(t.id);
        return {
          id: t.id,
          title: t.title,
          durationMinutes: t.durationMinutes,
          categoryId: t.categoryId,
          scheduledTime: t.scheduledTime,
          reminderEnabled: t.reminderEnabled,
          completed: !!c,
          note: c?.note ?? null,
          completedAt: c?.createdAt ?? null,
        };
      });

    const { statuses } = await computeDayStatuses(context.user.id, p.timezone);
    const streak = activeStreak(day, statuses);
    const doneCount = activeTasks.filter((t) => t.completed).length;
    const allDone = activeTasks.length > 0 && doneCount === activeTasks.length;

    // Yesterday context for gentle copy ("Fresh start today")
    const yesterdayStatus =
      statuses.get(
        (() => {
          const [y, m, d] = day.split("-").map(Number);
          return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
        })(),
      ) ?? null;

    return {
      localDate: day,
      month,
      mode: p.mode,
      displayName: p.displayName,
      confirmed: !!commitment?.confirmedAt,
      tasks: activeTasks,
      doneCount,
      totalCount: activeTasks.length,
      allDone,
      streak,
      yesterdayStatus,
    };
  }),

  /**
   * Complete a task for today. The note is mandatory — this is the whole point:
   * you don't just tick, you say what you actually did.
   */
  complete: authed
    .input(
      z.object({
        taskId: z.number(),
        note: z.string().trim().min(10, "Write at least a line about what you did").max(500),
      }),
    )
    .handler(async ({ context, input }) => {
      const p = await requireProfile(context.user.id);
      const day = localDate(p.timezone);
      const month = localMonth(p.timezone);

      const [task] = await db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.id, input.taskId),
            eq(schema.tasks.userId, context.user.id),
          ),
        );
      if (!task) throw new ORPCError("NOT_FOUND", { message: "Task not found" });
      if (task.month !== month)
        throw new ORPCError("BAD_REQUEST", { message: "Task is not from this month" });
      if (task.startDate > day)
        throw new ORPCError("BAD_REQUEST", { message: "Task starts later" });

      const [commitment] = await db
        .select()
        .from(schema.commitments)
        .where(
          and(
            eq(schema.commitments.userId, context.user.id),
            eq(schema.commitments.month, month),
          ),
        );
      if (!commitment?.confirmedAt)
        throw new ORPCError("FORBIDDEN", {
          message: "Confirm your monthly commitment first",
        });

      const existing = await db
        .select({ id: schema.completions.id })
        .from(schema.completions)
        .where(
          and(
            eq(schema.completions.taskId, task.id),
            eq(schema.completions.localDate, day),
          ),
        );
      if (existing.length > 0)
        throw new ORPCError("CONFLICT", { message: "Already done today" });

      const [completion] = await db
        .insert(schema.completions)
        .values({
          taskId: task.id,
          userId: context.user.id,
          localDate: day,
          note: input.note.trim(),
        })
        .returning();
      return completion;
    }),

  /** Undo a completion — same day only. */
  undo: authed
    .input(z.object({ taskId: z.number() }))
    .handler(async ({ context, input }) => {
      const p = await requireProfile(context.user.id);
      const day = localDate(p.timezone);
      const res = await db
        .delete(schema.completions)
        .where(
          and(
            eq(schema.completions.taskId, input.taskId),
            eq(schema.completions.userId, context.user.id),
            eq(schema.completions.localDate, day),
          ),
        )
        .returning({ id: schema.completions.id });
      if (res.length === 0)
        throw new ORPCError("NOT_FOUND", { message: "Nothing to undo today" });
      return { ok: true };
    }),
};
