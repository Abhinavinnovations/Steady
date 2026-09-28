import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as s from "../database/schema";
import { localDate } from "./dates";
import { validDate } from "../../shared/recurrence";
import { requireChallengeContact } from "./challenge-contact";
import { createFingerprint, replayCreate } from "./create-request";

// Namespace explicitly added commitments in the existing unique request ledger.
// This persists their next-full-day email policy without changing older tasks.
export const COMMITMENT_ADD_PREFIX = "commitment-add:";
export const addCommitmentInput = z.object({
  requestId: z.string().uuid(),
  expectedDate: z.string().refine(validDate),
  title: z.string().trim().min(2).max(80),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  categoryId: z.number().int().optional(),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  reminderEnabled: z.boolean().optional(),
});

export async function addCommitmentTask(userId: string, input: z.infer<typeof addCommitmentInput>) {
  return db.transaction(async tx => {
    const requestId = COMMITMENT_ADD_PREFIX + input.requestId;
    const fingerprint = createFingerprint(input);
    const lookup = async () => (await tx.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.createRequestId, requestId))))[0];
    const saved = await lookup();
    // Resolve an exact lost-response retry even after midnight or contact removal.
    if (saved) return replayCreate(saved, fingerprint);
    const [profile] = await tx.select().from(s.profiles).where(eq(s.profiles.userId, userId));
    if (!profile?.onboardedAt) throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first." });
    const day = localDate(profile.timezone);
    if (day !== input.expectedDate) throw new ORPCError("BAD_REQUEST", { message: "The date changed. Refresh your commitment before adding this task." });
    const month = day.slice(0, 7);
    const [lock] = await tx.select().from(s.commitments).where(and(eq(s.commitments.userId, userId), eq(s.commitments.month, month)));
    if (!lock?.confirmedAt) throw new ORPCError("FORBIDDEN", { message: "Confirm your current commitment first." });
    const existing = await tx.select().from(s.tasks).where(and(eq(s.tasks.userId, userId), eq(s.tasks.month, month)));
    if (!existing.some(t => t.mode === "challenge")) throw new ORPCError("FORBIDDEN", { message: "Start your Challenge commitment before adding tasks here." });
    await requireChallengeContact(userId, tx);
    if (existing.length >= 10) throw new ORPCError("BAD_REQUEST", { message: "This month already has 10 tasks. Keep it sustainable." });
    if (input.categoryId != null) {
      const [category] = await tx.select().from(s.categories).where(and(eq(s.categories.userId, userId), eq(s.categories.id, input.categoryId)));
      if (!category) throw new ORPCError("BAD_REQUEST", { message: "Unknown category." });
    }
    const [created] = await tx.insert(s.tasks).values({
      userId, createRequestId: requestId, createFingerprint: fingerprint,
      month, startDate: day, mode: "challenge", title: input.title,
      durationMinutes: input.durationMinutes ?? null, categoryId: input.categoryId ?? null,
      scheduledTime: input.scheduledTime ?? null,
      reminderEnabled: !!input.scheduledTime && !!input.reminderEnabled,
    }).onConflictDoNothing().returning();
    const result = created ?? await lookup();
    if (!result) throw new ORPCError("CONFLICT", { message: "Save not confirmed. Retry this task unchanged." });
    return replayCreate(result, fingerprint);
  });
}

export function eligibleForCommitmentEmail(task: { startDate: string; createRequestId: string | null }, day: string) {
  return task.startDate <= day && (!task.createRequestId?.startsWith(COMMITMENT_ADD_PREFIX) || task.startDate < day);
}
