import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate } from "../lib/dates";
import { createFingerprint, replayCreate } from "../lib/create-request";
import { REPEATS, validDate, latestOccurrence, occursOn } from "../../shared/recurrence";
const dateSchema = z.string().refine(validDate, "Choose a real calendar date");
const fields = z.object({
  title: z.string().trim().min(1).max(120),
  durationMinutes: z.number().int().min(5).max(480).nullable().optional(),
  dueDate: dateSchema.optional(),
  repeat: z.enum(REPEATS).optional(),
  flagged: z.boolean().optional(),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  reminderEnabled: z.boolean().optional(),
  categoryId: z.number().int().nullable().optional(),
});
async function profile(userId: string) {
  const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  if (!p?.onboardedAt) throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
  return p;
}
async function own(userId: string, id: number) {
  const [t] = await db.select().from(schema.todos).where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)));
  if (!t) throw new ORPCError("NOT_FOUND");
  return t;
}
async function category(userId: string, id?: number | null) {
  if (id == null) return;
  const [c] = await db.select().from(schema.categories).where(and(eq(schema.categories.id, id), eq(schema.categories.userId, userId)));
  if (!c) throw new ORPCError("BAD_REQUEST", { message: "Unknown category" });
}
export const todos = {
  list: authed.handler(async ({ context }) => {
    const p = await profile(context.user.id);
    const today = localDate(p.timezone);
    const rows = await db.select().from(schema.todos).where(eq(schema.todos.userId, context.user.id));
    const checks = await db.select().from(schema.todoCompletions).where(eq(schema.todoCompletions.userId, context.user.id));
    const done = new Map(checks.map(c => [`${c.todoId}:${c.localDate}`, c.completedAt]));
    const projected = rows.flatMap(t => {
      const occurrenceDate = latestOccurrence(t.dueDate, t.repeat, today);
      if (!occurrenceDate) return [];
      const completedAt = t.repeat === "none" ? t.completedAt : done.get(`${t.id}:${occurrenceDate}`) ?? null;
      if (completedAt && occurrenceDate !== today && localDate(p.timezone, completedAt) !== today) return [];
      return [{ ...t, occurrenceDate, completedAt, scheduleLocked: !!t.completedAt || checks.some(c => c.todoId === t.id) }];
    }).sort((a,b) => Number(!!a.completedAt)-Number(!!b.completedAt) || Number(b.flagged)-Number(a.flagged) || (a.scheduledTime ?? "99").localeCompare(b.scheduledTime ?? "99") || a.id-b.id);
    return { today, timezone: p.timezone, todos: projected };
  }),
  upcoming: authed.handler(async ({ context }) => {
    const p = await profile(context.user.id);
    const today = localDate(p.timezone);
    const rows = await db.select().from(schema.todos).where(eq(schema.todos.userId, context.user.id));
    return { today, todos: rows.filter(t => t.dueDate > today || t.repeat !== "none") };
  }),
  create: authed.input(fields.extend({requestId:z.string().uuid().optional()})).handler(async ({ context, input }) => {
    const { requestId, ...values } = input;
    const fingerprint = createFingerprint(values);
    const lookup = async () => requestId ? (await db.select().from(schema.todos).where(and(eq(schema.todos.userId,context.user.id),eq(schema.todos.createRequestId,requestId))))[0] : undefined;
    const saved = await lookup();
    if (saved) return replayCreate(saved, fingerprint);
    const p = await profile(context.user.id);
    await category(context.user.id, input.categoryId);
    const open = await db.select({ id: schema.todos.id }).from(schema.todos).where(and(eq(schema.todos.userId, context.user.id), isNull(schema.todos.completedAt)));
    if (open.length >= 100) throw new ORPCError("BAD_REQUEST", { message: "100 open to-dos is enough — finish or delete a few first" });
    const [t] = await db.insert(schema.todos).values({ ...values, createRequestId:requestId, createFingerprint:requestId?fingerprint:null, userId: context.user.id, dueDate: input.dueDate ?? localDate(p.timezone), reminderEnabled: !!(input.scheduledTime && input.reminderEnabled) }).onConflictDoNothing().returning();
    const result = t ?? await lookup();
    if (!result) throw new ORPCError("CONFLICT", {message:"Could not confirm the save. Retry this draft."});
    return requestId ? replayCreate(result,fingerprint) : result;
  }),
  update: authed.input(fields.partial().extend({ id: z.number().int() })).handler(async ({ context, input }) => {
    const t = await own(context.user.id, input.id);
    await category(context.user.id, input.categoryId);
    if ((input.dueDate !== undefined && input.dueDate !== t.dueDate) || (input.repeat !== undefined && input.repeat !== t.repeat)) {
      const [check] = await db.select().from(schema.todoCompletions).where(eq(schema.todoCompletions.todoId, t.id)).limit(1);
      if (check || t.completedAt) throw new ORPCError("BAD_REQUEST", { message: "This schedule has completed history. Keep it and create a new to-do for a different schedule." });
    }
    const { id, ...changes } = input;
    const [updated] = await db.update(schema.todos).set({ ...changes, reminderEnabled: !!((input.scheduledTime !== undefined ? input.scheduledTime : t.scheduledTime) && (input.reminderEnabled ?? t.reminderEnabled)) }).where(eq(schema.todos.id, id)).returning();
    return updated;
  }),
  toggle: authed.input(z.object({ id: z.number().int(), done: z.boolean(), occurrenceDate: dateSchema.optional() })).handler(async ({ context, input }) => {
    const p = await profile(context.user.id);
    const t = await own(context.user.id, input.id);
    const today = localDate(p.timezone);
    const day = input.occurrenceDate ?? latestOccurrence(t.dueDate, t.repeat, today);
    if (!day || day > today || !occursOn(t.dueDate, t.repeat, day)) throw new ORPCError("BAD_REQUEST", { message: "Only scheduled occurrences today or earlier can be completed" });
    if (t.repeat === "none") {
      const [updated] = await db.update(schema.todos).set({ completedAt: input.done ? new Date() : null }).where(eq(schema.todos.id, t.id)).returning();
      return { ...updated, occurrenceDate: day };
    }
    if (input.done) await db.insert(schema.todoCompletions).values({ todoId: t.id, userId: context.user.id, localDate: day }).onConflictDoNothing();
    else await db.delete(schema.todoCompletions).where(and(eq(schema.todoCompletions.todoId, t.id), eq(schema.todoCompletions.localDate, day)));
    return { ...t, occurrenceDate: day, completedAt: input.done ? new Date() : null };
  }),
  remove: authed.input(z.object({ id: z.number().int() })).handler(async ({ context, input }) => {
    const t = await own(context.user.id, input.id);
    await db.delete(schema.todos).where(eq(schema.todos.id, t.id));
    return { ok: true };
  }),
};
