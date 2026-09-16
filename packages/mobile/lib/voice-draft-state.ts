import type { AssistantDraft } from "../../web/src/shared/assistant-draft";
import { validDate } from "./recurrence";
export type VoicePayload = {
  requestId: string; title: string; durationMinutes?: number; scheduledTime?: string;
  reminderEnabled: boolean; categoryId?: number;
  dueDate?: string; repeat?: AssistantDraft["repeat"]; mode?: "basic";
};
export type VoiceCard = AssistantDraft & {
  localId: string; categoryId: number | null; selected: boolean;
  status: "editable" | "saving" | "saved" | "rejected" | "unknown";
  payload?: VoicePayload; savedId?: number; error?: string; diagnostic?: string;
};
export function validCard(card: VoiceCard, today: string) {
  return card.title.trim().length >= 2 && card.title.trim().length <= 80 &&
    (card.kind !== "todo" || validDate(card.date ?? today));
}
export function freezePayload(card: VoiceCard, requestId: string, today: string): VoicePayload {
  return {
    requestId, title: card.title.trim(),
    ...(card.durationMinutes != null ? { durationMinutes: card.durationMinutes } : {}),
    ...(card.time ? { scheduledTime: card.time } : {}),
    reminderEnabled: !!(card.time && card.reminder),
    ...(card.categoryId != null ? { categoryId: card.categoryId } : {}),
    ...(card.kind === "todo" ? { dueDate: card.date ?? today, repeat: card.repeat } : { mode: "basic" }),
  };
}
export const editableCard = (card: VoiceCard) => card.status === "editable" || card.status === "rejected";
export const definitiveRejection = (code?: string) => ["BAD_REQUEST", "FORBIDDEN", "UNAUTHORIZED", "NOT_FOUND"].includes(code ?? "");
/** A deadline does not cancel a server write. Retain its ID for an unchanged retry. */
export async function withDeadline<T>(work: Promise<T>, milliseconds = 20_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("The save response timed out"), { code: "TIMEOUT" })), milliseconds); })]);
  } finally { clearTimeout(timer); }
}
export type VoiceReceipt = { kind: VoiceCard["kind"]; localId: string; payload: VoicePayload };
export function recoverCard(receipt: VoiceReceipt): VoiceCard {
  const p = receipt.payload;
  return { localId: receipt.localId, kind: receipt.kind, title: p.title, repeat: p.repeat ?? "none", date: p.dueDate ?? null,
    time: p.scheduledTime ?? null, durationMinutes: p.durationMinutes ?? null, reminder: p.reminderEnabled,
    categoryName: null, categoryId: p.categoryId ?? null, selected: true, status: "unknown", payload: p,
    error: "An earlier save was interrupted. Check its status or retry unchanged; Steady reuses the same save ID." };
}
