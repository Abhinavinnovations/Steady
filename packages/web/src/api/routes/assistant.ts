import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";
import { assistantInput } from "../../shared/assistant-draft";
import { parseVoice } from "../lib/assistant-parser";

export const assistant = {
  /** Legacy shape remains valid for clients already open during the update. */
  parse: authed.input(assistantInput).handler(async ({ context, input }) => {
    const result = await parseVoice(context.user.id, input, false);
    return { transcript: result.transcript, draft: result.drafts[0]! };
  }),
  parseMany: authed.input(assistantInput).handler(({ context, input }) => parseVoice(context.user.id, input, true)),
  /** Exact, owner-scoped reconciliation; a missing result is not proof a request cannot still commit. */
  receipts: authed.input(z.object({ requestIds: z.array(z.string().uuid()).min(1).max(20) })).handler(async ({ context, input }) => {
    const [tasks, todos] = await Promise.all([
      db.select({ id: schema.tasks.id, requestId: schema.tasks.createRequestId }).from(schema.tasks).where(and(eq(schema.tasks.userId, context.user.id), inArray(schema.tasks.createRequestId, input.requestIds))),
      db.select({ id: schema.todos.id, requestId: schema.todos.createRequestId }).from(schema.todos).where(and(eq(schema.todos.userId, context.user.id), inArray(schema.todos.createRequestId, input.requestIds))),
    ]);
    return [...tasks.map(t => ({ ...t, kind: "consistent" as const })), ...todos.map(t => ({ ...t, kind: "todo" as const }))];
  }),
};
