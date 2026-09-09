# Steady — Build Log

Everything applied to the app so far, round by round: **what** was built and **how** it works under the hood. Companion to the [README](../README.md) (what the app is) and the [database guide](../database-guide.md) (how to manage data).

Cost of everything below: **$0** — Turso free tier, Resend free tier, Expo dev, no paid services.

---

## Round 1 — Core app

The foundation: auth, the monthly commitment model, and the daily loop.

**Auth & accounts** — better-auth email/password. Mobile talks to the API with bearer-token sessions (token captured from the `set-auth-token` response header and attached to every request by the typed oRPC client in `packages/mobile/lib/api.ts`). Every API procedure behind `middleware/auth.ts`, which resolves the session and injects `context.user` — no procedure can forget to check auth because the middleware is the entry point.

**Profiles** — `profiles` table: display name, **timezone** (captured at onboarding — this anchors what "today" means for you, so a completion at 11pm in your timezone counts for the right day), and mode (`basic` / `challenge`).

**The monthly commitment lock** — `commitments` table, one row per user per `YYYY-MM`. Onboarding walks you through picking tasks, then confirming — `confirmedAt` is the lock. After that:
- `tasks.create` still works (add any time, up to 10)
- `tasks.remove` returns FORBIDDEN for the confirmed month — enforced server-side, not just hidden in the UI

**Tasks & completions** — `tasks` are month-scoped with a `startDate`, so a task added mid-month never generates retroactive misses. `completions` has a unique constraint on (task, local date) and a **mandatory note** (min 10 chars) validated server-side — the checkbox literally does not exist without words.

**Streaks** — computed live in `lib/streak.ts` from completion history, never stored. Can't drift, can't go stale, and at this scale reads are instant.

**Screens** — welcome → sign in/up → onboarding (mode, timezone, tasks, confirm) → tabs: Today (progress ring + task list + note sheet), Progress, Profile.

## Round 2 — Glass UI + partners

**Visual restyle** — the "liquid glass" aesthetic, done with Expo-native equivalents (the reference repos were web-only): `expo-blur` glass cards with a soft gradient backdrop, muted lavender palette (`#7A73C9`/`#8B85D6`), floating glass tab bar. All tokens centralized in `theme.ts`; design direction recorded in `design.md`.

**Partner system** — `partners` + `nudges` tables, `routes/partners.ts`:
- Invite by email — requires challenge mode **and** a verified email; one partner max; self-invite blocked
- Invitee must accept before seeing anything (matched by session email, lowercase)
- After accepting, a partner sees only `highLevelStatus()`: display name, streak, today done/not, consistency %, missed-yesterday — **never** task titles or notes
- One gentle nudge per missed day, deduped by unique (partner, missedDate)

**Email service** — `services/email.ts`, a Resend wrapper with a shared template. No API key configured → it logs a warning and skips instead of crashing, so the whole app runs email-free until a key is added.

**Email verification** — better-auth `emailVerification` with send-on-signup and auto-sign-in after verifying.

## Round 3 — Leaderboards + badges + rollover

