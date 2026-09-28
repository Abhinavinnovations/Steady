import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { localDate, localMonth } from "./dates";
import { createFingerprint, replayCreate } from "./create-request";

export function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
}
export const setupInput = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  tasks: z.array(z.object({ requestId: z.string().uuid(), title: z.string().trim().min(2).max(80), durationMinutes: z.number().int().min(5).max(480).optional() })).min(1).max(10),
}).refine(i => new Set(i.tasks.map(t => t.requestId)).size === i.tasks.length, "Every task needs a distinct save ID");

export async function challengeSetupState(userId: string) {
  const [p] = await db.select().from(s.profiles).where(eq(s.profiles.userId, userId));
  if (!p?.onboardedAt) throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
  const currentMonth = localMonth(p.timezone);
  const following = nextMonth(currentMonth);
  const locks = await db.select().from(s.commitments).where(and(eq(s.commitments.userId, userId), inArray(s.commitments.month, [currentMonth, following])));
  const list = await db.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), inArray(s.tasks.month, [currentMonth, following]))).orderBy(s.tasks.id);
  const currentLocked = locks.some(c => c.month === currentMonth && c.confirmedAt);
  const hasActiveChallenge = currentLocked && list.some(t => t.month === currentMonth && t.mode === "challenge");
  // Reopening a saved commitment is a daily task view, not automatically next month's setup.
  const month = currentLocked && !hasActiveChallenge ? following : currentMonth;
  return {
    currentMonth, month, scheduled: month !== currentMonth,
    startDate: month === currentMonth ? localDate(p.timezone) : `${month}-01`,
    confirmed: locks.some(c => c.month === month && !!c.confirmedAt),
    tasks: list.filter(t => t.month === month),
    upcoming: list.filter(t => t.month === following && t.mode === "challenge"),
  };
}

/** Atomic final confirmation; future entries are stored but inactive until startDate. */
export async function confirmSetup(userId: string, input: z.infer<typeof setupInput>) {
  return db.transaction(async tx => {
    const [profile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, userId));
    if (!profile?.onboardedAt) throw new ORPCError("FORBIDDEN", { message: "Choose a mode first" });
    const currentMonth = localMonth(profile.timezone);
    const [currentLock] = await tx.select().from(s.commitments).where(and(eq(s.commitments.userId, userId), eq(s.commitments.month, currentMonth)));
    const target = currentLock?.confirmedAt ? nextMonth(currentMonth) : currentMonth;
    const [commitment] = await tx.select().from(s.commitments).where(and(eq(s.commitments.userId, userId), eq(s.commitments.month, input.month)));
    const pending = [];
    for (const task of input.tasks) {
      // Preserve legacy fingerprint shape for exact replay of already-open clients.
      const fingerprint = createFingerprint({ ...task, mode: "challenge" });
      const [saved] = await tx.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.createRequestId, task.requestId)));
      if (saved) {
        replayCreate(saved, fingerprint);
        if (saved.month !== input.month) throw new ORPCError("CONFLICT", { message: "This save belongs to another month. Check Today." });
      } else pending.push({ task, fingerprint });
    }
    // Exact replay must work after a month boundary or contact removal.
    if (!pending.length && commitment?.confirmedAt) return commitment;
    if (input.month !== target) throw new ORPCError("CONFLICT", { message: "The commitment month changed. Reopen setup to review the new start date." });
    if (commitment?.confirmedAt) throw new ORPCError("FORBIDDEN", { message: "These commitments are already locked. Existing tasks stay unchanged." });
    const [contact] = await tx.select({ id: s.partners.id }).from(s.partners).where(and(eq(s.partners.ownerId, userId), eq(s.partners.status, "accepted")));
    if (!contact) throw new ORPCError("FORBIDDEN", { message: "Challenge requires an accepted accountability contact. Invite someone in Profile and wait for them to accept." });
    const list = await tx.select({ id: s.tasks.id }).from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.month, target)));
    if (list.length + pending.length > 10) throw new ORPCError("BAD_REQUEST", { message: "Max 10 tasks per month, including Basic and Challenge." });
    for (const { task, fingerprint } of pending) await tx.insert(s.tasks).values({ userId, month: target, title: task.title, durationMinutes: task.durationMinutes ?? null, mode: "challenge", startDate: target === currentMonth ? localDate(profile.timezone) : `${target}-01`, createRequestId: task.requestId, createFingerprint: fingerprint });
    const values = { confirmedAt: new Date() };
    const [confirmed] = commitment
      ? await tx.update(s.commitments).set(values).where(eq(s.commitments.id, commitment.id)).returning()
      : await tx.insert(s.commitments).values({ userId, month: target, ...values }).returning();
    if (target === currentMonth) await tx.update(s.profiles).set({ mode: "challenge" }).where(eq(s.profiles.userId, userId));
    return confirmed;
  });
}
