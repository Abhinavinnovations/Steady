import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

/** One month of scheduled things: consistent tasks, to-dos, day statuses. */
export function useCalendarMonth(month: string) {
  return useQuery(
    orpc.calendar.get.queryOptions({
      input: { month },
      retry: false,
      refetchInterval: 60_000,
    }),
  );
}
