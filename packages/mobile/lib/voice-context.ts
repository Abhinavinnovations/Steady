import type { VoiceCard } from "./voice-draft-state";
export type VoiceContext = "todo" | "basic-setup" | "challenge-setup";
export type StagedVoiceTask = { requestId: string; title: string; durationMinutes?: number };

/** Contextual entry is explicit: setup supports title and duration only. */
export function contextualCard(card: VoiceCard, context?: VoiceContext): VoiceCard {
  if (!context) return card;
  if (context === "todo") return { ...card, kind: "todo" };
  return { ...card, kind: "consistent", date: null, repeat: "none", time: null,
    reminder: false, categoryId: null, categoryName: null };
}
export function stageVoiceTasks(cards: VoiceCard[], available: number): StagedVoiceTask[] {
  const selected = cards.filter(c => c.selected);
  if (!selected.length) throw new Error("Select at least one commitment.");
  if (selected.length > available) throw new Error(`Room for ${Math.max(0, available)} more commitments this month. Deselect some entries.`);
  if (selected.some(c => c.title.trim().length < 2 || c.title.trim().length > 80)) throw new Error("Review the selected titles before adding them.");
  return selected.map(c => ({ requestId: c.localId, title: c.title.trim(), ...(c.durationMinutes ? { durationMinutes: c.durationMinutes } : {}) }));
}
