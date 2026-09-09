import { z } from "zod";
import { eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import {
  generateText,
  type FilePart,
  type ModelMessage,
  type TextPart,
} from "ai";
import dedent from "dedent";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { localDate } from "../lib/dates";
import { gateway } from "../agent/gateway";

/**
 * Voice add — one cheap multimodal call turns "add gym at 4 for an hour,
 * daily" into a structured draft. The server only PARSES; the client shows
 * the draft, the user confirms, and creation goes through the normal
 * tasks.create / todos.create mutations (reminders are device-local, so
 * they must be scheduled by the client anyway).
 */

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // ~8 MB ≈ a couple of minutes of m4a

const draftSchema = z.object({
  kind: z.enum(["consistent", "todo"]),
  title: z.string().trim().min(2).max(80),
  durationMinutes: z.number().int().min(5).max(480).nullish(),
  /** To-dos only — "YYYY-MM-DD". */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  /** "HH:mm" 24h. */
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullish(),
  reminder: z.boolean().nullish(),
  categoryName: z.string().trim().max(40).nullish(),
  transcript: z.string().trim().max(2000).nullish(),
});

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start)
    throw new Error("no JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export const assistant = {
  parse: authed
    .input(
      z.object({
        /** Already-transcribed speech (web Speech API) or typed text. */
        transcript: z.string().trim().min(2).max(2000).optional(),
        /** Raw recording (native) — base64, transcribed by the model itself. */
        audioBase64: z.string().max(MAX_AUDIO_BYTES * 1.4).optional(),
        mimeType: z.string().max(80).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      if (!input.transcript && !input.audioBase64)
        throw new ORPCError("BAD_REQUEST", {
          message: "Say something or type it",
        });

      const [p] = await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, context.user.id));
      if (!p?.onboardedAt)
        throw new ORPCError("FORBIDDEN", { message: "Finish onboarding first" });

      const cats = await db
        .select({ name: schema.categories.name })
        .from(schema.categories)
        .where(eq(schema.categories.userId, context.user.id));

      const today = localDate(p.timezone);
      const system = dedent`
        You turn one spoken sentence into a Steady item. Steady has two kinds:
        - "consistent": a daily habit done every day this month (e.g. "gym daily", "read every day")
        - "todo": a one-off errand for a specific day (e.g. "buy milk tomorrow")

        Today is ${today} (timezone ${p.timezone}).
        User's existing categories: ${cats.length > 0 ? cats.map((c) => c.name).join(", ") : "(none)"}.

        Reply with ONE JSON object, nothing else:
        {
          "kind": "consistent" | "todo",
          "title": string (2-80 chars, short imperative, e.g. "Gym"),
          "durationMinutes": number | null (5-480, only if a duration was said),
          "date": "YYYY-MM-DD" | null (todos only; resolve "tomorrow"/"friday" from today; null for consistent),
          "time": "HH:mm" | null (24h; "4 o'clock" with no am/pm = pick the likelier hour, e.g. gym at 16:00),
          "reminder": boolean | null (true if they asked to be reminded / gave a time for it),
          "categoryName": string | null (ONLY an existing category that clearly fits, else null),
          "transcript": string (what the user said, cleaned up — transcribe first if you got audio)
        }

        Cues: "daily", "every day", "daily task" => consistent. A specific date/day or one-shot errand => todo.
        If they gave a time, set reminder true unless they said otherwise. Never invent a duration.
      `;

      const userContent: Array<TextPart | FilePart> = [];
      if (input.audioBase64) {
        const bytes = Buffer.from(input.audioBase64, "base64");
        if (bytes.byteLength > MAX_AUDIO_BYTES)
          throw new ORPCError("BAD_REQUEST", {
            message: "Recording too long — keep it under a minute",
          });
        userContent.push({
          type: "file",
          data: bytes,
          mediaType: input.mimeType ?? "audio/mp4",
        });
        userContent.push({
          type: "text",
          text: "Transcribe this recording, then produce the JSON.",
        });
      } else {
        userContent.push({ type: "text", text: input.transcript! });
      }

      let raw: string;
      try {
        const messages: ModelMessage[] = [
          { role: "user", content: userContent },
        ];
        const { text } = await generateText({
          model: gateway("google/gemini-3-flash"),
          instructions: system,
          messages,
        });
        raw = text;
      } catch (e) {
        console.error("[assistant] gateway call failed:", e);
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Couldn't reach the assistant — try again",
        });
      }

      let draft;
      try {
        draft = draftSchema.parse(extractJson(raw));
      } catch (e) {
        console.error("[assistant] bad model output:", raw, e);
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Didn't catch that — try rephrasing",
        });
      }

      return {
        draft: {
          kind: draft.kind,
          title: draft.title,
          durationMinutes: draft.durationMinutes ?? null,
          date: draft.kind === "todo" ? (draft.date ?? today) : null,
          time: draft.time ?? null,
          reminder: draft.reminder ?? false,
          categoryName: draft.categoryName ?? null,
        },
        transcript: draft.transcript ?? input.transcript ?? "",
      };
    }),
};