**Leaderboards** — `routes/leaderboard.ts`, computed live. Grouped three ways so rankings are fair: mode (basic/challenge) × time range (week/month/year) × **task-count band** (1 / 2 / 3+ tasks — someone with one task can't outrank someone juggling five by default). Score = fully-completed days, computed against each caller's timezone. Ties break by streak, then name. Opt-out flag on the profile (`leaderboardOptOut`) and zero-task players excluded.

**Badges** — `badges` table, 6 codes, **lazily awarded**: checked and granted on read, never revoked. No cron, no background jobs — the $0 pattern used throughout.

**Rollover** — "Reuse last month's tasks" on the unconfirmed-month card copies the previous month's task list into onboarding for one-tap recommit.

**Mobile** — new Ranks tab (mode/range segments, band chips, glass rows with your row highlighted), badges grid on Progress (earned = colored + date, unearned = dimmed + how to get it).

## Round 4 — Accountability contact + timers + polish

**Accountability contact** (distinct from a partner) — `accountability_contacts` + `miss_alerts` tables, `routes/accountability.ts`:
- One external contact per user, verified with a 6-digit code (30-min TTL), self-email blocked
- When you miss a day, they get an email. **How, with no cron on $0:** `services/miss-sweep.ts` is a *lazy sweep* — it rides on normal `today.get` traffic, throttled to once per 15 minutes per server process, and dedupes with an insert-first unique constraint on (user, missedDate). The app's own usage powers its background job.
- Challenge onboarding gained a mandatory "Who keeps you honest?" step; existing challenge users get a nag card on Today until verified.

**Focus timers** — tasks carry optional `durationMinutes` (5–480), set with a snapping watch-style wheel (haptic + tick per detent). Full-screen timer screen (`app/timer/[taskId].tsx`): keyword-matched backdrop image, mono countdown, pause/resume/stop, keep-awake. Natural finish routes back to Today with `?note=<taskId>`, auto-opening the note sheet — the timer flows straight into the mandatory note.

**Theme & boot** — Light/Dark/Auto toggle (persisted), and a first-open boot animation: cursive "steady" drawn stroke-by-stroke (~2.6s), quick fade on later opens.

## Round 4.1 — Add-task UI (user-reported gap)

Tasks could be added mid-month via API but there was no UI. Added `add-task-sheet.tsx` (title + optional focus-time wheel) behind a dashed "Add a task" button at the bottom of Today — visible only when the month is confirmed and under the 10-task cap (server enforces the cap too). Footer states the contract: *"Counts from today. Tasks can be added any time — removing waits for next month."*

## Round 5 — Resumable timers + database guide

**Timer resume persistence** — leave a timer mid-session and it picks up where you left off:
- Remaining seconds saved to AsyncStorage, keyed `steady.timer.<taskId>.<localDate>`
- Saved on pause, stop, screen unmount, **and** a 5-second checkpoint while ticking (so even a force-kill loses ≤5s)
- Cleared on natural finish; stale prior-day keys cleaned on open; new day = fresh full duration
- Reopening shows "Resumed — X already done today" with the partial progress bar

**`database-guide.md`** — maps a Supabase-style plan onto the live stack (Turso + Drizzle), explains the RLS-equivalent (client never touches the DB; every query scoped to `context.user.id` in authed procedures), and documents the schema-change workflow (`db:push` / `db:generate` / `db:migrate`) plus a one-liner Bun inspect script.

## Round 6 — Admin console + GitHub

**Admin DB console** — full data control from the browser at `/admin` on the web app:
- **Server** (`routes/admin.ts`): three procedures gated by an `ADMIN_KEY` env check (not user sessions — it's an owner tool). `tables` lists every table with live counts; `rows` browses any table newest-first, paginated; `query` runs **raw SQL** — SELECT/UPDATE/DELETE/ALTER all work — returning columns, rows (capped at 500), rows affected, and query time. Table names validated against the live table list to block injection through the browse path.
- **Client** (`pages/admin.tsx`): key gate (stored in localStorage, never in a URL), tables sidebar, paginated row browser, Run SQL tab, "Lock console" to clear the key.

**GitHub** — repo initialized and pushed to `github.com/Abhinavinnovations/Steady` (public). Before pushing: admin key redacted from public docs, internal scratchpad excluded, real `.env` git-ignored (only the blank `.env.template` is committed). Co-management workflow: you push → tell me → I pull; I commit + push after each round.

**README** — full front-page documentation: concept, feature table, stack, repo layout, data model, setup.

---

## Recurring patterns (the "how" behind everything)

- **$0 by design** — no cron/queues/websockets anywhere. Background work (miss alerts, badge awards) is lazy: computed or triggered on normal read traffic with throttles and unique-constraint dedupe.
- **Server-enforced rules** — the lock, the note minimum, the task cap, partner privacy: all enforced in API procedures. The UI reflects the rules; it never *is* the rules.
- **Timezone-anchored days** — every "today" calculation uses the profile timezone, so streaks and misses are correct for the user, not the server.
- **Typed end-to-end** — Drizzle schema → oRPC procedures → typed client → TanStack Query hooks → screens. A schema change that breaks a screen fails `tsc`, not production.
- **Verified every round** — each round ends with `tsc` + lint + `bun run build` clean, plus a live end-to-end pass in the running app (real signups, real DB rows, screenshots) before delivery.

## Round 7 (Part 1) — Today split: consistent tasks + to-dos, categories, schedules

The Today page is now two lists with different contracts:

**Consistent tasks** (top) — the month-locked ones. Only these count for the ring, streaks, and rankings. New per-task settings: a daily time, a local reminder, an optional category, and focus time — all editable any time via the ⋮ menu. The title stays locked once the month is confirmed (same stealth-swap prevention as before; the edit sheet shows it as a fixed header, not an input).

**To-dos** (below, "no streak, no pressure") — casual, temporary items. Date + optional time + optional reminder, no repeat, deletable any time, no note on completion, and they never touch streaks or leaderboards. They stay on the list until done or deleted — no midnight expiry. To-dos due later than today are stored but kept off the Today list (a Calendar view is coming next).

**Categories** — user-created, never hardcoded, shared by both lists (max 20). Filter chips appear above the lists only when categories exist; "All" is the default. Create inline from either sheet; long-press a chip to delete — items keep existing and just lose the label (set-null in both tables, enforced in the API since SQLite ALTER TABLE can't retrofit the FK clause).

**Reminders** — `expo-notifications` *local* notifications: scheduled on-device, zero servers, zero cost. Daily triggers for consistent tasks, one-shot date triggers for to-dos. On web they're a silent no-op (browsers can't schedule OS notifications from a preview) — the sheets say so inline.

**Timers for to-dos** — the same full-screen resumable timer now takes `?type=todo`: separate storage key, and a natural finish checks the to-do off automatically — no note, since notes belong to the consistent list.

Two bugs found by end-to-end testing, worth recording:
- **Sheet state wipe** — both add/edit sheets reset their fields in an effect keyed on the `editing` prop, which is a fresh object every parent render. Any background query refetch while a sheet was open silently reverted in-progress edits (a category pick vanished before save). Fix: reset only on the closed→open transition.
- **Missing FK in live DDL** — `tasks.category_id` was added with `ALTER TABLE ADD COLUMN`, which in SQLite can't carry the `ON DELETE SET NULL` clause the schema declares. Category deletes nulled to-dos (fresh table, real FK) but not tasks. Fix: the API nulls both tables explicitly before deleting — correct regardless of FK state.

As always: `tsc` + lint + `bun run build` clean, and every flow above exercised live against the real DB before delivery.
