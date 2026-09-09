# Steady — Database Guide

Short version: **the database is already connected and live.** Every signup, task,
note, streak and invite you've seen in the app is real data in a hosted database —
not mock data. This guide maps your Supabase plan onto what exists, and shows you
how to manage it.

## What you're actually running

| Your plan | What's live |
|---|---|
| Supabase Postgres | **Turso** (hosted SQLite/libSQL) via **Drizzle ORM** — provisioned automatically, free tier, $0 |
| Email auth | **better-auth** email/password, already wired on mobile + web |
| Row-level security | Server-side equivalent (see below) |
| Free-tier hosting | Already the setup — API + DB + app all on free tiers |

Connection lives in the root `.env` (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`).
Never commit or share these; deployments ship the same `.env`.

Why not Supabase? This managed project keeps DB, API and auth in one deployable
unit — swapping in Supabase would add a second service to manage without adding
capability at this scale. Because Drizzle is the ORM, the schema is portable to
Postgres later if you ever outgrow Turso's free tier (500 DBs, 9GB storage —
years away at V1 scale).

## Your data model vs. what exists

Your proposed tables, mapped (schema file: `packages/web/src/api/database/schema.ts`):

| You proposed | Live table | Notes |
|---|---|---|
| users | `user` (better-auth) + `profiles` | timezone (anchors the "local day"), mode basic/challenge, display name, leaderboard opt-out |
| monthly task plan + lock | `commitments` | one row per user per `YYYY-MM`; `confirmedAt` = the lock. Confirmed months: tasks can be added, never removed |
| tasks (title, target, reminder, active) | `tasks` | month-scoped, optional `durationMinutes` (timer), `startDate` so mid-month adds don't create retroactive misses |
| daily completions with notes | `completions` | note is **mandatory** (min 10 chars) — the core loop rule; unique per task per local date |
| streak snapshots | computed live (`lib/streak.ts`) | intentionally not a table — at V1 scale computing on read is instant and can't go stale. Add snapshots only if leaderboard queries get slow (thousands of users) |
| leaderboard views | live queries (`routes/leaderboard.ts`) | grouped by mode + task-count band; same reasoning — precompute later, not now |
| partner invites | `partners` + `nudges` | invite by email, accept/decline, one gentle nudge per missed day |
| — (you didn't have this) | `accountability_contacts` + `miss_alerts` | verified external email that gets told when you miss a day |
| — | `badges` | lazy-awarded, never revoked |

Your phased build order (screens → auth → lock → today+notes → streaks → leaderboard
→ partner → badges) is essentially the shipped feature list. You're past the plan.

## The RLS question

Supabase needs row-level security because the client talks to the database
directly. Here the client **never** touches the DB — everything goes through
typed oRPC procedures in `packages/web/src/api/routes/`, and every procedure
runs behind the auth middleware (`middleware/auth.ts`) which scopes queries to
the session's user id. A partner sees only minimal status after accepting —
enforced in `routes/partners.ts`, same guarantee as RLS, one layer up.

Rule to keep: **every new query in a route must filter by `context.user.id`.**
That's your RLS.

## How to manage it

**Change the schema:** edit `schema.ts`, then from `packages/web`:

```bash
bun run db:push        # sync schema to the live DB (fine for new tables)
bun run db:generate    # or: generate a migration file
bun run db:migrate     # and apply it (safer for altering existing tables)
```

Caution: `db:push` prompts interactively when altering columns on tables with
data — prefer generate/migrate for those.

**Inspect data** with a quick Bun script from the repo root:

```bash
bun --env-file=.env -e '
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL!, authToken: process.env.DATABASE_AUTH_TOKEN });
const r = await db.execute("SELECT id, title, month, duration_minutes FROM tasks ORDER BY id DESC LIMIT 10");
console.table(r.rows);'
```

**Add a feature end-to-end:** table in `schema.ts` → procedure file in
`src/api/routes/` → compose into `src/api/index.ts` → mobile hook in
`packages/mobile/queries/` → screen. That's the whole pipeline.

## What to phase in later (agreeing with your "start small")

- Voice-to-text notes: device-native speech via `expo-speech-recognition` — typed notes now, exactly as you said
- Push reminders at each task's reminder time (expo-notifications, free)
- Streak/leaderboard snapshot tables — only when live queries measurably slow down
- Email sending is wired (Resend, free tier 100/day) but needs `RESEND_API_KEY` in `.env` — currently emails log-and-skip
