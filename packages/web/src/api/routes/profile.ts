import { z } from "zod";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { isValidTimezone } from "../lib/dates";

async function getOrNull(userId: string) {
  const [p] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId));
  return p ?? null;
}

export const profile = {
  /** Current user's profile, or null when onboarding hasn't happened yet. */
  get: authed.handler(async ({ context }) => {
    const p = await getOrNull(context.user.id);
    return p
      ? { ...p, email: context.user.email, name: context.user.name }
      : null;
  }),

  /** Finish onboarding: pick mode, capture timezone. Idempotent. */
  onboard: authed
    .input(
      z.object({
        mode: z.enum(["basic", "challenge"]),
        timezone: z.string().min(1).max(64),
        displayName: z.string().max(50).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const tz = isValidTimezone(input.timezone) ? input.timezone : "UTC";
      const displayName =
        input.displayName?.trim() || context.user.name || "Anonymous";
      const existing = await getOrNull(context.user.id);
      if (existing) {
        const [updated] = await db
          .update(schema.profiles)
          .set({
            mode: input.mode,
            timezone: tz,
            displayName,
            onboardedAt: existing.onboardedAt ?? new Date(),
          })
          .where(eq(schema.profiles.userId, context.user.id))
          .returning();
        return updated;
      }
      const [created] = await db
        .insert(schema.profiles)
        .values({
          userId: context.user.id,
          mode: input.mode,
          timezone: tz,
          displayName,
          onboardedAt: new Date(),
        })
        .returning();
      return created;
    }),

  /** Update display name / timezone. Mode changes: basic -> challenge allowed anytime. */
  update: authed
    .input(
      z.object({
        displayName: z.string().min(1).max(50).optional(),
        timezone: z.string().min(1).max(64).optional(),
        mode: z.enum(["basic", "challenge"]).optional(),
        leaderboardOptOut: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const p = await getOrNull(context.user.id);
      if (!p) throw new ORPCError("NOT_FOUND", { message: "Onboard first" });
      const patch: Partial<typeof schema.profiles.$inferInsert> = {};
      if (input.displayName) patch.displayName = input.displayName.trim();
      if (input.timezone && isValidTimezone(input.timezone))
        patch.timezone = input.timezone;
      if (input.mode) patch.mode = input.mode;
      if (input.leaderboardOptOut !== undefined)
        patch.leaderboardOptOut = input.leaderboardOptOut;
      const [updated] = await db
        .update(schema.profiles)
        .set(patch)
        .where(eq(schema.profiles.userId, context.user.id))
        .returning();
      return updated;
    }),
};
