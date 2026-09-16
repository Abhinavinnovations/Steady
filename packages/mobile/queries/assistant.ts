import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

export function useAssistantParseMany() {
  return useMutation(orpc.assistant.parseMany.mutationOptions());
}

/** Legacy single-draft caller. */
export function useAssistantParse() {
  return useMutation(orpc.assistant.parse.mutationOptions());
}
