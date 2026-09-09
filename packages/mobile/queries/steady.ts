import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

export function useProfile() {
  return useQuery(orpc.profile.get.queryOptions({ retry: false }));
}

export function useOnboard() {
  const qc = useQueryClient();
  return useMutation(
    orpc.profile.onboard.mutationOptions({
      onSuccess: () => qc.invalidateQueries(),
    }),
  );
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation(
    orpc.profile.update.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.profile.key() });
        qc.invalidateQueries({ queryKey: orpc.leaderboard.key() });
      },
    }),
  );
}

export function useToday() {
  return useQuery(
    orpc.today.get.queryOptions({ retry: false, refetchInterval: 60_000 }),
  );
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation(
    orpc.today.complete.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.today.key() });
        qc.invalidateQueries({ queryKey: orpc.stats.key() });
      },
    }),
  );
}

export function useUndoTask() {
  const qc = useQueryClient();
  return useMutation(
    orpc.today.undo.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.today.key() });
        qc.invalidateQueries({ queryKey: orpc.stats.key() });
      },
    }),
  );
}

export function useCurrentTasks() {
  return useQuery(orpc.tasks.current.queryOptions({ retry: false }));
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation(
    orpc.tasks.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.tasks.key() });
        qc.invalidateQueries({ queryKey: orpc.today.key() });
      },
    }),
  );
}

export function useRemoveTask() {
  const qc = useQueryClient();
  return useMutation(
    orpc.tasks.remove.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.tasks.key() });
        qc.invalidateQueries({ queryKey: orpc.today.key() });
      },
    }),
  );
}

export function useCopyPrevious() {
  const qc = useQueryClient();
  return useMutation(
    orpc.tasks.copyPrevious.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.tasks.key() });
        qc.invalidateQueries({ queryKey: orpc.today.key() });
      },
    }),
  );
}

export function useConfirmMonth() {
  const qc = useQueryClient();
  return useMutation(
    orpc.tasks.confirm.mutationOptions({
      onSuccess: () => qc.invalidateQueries(),
    }),
  );
}

export function useStats(range: "week" | "month" | "year") {
  return useQuery(
    orpc.stats.summary.queryOptions({ input: { range }, retry: false }),
  );
}
