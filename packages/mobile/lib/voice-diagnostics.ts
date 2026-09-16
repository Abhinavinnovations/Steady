import { Platform } from "react-native";
/** Content-free device diagnostics. No tokens, user IDs, transcripts, titles, or audio. */
export function voiceDiagnostic(stage: string, kind: string, requestId?: string, code?: string) {
  const safeCode = (code ?? "OK").replace(/[^A-Z0-9_]/gi, "").slice(0, 40);
  const reference = `VOICE/${Platform.OS}/${stage}/${kind}/${requestId?.slice(0, 8) ?? "new"}/${safeCode}`;
  console.info(reference);
  return reference;
}
