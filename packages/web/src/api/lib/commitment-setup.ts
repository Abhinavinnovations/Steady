import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { localDate, localMonth } from "./dates";
import { createFingerprint, replayCreate } from "./create-request";
export const setupInput = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  tasks: z.array(z.object({ requestId: z.string().uuid(), title: z.string().trim().min(2).max(80), durationMinutes: z.number().int().min(5).max(480).optional() })).min(1).max(10),
}).refine(i => new Set(i.tasks.map(t => t.requestId)).size === i.tasks.length, "Every task needs a distinct save ID");
/** Only final explicit Challenge confirmation calls this. All writes commit together. */
export async function confirmSetup(userId: string, input: z.infer<typeof setupInput>) {
  return db.transaction(async tx => {
    const [profile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, userId));
    if (!profile?.onboardedAt) throw new ORPCError("FORBIDDEN", { message: "Choose a mode first" });
    const month = localMonth(profile.timezone);
    if (month !== input.month) throw new ORPCError("CONFLICT", { message: "The month changed. Check Today before confirming a new commitment." });
    const list = await tx.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.month, month)));
    const [commitment] = await tx.select().from(s.commitments).where(and(eq(s.commitments.userId, userId), eq(s.commitments.month, month)));
    const pending = [];
    for (const task of input.tasks) {
      const fingerprint = createFingerprint({ ...task, mode: "challenge" });
      const [saved] = await tx.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.createRequestId, task.requestId)));
      if (saved) { replayCreate(saved, fingerprint); if (saved.month !== month) throw new ORPCError("CONFLICT", { message: "This save belongs to another month. Check Today." }); }
      else pending.push({ task, fingerprint });
    }
    if (commitment?.confirmedAt) {
      if (pending.length === 0) return commitment;
      throw new ORPCError("FORBIDDEN", { message: "This month is already locked. Existing commitments are unchanged; add further tasks from Today." });
    }
    const [contact] = await tx.select({ id: s.partners.id }).from(s.partners).where(and(eq(s.partners.ownerId, userId), eq(s.partners.status, "accepted")));
    if (!contact) throw new ORPCError("FORBIDDEN", { message: "Challenge requires an accepted accountability contact. Invite someone in Profile and wait for them to accept." });
    if (list.length + pending.length > 10) throw new ORPCError("BAD_REQUEST", { message: "Max 10 tasks per month — existing tasks are included." });
    for (const { task, fingerprint } of pending) await tx.insert(s.tasks).values({ userId, month, title: task.title, durationMinutes: task.durationMinutes ?? null, mode: "challenge", startDate: localDate(profile.timezone), createRequestId: task.requestId, createFingerprint: fingerprint });
    const values = { confirmedAt: new Date() };
    const [confirmed] = commitment
      ? await tx.update(s.commitments).set(values).where(eq(s.commitments.id, commitment.id)).returning()
      : await tx.insert(s.commitments).values({ userId, month, ...values }).returning();
    await tx.update(s.profiles).set({ mode: "challenge" }).where(eq(s.profiles.userId, userId));
    return confirmed;
  });
}
