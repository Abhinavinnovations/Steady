# Steady

**A consistency app.** Pick your tasks for the month, lock them in, and show up every day. Steady is deliberately strict where it matters: commitments can't be quietly edited away, and every completion requires a written note — so a streak means something.

Built to run entirely on free tiers. Total infrastructure cost: **$0**.

---

## The core idea

Most habit apps let you delete a habit the moment it gets hard. Steady doesn't.

1. **Commit monthly.** At the start of a month you choose your tasks (up to 10) and confirm the plan. Once confirmed, tasks can be **added** any time during the month — but never removed until the next month.
2. **Notes are mandatory.** Marking a task done requires a short note (min 10 characters) about how it went. No silent checkbox tapping.
3. **Streaks are computed, not stored.** Your streak is derived live from your actual completion history — it can't drift or go stale.

## Features

| Area | What it does |
|---|---|
| **Monthly commitment lock** | One plan per user per month (`YYYY-MM`). Confirming is the lock: add tasks freely, remove nothing until next month. Mid-month adds start counting from the day they're added — no retroactive misses. |
| **Today view** | Daily ring showing progress (e.g. 3/4), task list with completion state, dashed "Add a task" button (hidden at the 10-task cap). |
| **Mandatory notes** | Every completion stores a note. Unique per task per local day — your timezone anchors what "today" means. |
| **Focus timer** | Tasks can carry a duration (set via a wheel picker). Full-screen countdown timer with pause/stop, and **resume persistence**: leave mid-session and the remaining time is saved per task per day ("Resumed — X already done today"). Fresh day = fresh timer. |
| **Streaks & badges** | Live-computed streaks; badges awarded lazily and never revoked. |
| **Leaderboards** | Grouped by mode (basic / challenge) and task-count band, with an opt-out. |
| **Partners** | Invite a partner by email; they see minimal status after accepting and can send one gentle nudge per missed day. |
| **Accountability contact** | A verified external email (not a partner) that gets notified when you miss a day — enforced by a lazy sweep on the daily fetch, no cron needed. |
| **Modes & themes** | Basic vs. challenge mode, dark/light theme toggle, cursive boot animation. |
| **Admin console** | Key-gated `/admin` page on the web app: browse every table with live counts, paginate rows, and run raw SQL against the live database (results capped at 500 rows, timing shown). |

## Tech stack

Monorepo (Bun workspaces + Turborepo), typed end-to-end.

- **Mobile** (primary): Expo + React Native + expo-router, TanStack Query, AsyncStorage for timer persistence
- **API**: Hono + [oRPC](https://orpc.unnoq.com/) procedures, served from the web package at `/api/rpc/*`
- **Database**: Turso (hosted SQLite / libSQL) via Drizzle ORM — free tier
- **Auth**: better-auth (email/password), bearer-token sessions on mobile
- **Web**: React 19 + Vite 7 + Wouter (hosts the API and the admin console)
- **Email**: Resend (free tier) for verification codes and miss alerts — logs-and-skips when no API key is set

## Repository layout

```
steady/
├─ packages/
│  ├─ web/                  # single port: React web app (/) + Hono API (/api/*)
│  │  └─ src/
│  │     ├─ api/
│  │     │  ├─ routes/      # one oRPC file per feature (tasks, today, streaks,
│  │     │  │               #   leaderboard, partners, contacts, admin, ...)
│  │     │  ├─ database/schema.ts   # Drizzle schema — single source of truth
│  │     │  ├─ middleware/auth.ts   # session guard; scopes queries to user id
│  │     │  └─ lib/         # streak computation, local-date helpers, email
│  │     └─ web/
│  │        ├─ pages/admin.tsx      # admin DB console
│  │        └─ queries/             # TanStack Query wrappers
│  └─ mobile/
│     ├─ app/               # expo-router screens (tabs, timer/[taskId], onboarding)
│     ├─ components/        # add-task-sheet, duration wheel, rings, ...
│     └─ queries/           # typed hooks over the oRPC client
├─ database-guide.md        # how the DB works + how to manage it (console, CLI, schema changes)
├─ design.md                # design direction shared by all platforms
└─ .env.template            # copy to .env and fill in
```

## Data model

Tables (see `packages/web/src/api/database/schema.ts`):

- `user`, `session`, `account`, `verification` — better-auth
- `profiles` — timezone, display name, mode (basic/challenge), leaderboard opt-out
- `commitments` — one per user per month; `confirmedAt` is the lock
- `tasks` — month-scoped, optional `durationMinutes`, `startDate` for mid-month adds
- `completions` — the daily record; mandatory note, unique per task per local date
- `partners`, `nudges` — invites and daily nudges
- `accountability_contacts`, `miss_alerts` — verified contact + alert log
- `badges` — lazily awarded

Security model: the client never touches the database. Every query runs inside an authed oRPC procedure filtered by the session's user id — the row-level-security guarantee, enforced one layer up.

## Getting started

```bash
bun install
cp .env.template .env        # fill in DATABASE_URL, DATABASE_AUTH_TOKEN,
                             # BETTER_AUTH_SECRET, ADMIN_KEY (any strong string),
                             # optionally RESEND_API_KEY

bun run dev                  # web + API  → http://localhost:4200
bun run dev:mobile           # Expo       → http://localhost:4300
```

Schema changes, from `packages/web`:

```bash
bun run db:push        # sync schema (fine for new tables)
bun run db:generate    # or generate a migration
bun run db:migrate     # and apply it (safer for altering populated tables)
```

Admin console: open `/admin` on the web app and enter the value of `ADMIN_KEY` from your `.env`. Full SQL access to the live database — there is no undo.

More detail on all of the above in [`database-guide.md`](./database-guide.md).

## Conventions

- All environment variables live in the single root `.env` (git-ignored; `.env.template` documents the keys)
- One oRPC route file per feature; every query filters by `context.user.id`
- Mobile dependencies are installed with `bunx expo install` (never plain `bun add`) so versions match the Expo SDK
- Files/folders prefixed `__` are template-managed plumbing — don't edit

---

Built by **Abhinavinnovations** (EAM LLC · HPAOC2016™).
