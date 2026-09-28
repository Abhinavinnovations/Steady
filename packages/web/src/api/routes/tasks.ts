import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate, localMonth } from "../lib/dates";
import { createFingerprint, replayCreate } from "../lib/create-request";
import { requireChallengeContact } from "../lib/challenge-contact";
import { challengeSetupState, confirmSetup, setupInput } from "../lib/commitment-setup";
import { startCommitmentInput, startCommitmentToday } from "../lib/start-commitment";
import { addCommitmentInput, addCommitmentTask } from "../lib/add-commitment";

async function requireProfile(userId: string, reader: Pick<typeof db, "select"> = db) {
  const [p] = await reader
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId));
  if (!p?.onboardedAt)
    throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });
  return p;
}

async function getCommitment(userId: string, month: string, reader: Pick<typeof db, "select"> = db) {
  const [c] = await reader
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
  addCommitment: authed.input(addCommitmentInput).handler(({ context, input }) => addCommitmentTask(context.user.id, input)),
  setupState: authed.handler(({ context }) => challengeSetupState(context.user.id)),
  startToday: authed.input(startCommitmentInput).handler(({ context, input }) => startCommitmentToday(context.user.id, input)),
  confirmSetup: authed.input(setupInput).handler(({ context, input }) => confirmSetup(context.user.id, input)),
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
        requestId: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(80),
        /** Optional planned minutes for the focus timer (5 min – 8 h). */
        durationMinutes: z.number().int().min(5).max(480).optional(),
        /** Optional user category. */
        categoryId: z.number().int().optional(),
        /** Optional planned time of day "HH:mm" (24h, user's local clock). */
        scheduledTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
        /** Local reminder notification at scheduledTime. */
        flagged: z.boolean().optional(),
        reminderEnabled: z.boolean().optional(),
        /** basic = fully private; challenge = partner/contact hears about broken streaks. */
        mode: z.enum(["basic", "challenge"]).optional(),
      }),
    )
    .handler(async ({ context, input }) => db.transaction(async tx => {
      const fingerprint = createFingerprint(input);
      const lookup = async () => input.requestId ? (await tx.select().from(schema.tasks).where(and(eq(schema.tasks.userId,context.user.id),eq(schema.tasks.createRequestId,input.requestId))))[0] : undefined;
      const saved = await lookup();
      if (saved) return replayCreate(saved,fingerprint);
      const p = await requireProfile(context.user.id, tx);
      const month = localMonth(p.timezone);
      if (input.mode === "challenge") {
        const [lock] = await tx.select().from(schema.commitments).where(and(eq(schema.commitments.userId, context.user.id), eq(schema.commitments.month, month)));
        if (lock?.confirmedAt) throw new ORPCError("FORBIDDEN", { message: "This month is locked. Open Challenge setup in Profile for next month." });
        const [contact] = await tx.select({ id: schema.partners.id }).from(schema.partners).where(and(eq(schema.partners.ownerId, context.user.id), eq(schema.partners.status, "accepted")));
        if (!contact) throw new ORPCError("FORBIDDEN", { message: "Challenge needs an accepted accountability contact." });
      }
      if (input.categoryId != null) {
        const [c] = await tx
          .select({ id: schema.categories.id })
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.id, input.categoryId),
              eq(schema.categories.userId, context.user.id),
            ),
          );
        if (!c)
          throw new ORPCError("BAD_REQUEST", { message: "Unknown category" });
      }
      const existing = await tx
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
      const [task] = await tx
        .insert(schema.tasks)
        .values({
          userId: context.user.id,
          createRequestId: input.requestId,
          createFingerprint: input.requestId ? fingerprint : null,
          month,
          title: input.title.trim(),
          flagged: input.flagged ?? false,
          durationMinutes: input.durationMinutes ?? null,
          startDate: localDate(p.timezone),
          categoryId: input.categoryId ?? null,
          scheduledTime: input.scheduledTime ?? null,
          reminderEnabled: input.reminderEnabled ?? false,
          mode: input.mode ?? "basic",
        })
        .onConflictDoNothing()
        .returning();
      const result = task ?? await lookup();
      if (!result) throw new ORPCError("CONFLICT", {message:"Could not confirm the save. Retry this draft."});
      return input.requestId ? replayCreate(result,fingerprint) : result;
    })),

  /**
   * Edit schedule/category freely; committed focus duration may only increase.
   * Title never changes after the month is confirmed (that would be a stealth swap).
   */
  update: authed
    .input(
      z.object({
        id: z.number(),
        durationMinutes: z.number().int().min(5).max(480).nullable().optional(),
        categoryId: z.number().int().nullable().optional(),
        scheduledTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable()
          .optional(),
        flagged: z.boolean().optional(),
        reminderEnabled: z.boolean().optional(),
        mode: z.enum(["basic", "challenge"]).optional(),
      }),
    )
    .handler(async ({ context, input }) => db.transaction(async tx => {
      const p = await requireProfile(context.user.id, tx);
      const [task] = await tx
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.id, input.id),
            eq(schema.tasks.userId, context.user.id),
          ),
        );
      if (!task) throw new ORPCError("NOT_FOUND");
      const commitment = await getCommitment(context.user.id, task.month, tx);
      if (commitment?.confirmedAt && input.durationMinutes !== undefined &&
          (input.durationMinutes ?? 0) < (task.durationMinutes ?? 0)) {
        throw new ORPCError("FORBIDDEN", { message: "Committed focus time can only increase. It cannot be reduced or removed." });
      }
      if (input.mode && input.mode !== task.mode) {
        const lock = await getCommitment(context.user.id, task.month, tx);
        if (lock?.confirmedAt || task.startDate <= localDate(p.timezone)) throw new ORPCError("FORBIDDEN", { message: "Started or locked tasks keep their mode to preserve past results. Create a separate task." });
        if (input.mode === "challenge") await requireChallengeContact(context.user.id, tx);
      }
      if (input.categoryId != null) {
        const [c] = await tx
          .select({ id: schema.categories.id })
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.id, input.categoryId),
              eq(schema.categories.userId, context.user.id),
            ),
          );
        if (!c)
          throw new ORPCError("BAD_REQUEST", { message: "Unknown category" });
      }
      const [updated] = await tx
        .update(schema.tasks)
        .set({
          ...(input.durationMinutes !== undefined
            ? { durationMinutes: input.durationMinutes }
            : {}),
          ...(input.categoryId !== undefined
            ? { categoryId: input.categoryId }
            : {}),
          ...(input.scheduledTime !== undefined
            ? { scheduledTime: input.scheduledTime }
            : {}),
          ...(input.reminderEnabled !== undefined
            ? { reminderEnabled: input.reminderEnabled }
            : {}),
          ...(input.mode !== undefined ? { mode: input.mode } : {}),
          ...(input.flagged !== undefined ? { flagged: input.flagged } : {}),
        })
        .where(eq(schema.tasks.id, task.id))
        .returning();
      return updated;
    })),

  /** Remove a task — ONLY while the month is still a draft (not confirmed). */
  remove: authed
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => db.transaction(async tx => {
      await requireProfile(context.user.id, tx);
      const [task] = await tx
        .select()
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.id, input.id),
            eq(schema.tasks.userId, context.user.id),
          ),
        );
      if (!task) throw new ORPCError("NOT_FOUND");
      const commitment = await getCommitment(context.user.id, task.month, tx);
      if (commitment?.confirmedAt)
        throw new ORPCError("FORBIDDEN", {
          message:
            "This month is locked — tasks can't be removed until next month",
        });
      await tx.delete(schema.tasks).where(eq(schema.tasks.id, task.id));
      return { ok: true };
    })),

  /** Lock the current month. Requires at least one task. Irreversible until next month. */
  confirm: authed.handler(async ({ context }) => db.transaction(async tx => {
    const p = await requireProfile(context.user.id, tx);
    const month = localMonth(p.timezone);
    const list = await tx
      .select({ id: schema.tasks.id, mode: schema.tasks.mode })
      .from(schema.tasks)
      .where(
        and(eq(schema.tasks.userId, context.user.id), eq(schema.tasks.month, month)),
      );
    if (list.length === 0)
      throw new ORPCError("BAD_REQUEST", { message: "Add at least one task" });
    const existing = await getCommitment(context.user.id, month, tx);
    if (existing?.confirmedAt) return existing;
    if (list.some(t => t.mode === "challenge")) await requireChallengeContact(context.user.id, tx);
    if (existing) {
      if (existing.confirmedAt) return existing;
      const [updated] = await tx
        .update(schema.commitments)
        .set({ confirmedAt: new Date() })
        .where(eq(schema.commitments.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await tx
      .insert(schema.commitments)
      .values({
        userId: context.user.id,
        month,
        confirmedAt: new Date(),
      })
      .returning();
    return created;
  })),

  /** Additive rollover: Basic can join a preconfirmed future Challenge month. */
  copyPrevious: authed.handler(async ({ context }) => db.transaction(async tx => {
    const p = await requireProfile(context.user.id, tx);
    const month = localMonth(p.timezone);
    const [lock] = await tx.select().from(schema.commitments).where(and(eq(schema.commitments.userId, context.user.id), eq(schema.commitments.month, month)));
    const [y, m] = month.split("-").map(Number);
    const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
    const previous = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.userId, context.user.id), eq(schema.tasks.month, prev))).orderBy(schema.tasks.id);
    const existing = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.userId, context.user.id), eq(schema.tasks.month, month)));
    const preconfirmed = !!lock?.confirmedAt && localMonth(p.timezone, lock.confirmedAt) < month;
    if (lock?.confirmedAt && !preconfirmed) throw new ORPCError("FORBIDDEN", { message: "This month is already confirmed." });
    const key = (t: { title: string; mode: string }) => `${t.mode}:${t.title.trim().toLowerCase()}`;
    const have = new Set(existing.map(key));
    const toCopy = previous.filter(t => {
      if (have.has(key(t)) || (lock?.confirmedAt && t.mode === "challenge")) return false;
      have.add(key(t)); return true;
    });
    if (existing.length + toCopy.length > 10) throw new ORPCError("BAD_REQUEST", { message: "Copying would exceed 10 tasks this month. Add the Basic tasks you want individually." });
    if (toCopy.some(t => t.mode === "challenge")) {
      const [contact] = await tx.select({id: schema.partners.id}).from(schema.partners).where(and(eq(schema.partners.ownerId, context.user.id), eq(schema.partners.status, "accepted")));
      if (!contact) throw new ORPCError("FORBIDDEN", {message: "Challenge needs an accepted accountability contact."});
    }
    if (toCopy.length) await tx.insert(schema.tasks).values(toCopy.map(t => ({
      userId: context.user.id, month, title: t.title, durationMinutes: t.durationMinutes,
      categoryId: t.categoryId, scheduledTime: t.scheduledTime, reminderEnabled: t.reminderEnabled,
      startDate: localDate(p.timezone), mode: t.mode,
    })));
    return { copied: toCopy.length };
  })),
};
