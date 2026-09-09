import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

/** Voice add — sends speech (transcript or raw audio) and gets a draft back. */
export function useAssistantParse() {
  return useMutation(orpc.assistant.parse.mutationOptions());
}
