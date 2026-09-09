import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

export function useAccountability() {
  return useQuery(orpc.accountability.get.queryOptions({ retry: false }));
}

export function useSetContact() {
  const qc = useQueryClient();
  return useMutation(
    orpc.accountability.set.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: orpc.accountability.key() }),
    }),
  );
}

export function useVerifyContact() {
  const qc = useQueryClient();
  return useMutation(
    orpc.accountability.verify.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: orpc.accountability.key() }),
    }),
  );
}

export function useResendContactCode() {
  const qc = useQueryClient();
  return useMutation(
    orpc.accountability.resend.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: orpc.accountability.key() }),
    }),
  );
}

export function useRemoveContact() {
  const qc = useQueryClient();
  return useMutation(
    orpc.accountability.remove.mutationOptions({
      onSuccess: () =>
        qc.invalidateQueries({ queryKey: orpc.accountability.key() }),
    }),
  );
}
