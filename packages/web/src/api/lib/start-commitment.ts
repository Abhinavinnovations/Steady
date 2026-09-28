import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { localDate } from "./dates";
import { nextMonth } from "./commitment-setup";
import { requireChallengeContact } from "./challenge-contact";
import { validDate } from "../../shared/recurrence";

export const startCommitmentInput = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  expectedDate: z.string().refine(validDate, "Choose a real calendar date"),
  taskIds: z.array(z.number().int().positive()).min(1).max(10),
}).refine(input => new Set(input.taskIds).size === input.taskIds.length, "Task IDs must be unique");

/** Explicit owner action only. No task is deleted, duplicated or retroactively required. */
export async function startCommitmentToday(userId: string, input: z.infer<typeof startCommitmentInput>) {
  return db.transaction(async tx => {
    const [profile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, userId));
    if (!profile?.onboardedAt) throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
    const day = localDate(profile.timezone);
    if (day !== input.expectedDate) throw new ORPCError("CONFLICT", { message: "The date changed. Refresh before starting your commitment." });
    const month = day.slice(0, 7);
    const selected = await tx.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), inArray(s.tasks.id, input.taskIds)));
    if (selected.length !== input.taskIds.length) throw new ORPCError("NOT_FOUND", { message: "Commitment tasks not found" });
    if (input.month !== nextMonth(month) || selected.some(t => t.mode !== "challenge")) throw new ORPCError("BAD_REQUEST", { message: "Only next month's Challenge tasks can be started early." });
    // A same-day exact retry after a lost response must not duplicate tasks or depend on contact status.
    if (selected.every(t => t.month === month && t.startDate === day)) return { month, startDate: day, taskIds: selected.map(t => t.id) };
    if (selected.some(t => t.month !== input.month || t.startDate !== `${input.month}-01`)) throw new ORPCError("CONFLICT", { message: "These tasks changed. Refresh your commitment before starting it." });
    const [futureLock] = await tx.select().from(s.commitments).where(and(eq(s.commitments.userId, userId), eq(s.commitments.month, input.month)));
    if (!futureLock?.confirmedAt) throw new ORPCError("FORBIDDEN", { message: "Confirm your scheduled commitment first." });
    await requireChallengeContact(userId, tx);
    const previous = await tx.select({ id: s.completions.id }).from(s.completions).where(inArray(s.completions.taskId, input.taskIds)).limit(1);
    if (previous.length) throw new ORPCError("CONFLICT", { message: "Tasks with completion history cannot be moved." });
    const current = await tx.select({ id: s.tasks.id }).from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.month, month)));
    const [currentLock] = await tx.select().from(s.commitments).where(and(eq(s.commitments.userId, userId), eq(s.commitments.month, month)));
    if (current.length && !currentLock?.confirmedAt) throw new ORPCError("CONFLICT", { message: "Confirm your current draft tasks first. Starting Challenge will not silently commit your drafts." });
    if (current.length + selected.length > 10) throw new ORPCError("BAD_REQUEST", { message: "Starting these tasks would exceed 10 tasks this month." });
    await tx.update(s.tasks).set({ month, startDate: day }).where(and(eq(s.tasks.userId, userId), inArray(s.tasks.id, input.taskIds)));
    if (!currentLock) await tx.insert(s.commitments).values({ userId, month, confirmedAt: new Date() });
    else if (!currentLock.confirmedAt) await tx.update(s.commitments).set({ confirmedAt: new Date() }).where(eq(s.commitments.id, currentLock.id));
    // Remove only an empty month lock, never a task or a lock protecting remaining tasks.
    const remaining = await tx.select({ id: s.tasks.id }).from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.month, input.month))).limit(1);
    if (!remaining.length) await tx.delete(s.commitments).where(eq(s.commitments.id, futureLock.id));
    await tx.update(s.profiles).set({ mode: "challenge" }).where(eq(s.profiles.userId, userId));
    return { month, startDate: day, taskIds: selected.map(t => t.id) };
  });
}
