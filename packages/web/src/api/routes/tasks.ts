import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, localMonth } from "../lib/dates";

async function requireProfile(userId: string) {
  const [p] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId));
  if (!p?.onboardedAt)
    throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
  return p;
}

async function getCommitment(userId: string, month: string) {
  const [c] = await db
    .select()
    .from(schema.commitments)
    .where(
      and(
        eq(schema.commitments.userId, userId),
        eq(schema.commitments.month, month),
      ),
    );
  return c ?? null;
}

export const tasks = {
  /** Current month's commitment + task list. */
  current: authed.handler(async ({ context }) => {
    const p = await requireProfile(context.user.id);
    const month = localMonth(p.timezone);
    const commitment = await getCommitment(context.user.id, month);
    const list = await db
      .select()
      .from(schema.tasks)
      .where(
        and(eq(schema.tasks.userId, context.user.id), eq(schema.tasks.month, month)),
      )
      .orderBy(schema.tasks.id);
    return {
      month,
      confirmed: !!commitment?.confirmedAt,
      tasks: list,
    };
  }),

  /**
   * Add a task to the current month.
   * Allowed before AND after confirmation — commitments only ever go up.
   * startDate = today, so past days aren't retroactively required.
   */
  create: authed
    .input(
      z.object({
        title: z.string().trim().min(2).max(80),
        /** Optional planned minutes for the focus timer (5 min – 8 h). */
        durationMinutes: z.number().int().min(5).max(480).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const p = await requireProfile(context.user.id);
      const month = localMonth(p.timezone);
      const existing = await db
        .select({ id: schema.tasks.id })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.userId, context.user.id),
            eq(schema.tasks.month, month),
          ),
        );
      if (existing.length >= 10)
        throw new ORPCError("BAD_REQUEST", {
          message: "Max 10 tasks per month — keep it sustainable",
        });
      const [task] = await db
        .insert(schema.tasks)
        .values({
          userId: context.user.id,
          month,
          title: input.title.trim(),
          durationMinutes: input.durationMinutes ?? null,
          startDate: localDate(p.timezone),
        })
        .returning();
      return task;
    }),

  /** Remove a task — ONLY while the month is still a draft (not confirmed). */
  remove: authed
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      await requireProfile(context.user.id);
      const [task] = await db
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.id, input.id),
            eq(schema.tasks.userId, context.user.id),
          ),
        );
      if (!task) throw new ORPCError("NOT_FOUND");
      const commitment = await getCommitment(context.user.id, task.month);
      if (commitment?.confirmedAt)
        throw new ORPCError("FORBIDDEN", {
          message:
            "This month is locked — tasks can't be removed until next month",
        });
      await db.delete(schema.tasks).where(eq(schema.tasks.id, task.id));
      return { ok: true };
    }),

  /** Lock the current month. Requires at least one task. Irreversible until next month. */
  confirm: authed.handler(async ({ context }) => {
    const p = await requireProfile(context.user.id);
    const month = localMonth(p.timezone);
    const list = await db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(
        and(eq(schema.tasks.userId, context.user.id), eq(schema.tasks.month, month)),
      );
    if (list.length === 0)
      throw new ORPCError("BAD_REQUEST", { message: "Add at least one task" });
    const existing = await getCommitment(context.user.id, month);
    if (existing) {
      if (existing.confirmedAt) return existing;
      const [updated] = await db
        .update(schema.commitments)
        .set({ confirmedAt: new Date() })
        .where(eq(schema.commitments.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(schema.commitments)
      .values({
        userId: context.user.id,
        month,
        confirmedAt: new Date(),
      })
      .returning();
    return created;
  }),

  /** Copy last month's tasks into the current (unconfirmed) month — rollover helper. */
  copyPrevious: authed.handler(async ({ context }) => {
    const p = await requireProfile(context.user.id);
    const month = localMonth(p.timezone);
    const commitment = await getCommitment(context.user.id, month);
    if (commitment?.confirmedAt)
      throw new ORPCError("FORBIDDEN", { message: "Month already confirmed" });
    const [y, m] = month.split("-").map(Number);
    const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
    const prevTasks = await db
      .select()
      .from(schema.tasks)
      .where(
        and(eq(schema.tasks.userId, context.user.id), eq(schema.tasks.month, prev)),
      );
    const today = localDate(p.timezone);
    const currentTasks = await db
      .select({ title: schema.tasks.title })
      .from(schema.tasks)
      .where(
        and(eq(schema.tasks.userId, context.user.id), eq(schema.tasks.month, month)),
      );
    const have = new Set(currentTasks.map((t) => t.title.toLowerCase()));
    const toCopy = prevTasks.filter((t) => !have.has(t.title.toLowerCase()));
    if (toCopy.length > 0) {
      await db.insert(schema.tasks).values(
        toCopy.map((t) => ({
          userId: context.user.id,
          month,
          title: t.title,
          durationMinutes: t.durationMinutes,
          startDate: today,
        })),
      );
    }
    return { copied: toCopy.length };
  }),
};
