import { z } from "zod";
import { REPEATS, validDate } from "./recurrence";

export const MAX_VOICE_DRAFTS = 20;
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const assistantInput = z.object({
  transcript: z.string().trim().min(2).max(2000).optional(),
  audioBase64: z.string().max(MAX_AUDIO_BYTES * 1.4).optional(),
  mimeType: z.enum(["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/webm", "audio/wav", "audio/mpeg", "audio/ogg"]).optional(),
});
export type AssistantInput = z.infer<typeof assistantInput>;
export const draftSchema = z.object({
  kind: z.enum(["consistent", "todo"]),
  repeat: z.enum(REPEATS).default("none"),
  title: z.string().trim().min(2).max(80),
  durationMinutes: z.number().int().min(5).max(480).nullish(),
  date: z.string().refine(validDate, "Invalid calendar date").nullish(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(),
  reminder: z.boolean().nullish(),
  categoryName: z.string().trim().max(40).nullish(),
});
export const batchSchema = z.object({
  transcript: z.string().trim().max(2000).default(""),
  drafts: z.array(draftSchema).min(1).max(MAX_VOICE_DRAFTS),
  overflow: z.boolean().optional(),
});
export function normalizeDraft(draft: z.infer<typeof draftSchema>, today: string, categories: string[]) {
  return {
    kind: draft.kind,
    repeat: draft.kind === "todo" ? draft.repeat : "none" as const,
    title: draft.title,
    durationMinutes: draft.durationMinutes ?? null,
    date: draft.kind === "todo" ? (draft.date ?? today) : null,
    time: draft.time ?? null,
    reminder: draft.reminder ?? false,
    categoryName: categories.find(c => c.toLowerCase() === draft.categoryName?.toLowerCase()) ?? null,
  };
}
export type AssistantDraft = ReturnType<typeof normalizeDraft>;
export function extractJson(text: string): unknown {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const start = clean.indexOf("{"); const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object");
  return JSON.parse(clean.slice(start, end + 1));
}
