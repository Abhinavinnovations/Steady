import { z } from "zod";
import { sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { db } from "../database";

/**
 * Owner's database console — key-gated (ADMIN_KEY in the root .env), no user
 * session needed. Powers the /admin page on the web app: list tables, browse
 * rows, run raw SQL. This is deliberate full control for the app owner; the
 * key never leaves their browser's localStorage.
 */

function requireKey(key: string) {
  const expected = process.env.ADMIN_KEY;
  if (!expected || key !== expected) {
    throw new ORPCError("UNAUTHORIZED", { message: "Wrong admin key" });
  }
}

/** JSON-safe cell values (blobs and bigints don't serialize). */
function norm(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (typeof v === "bigint") return String(v);
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return "[blob]";
  return JSON.stringify(v);
}

type Grid = { columns: string[]; rows: (string | number | null)[][] };

function toGrid(rs: { columns: string[]; rows: unknown[] }, cap = 500): Grid {
  const rows = rs.rows.slice(0, cap).map((r) => {
    const row = r as Record<number, unknown>;
    return rs.columns.map((_, i) => norm(row[i]));
  });
  return { columns: rs.columns, rows };
}

async function listTables(): Promise<string[]> {
  const rs = await db.run(
    sql.raw(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ),
  );
  return rs.rows
    .map((r) => String((r as Record<number, unknown>)[0]))
    .filter((n) => !n.startsWith("sqlite_") && !n.startsWith("__"));
}

export const admin = {
  /** All user tables with row counts. */
  tables: base
    .input(z.object({ key: z.string() }))
    .handler(async ({ input }) => {
      requireKey(input.key);
      const names = await listTables();
      const tables: { name: string; count: number }[] = [];
      for (const name of names) {
        const rs = await db.run(sql.raw(`SELECT COUNT(*) FROM "${name}"`));
        const count = Number((rs.rows[0] as Record<number, unknown>)[0] ?? 0);
        tables.push({ name, count });
      }
      return { tables };
    }),

  /** Page through one table, newest rows first. */
  rows: base
    .input(
      z.object({
        key: z.string(),
        table: z.string(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .handler(async ({ input }) => {
      requireKey(input.key);
      const names = await listTables();
      if (!names.includes(input.table)) {
        throw new ORPCError("NOT_FOUND", { message: "No such table" });
      }
      const t = `"${input.table}"`;
      const countRs = await db.run(sql.raw(`SELECT COUNT(*) FROM ${t}`));
      const total = Number((countRs.rows[0] as Record<number, unknown>)[0] ?? 0);
      let grid: Grid;
      try {
        grid = toGrid(
          await db.run(
            sql.raw(
              `SELECT * FROM ${t} ORDER BY rowid DESC LIMIT ${input.limit} OFFSET ${input.offset}`,
            ),
          ),
        );
      } catch {
        // WITHOUT ROWID tables — fall back to unordered.
        grid = toGrid(
          await db.run(
            sql.raw(`SELECT * FROM ${t} LIMIT ${input.limit} OFFSET ${input.offset}`),
          ),
        );
      }
      return { ...grid, total };
    }),

  /** Run raw SQL — full control, the owner's database. Results capped at 500 rows. */
  query: base
    .input(z.object({ key: z.string(), sql: z.string().trim().min(1).max(5000) }))
    .handler(async ({ input }) => {
      requireKey(input.key);
      const started = Date.now();
      try {
        const rs = await db.run(sql.raw(input.sql));
        return {
          ...toGrid(rs),
          rowsAffected: rs.rowsAffected ?? 0,
          ms: Date.now() - started,
        };
      } catch (e) {
        throw new ORPCError("BAD_REQUEST", {
          message: e instanceof Error ? e.message : "Query failed",
        });
      }
    }),
};
