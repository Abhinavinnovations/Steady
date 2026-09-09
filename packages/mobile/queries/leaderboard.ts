import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

export type LeaderboardMode = "basic" | "challenge";
export type LeaderboardRange = "week" | "month" | "year";
export type LeaderboardBucket = 1 | 2 | 3;

export function useLeaderboard(input: {
  mode: LeaderboardMode;
  range: LeaderboardRange;
  bucket?: LeaderboardBucket;
}) {
  return useQuery(
    orpc.leaderboard.get.queryOptions({ input, retry: false }),
  );
}

export function useBadges() {
  return useQuery(orpc.badges.get.queryOptions({ retry: false }));
}
