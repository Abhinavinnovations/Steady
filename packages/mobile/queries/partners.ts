import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

export function usePartner() {
  return useQuery(
    orpc.partners.get.queryOptions({ retry: false, refetchInterval: 60_000 }),
  );
}

export function useInvitePartner() {
  const qc = useQueryClient();
  return useMutation(
    orpc.partners.invite.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.partners.key() }),
    }),
  );
}

export function useRespondInvite() {
  const qc = useQueryClient();
  return useMutation(
    orpc.partners.respond.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.partners.key() }),
    }),
  );
}

export function useRemovePartner() {
  const qc = useQueryClient();
  return useMutation(
    orpc.partners.remove.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.partners.key() }),
    }),
  );
}

export function useNudge() {
  const qc = useQueryClient();
  return useMutation(
    orpc.partners.nudge.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.partners.key() }),
    }),
  );
}
