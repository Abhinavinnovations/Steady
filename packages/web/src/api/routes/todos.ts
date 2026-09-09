import { z } from "zod";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate } from "../lib/dates";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function requireProfile(userId: string) {
  const [p] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId));
  if (!p?.onboardedAt)
    throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
  return p;
}

async function ownTodo(userId: string, id: number) {
  const [t] = await db
    .select()
    .from(schema.todos)
    .where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)));
  if (!t) throw new ORPCError("NOT_FOUND");
  return t;
}

async function validCategory(userId: string, categoryId: number) {
  const [c] = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(
      and(
        eq(schema.categories.id, categoryId),
        eq(schema.categories.userId, userId),
      ),
    );
  if (!c) throw new ORPCError("BAD_REQUEST", { message: "Unknown category" });
}

/**
 * Temporary tasks ("today's tasks") — casual todos below the consistent list.
 * Deletable any time, never counted in streaks/badges/leaderboards.
 * Unfinished todos stay on the list until done or deleted.
 */
export const todos = {
  /**
   * Today view list: everything due today or earlier that is still open,
   * plus todos completed today (so the day's wins stay visible).
   */
  list: authed.handler(async ({ context }) => {
    const p = await requireProfile(context.user.id);
    const today = localDate(p.timezone);
    const rows = await db
      .select()
      .from(schema.todos)
      .where(
        and(
          eq(schema.todos.userId, context.user.id),
          or(
            and(isNull(schema.todos.completedAt), lte(schema.todos.dueDate, today)),
            eq(schema.todos.dueDate, today),
          ),
        ),
      )
      .orderBy(schema.todos.completedAt, schema.todos.scheduledTime, schema.todos.id);
    // completed rows: keep only ones completed today (older history lives in `upcoming`/calendar later)
    const openOrToday = rows.filter(
      (t) => !t.completedAt || t.dueDate === today,
    );
    return { today, todos: openOrToday };
  }),

  /** Todos scheduled for a future date — powers the calendar view. */
  upcoming: authed.handler(async ({ context }) => {
    const p = await requireProfile(context.user.id);
    const today = localDate(p.timezone);
    const rows = await db
      .select()
      .from(schema.todos)
      .where(and(eq(schema.todos.userId, context.user.id)))
      .orderBy(schema.todos.dueDate, schema.todos.scheduledTime);
    return { today, todos: rows.filter((t) => t.dueDate > today) };
  }),

  create: authed
    .input(
      z.object({
        title: z.string().trim().min(1).max(120),
        durationMinutes: z.number().int().min(5).max(480).optional(),
        /** "YYYY-MM-DD" — defaults to today in the user's timezone. */
        dueDate: z.string().regex(DATE_RE).optional(),
        /** "HH:mm" 24h. */
        scheduledTime: z.string().regex(TIME_RE).optional(),
        reminderEnabled: z.boolean().optional(),
        categoryId: z.number().int().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const p = await requireProfile(context.user.id);
      if (input.categoryId != null)
        await validCategory(context.user.id, input.categoryId);
      const open = await db
        .select({ id: schema.todos.id })
        .from(schema.todos)
        .where(
          and(
            eq(schema.todos.userId, context.user.id),
            isNull(schema.todos.completedAt),
          ),
        );
      if (open.length >= 100)
        throw new ORPCError("BAD_REQUEST", {
          message: "100 open todos is enough — finish or delete a few first",
        });
      const [todo] = await db
        .insert(schema.todos)
        .values({
          userId: context.user.id,
          title: input.title.trim(),
          durationMinutes: input.durationMinutes ?? null,
          dueDate: input.dueDate ?? localDate(p.timezone),
          scheduledTime: input.scheduledTime ?? null,
          reminderEnabled: input.reminderEnabled ?? false,
          categoryId: input.categoryId ?? null,
        })
        .returning();
      return todo;
    }),

  update: authed
    .input(
      z.object({
        id: z.number(),
        title: z.string().trim().min(1).max(120).optional(),
        durationMinutes: z.number().int().min(5).max(480).nullable().optional(),
        dueDate: z.string().regex(DATE_RE).optional(),
        scheduledTime: z.string().regex(TIME_RE).nullable().optional(),
        reminderEnabled: z.boolean().optional(),
        categoryId: z.number().int().nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const todo = await ownTodo(context.user.id, input.id);
      if (input.categoryId != null)
        await validCategory(context.user.id, input.categoryId);
      const [updated] = await db
        .update(schema.todos)
        .set({
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.durationMinutes !== undefined
            ? { durationMinutes: input.durationMinutes }
            : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
          ...(input.scheduledTime !== undefined
            ? { scheduledTime: input.scheduledTime }
            : {}),
          ...(input.reminderEnabled !== undefined
            ? { reminderEnabled: input.reminderEnabled }
            : {}),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId }
            : {}),
        })
        .where(eq(schema.todos.id, todo.id))
        .returning();
      return updated;
    }),

  /** Check off / un-check. No mandatory note — these are the casual ones. */
  toggle: authed
    .input(z.object({ id: z.number(), done: z.boolean() }))
    .handler(async ({ context, input }) => {
      const todo = await ownTodo(context.user.id, input.id);
      const [updated] = await db
        .update(schema.todos)
        .set({ completedAt: input.done ? new Date() : null })
        .where(eq(schema.todos.id, todo.id))
        .returning();
      return updated;
    }),

  /** Delete any time — this is the freedom consistent tasks don't have. */
  remove: authed
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const todo = await ownTodo(context.user.id, input.id);
      await db.delete(schema.todos).where(eq(schema.todos.id, todo.id));
      return { ok: true };
    }),
};
