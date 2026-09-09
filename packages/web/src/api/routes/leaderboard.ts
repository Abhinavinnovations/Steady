import { z } from "zod";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localMonth, shiftDay } from "../lib/dates";
import { computeDayStatuses, activeStreak } from "../lib/streak";

/**
 * Leaderboards are split two ways so they stay fair:
 * - by mode (basic vs challenge) — different stakes, different boards
 * - by task-count bucket (1 / 2 / 3+ tasks) — more tasks is harder
 * Score = full days (every task done) inside the range, computed in each
 * player's own timezone. Opt-out hides a user from every board.
 */

const MAX_PLAYERS = 100;

type Bucket = 1 | 2 | 3;

function bucketOf(taskCount: number): Bucket {
  return taskCount <= 1 ? 1 : taskCount === 2 ? 2 : 3;
}

export const leaderboard = {
  get: authed
    .input(
      z.object({
        mode: z.enum(["basic", "challenge"]),
        range: z.enum(["week", "month", "year"]),
        /** 1 = one task, 2 = two tasks, 3 = three or more. Defaults to caller's bucket. */
        bucket: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const [me] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, context.user.id));
      if (!me?.onboardedAt)
        throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });

      // Caller's own bucket (current month, their timezone) — used as default.
      const myMonth = localMonth(me.timezone);
      const myTasks = await db
        .select({ id: schema.tasks.id })
        .from(schema.tasks)
        .where(
          and(
            eq(schema.tasks.userId, context.user.id),
            eq(schema.tasks.month, myMonth),
          ),
        );
      const myBucket: Bucket = bucketOf(Math.max(myTasks.length, 1));
      const bucket: Bucket = input.bucket ?? myBucket;

      // Everyone on this board: onboarded, same mode, not opted out.
      const players = await db
        .select()
        .from(schema.profiles)
        .where(
          and(
            eq(schema.profiles.mode, input.mode),
            eq(schema.profiles.leaderboardOptOut, false),
            isNotNull(schema.profiles.onboardedAt),
          ),
        )
        .limit(MAX_PLAYERS);

      // Current-month task counts, one query for all players.
      const counts = new Map<string, number>();
      if (players.length > 0) {
        const taskRows = await db
          .select({ userId: schema.tasks.userId, month: schema.tasks.month })
          .from(schema.tasks)
          .where(
            inArray(
              schema.tasks.userId,
              players.map((p) => p.userId),
            ),
          );
        const monthByUser = new Map(
          players.map((p) => [p.userId, localMonth(p.timezone)]),
        );
        for (const t of taskRows) {
          if (monthByUser.get(t.userId) === t.month)
            counts.set(t.userId, (counts.get(t.userId) ?? 0) + 1);
        }
      }

      // Keep only players with tasks this month, in the requested bucket.
      const inBucket = players.filter((p) => {
        const n = counts.get(p.userId) ?? 0;
        return n > 0 && bucketOf(n) === bucket;
      });

      const scored = [];
      for (const p of inBucket) {
        const { today, statuses } = await computeDayStatuses(
          p.userId,
          p.timezone,
        );
        let start: string;
        if (input.range === "week") start = shiftDay(today, -6);
        else if (input.range === "month") start = `${today.slice(0, 7)}-01`;
        else start = shiftDay(today, -364);

        let score = 0;
        for (const [d, s] of statuses) {
          if (s === "complete" && d >= start && d <= today) score++;
        }
        scored.push({
          userId: p.userId,
          displayName: p.displayName || "Anonymous",
          taskCount: counts.get(p.userId) ?? 0,
          score,
          streak: activeStreak(today, statuses),
        });
      }

      scored.sort(
        (a, b) =>
          b.score - a.score ||
          b.streak - a.streak ||
          a.displayName.localeCompare(b.displayName),
      );

      return {
        mode: input.mode,
        range: input.range,
        bucket,
        myMode: me.mode,
        myBucket,
        optedOut: me.leaderboardOptOut,
        entries: scored.map((s, i) => ({
          rank: i + 1,
          displayName: s.displayName,
          taskCount: s.taskCount,
          score: s.score,
          streak: s.streak,
          isMe: s.userId === context.user.id,
        })),
      };
    }),
};
