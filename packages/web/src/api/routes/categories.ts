import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { authed } from "../middleware/auth";
import { db } from "../database";
import * as schema from "../database/schema";

/**
 * User-defined categories (work, study, wishlist, ...) — never hardcoded.
 * Shared by consistent tasks and temporary todos.
 */
export const categories = {
  list: authed.handler(async ({ context }) => {
    return db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.userId, context.user.id))
      .orderBy(schema.categories.name);
  }),

  create: authed
    .input(z.object({ name: z.string().trim().min(1).max(30) }))
    .handler(async ({ context, input }) => {
      const name = input.name.trim();
      const existing = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.userId, context.user.id));
      if (existing.length >= 20)
        throw new ORPCError("BAD_REQUEST", { message: "Max 20 categories" });
      const dupe = existing.find(
        (c) => c.name.toLowerCase() === name.toLowerCase(),
      );
      if (dupe) return dupe;
      const [row] = await db
        .insert(schema.categories)
        .values({ userId: context.user.id, name })
        .returning();
      return row;
    }),

  /** Delete a category — tasks/todos keep existing, just lose the label (FK set null). */
  remove: authed
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const [row] = await db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.id, input.id),
            eq(schema.categories.userId, context.user.id),
          ),
        );
      if (!row) throw new ORPCError("NOT_FOUND");
      // Null the label explicitly — the tasks table's category_id column was
      // added via ALTER TABLE, so its ON DELETE SET NULL FK isn't in the live
      // DDL. App-level nulling keeps behavior correct regardless of FK state.
      await db
        .update(schema.tasks)
        .set({ categoryId: null })
        .where(eq(schema.tasks.categoryId, row.id));
      await db
        .update(schema.todos)
        .set({ categoryId: null })
        .where(eq(schema.todos.categoryId, row.id));
      await db
        .delete(schema.categories)
        .where(eq(schema.categories.id, row.id));
      return { ok: true };
    }),
};
