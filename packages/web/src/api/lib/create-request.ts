import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
/** Order-independent fingerprint of explicitly submitted fields (not time-dependent defaults). */
export function createFingerprint(input: Record<string, unknown>) {
  const entries = Object.entries(input).filter(([k,v]) => k !== "requestId" && v !== undefined).sort(([a],[b]) => a.localeCompare(b));
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}
export function replayCreate<T extends { createFingerprint: string | null }>(row: T, fingerprint: string): T {
  if (row.createFingerprint !== fingerprint) throw new ORPCError("CONFLICT", { message: "This save already created a task with different details. Close the draft and check Today before editing it." });
  return row;
}
