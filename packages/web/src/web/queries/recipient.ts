import { useMutation } from "@tanstack/react-query";
import { orpc } from "../lib/api";

// Mutations enforce POST and avoid bearer secrets in query keys/cache URLs.
// Tokens live only in memory; reopen the email after a browser refresh.
export function useInspectRecipient() {
  return useMutation(orpc.recipient.inspect.mutationOptions({ retry: false, gcTime: 0 }));
}
export function useRespondRecipient() {
  return useMutation(orpc.recipient.respond.mutationOptions({ retry: false, gcTime: 0 }));
}
