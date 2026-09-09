# Steady — Round 2: glass UI restyle + partner features

## User asked
1. UI: reference react-three-fiber / liquid-glass-js / shadergradient / liquid-logo — but simple, professional, calm, NO bold colors, easy on eyes. (Repos are web-only → implement the aesthetic with Expo-native equivalents: expo-blur glass + soft layered gradients.)
2. Partner: invite by email, must accept before seeing anything, missed-day nudge, one VERIFIED account per user, Basic private, partner sees only high-level status.

## Done this round
- ask_secrets sent for RESEND_API_KEY — NOT yet provided (email degrades gracefully, check `grep RESEND /home/user/steady/.env` later)
- bun add resend (web), expo install expo-blur (mobile)
- services/email.ts — Resend wrapper + emailShell template, no-key = warn + skip
- auth.ts — emailVerification (sendOnSignUp, autoSignInAfterVerification, styled email)
- routes/partners.ts — get / invite / respond / remove / nudge
  - highLevelStatus(): displayName, streak, todayStatus, consistency %, missedYesterday — NEVER tasks/notes
  - invite: requires challenge mode + verified email, one partner, self-invite blocked, declined rows replaced
  - respond: invitee matched by session email (lowercase), verified required; accept emails owner
  - nudge: only if missedYesterday, unique per (partnerId, missedDate) via nudges table
- router composed (+partners), web tsc clean

## Round 2 COMPLETE (2026-09-08) — all TODOs done, E2E passed, delivered
- Glass restyle: theme.ts muted palette (#7A73C9/#8B85D6 + glass tokens), gradient-backdrop.tsx, glass-card.tsx, floating glass tab bar (TAB_BAR_CLEARANCE=104), restyled welcome/sign-in/sign-up/onboarding/today/progress/profile. design.md updated.
- Partner tab (app/(tabs)/partner.tsx) + queries/partners.ts hooks — all states implemented.
- Checks: mobile+web tsc clean, lint clean, build clean.
- E2E verified via mb (screenshots /tmp/s1-s17.png):
  - Maya: basic-mode private card → switch to challenge → invited leo@steady.test → pending+cancel card
  - Leo: signed up (leo@steady.test / steady1234, challenge, 1 task locked), verified via scripts/verify-emails.ts (run from ROOT: `bun --env-file=/home/user/steady/.env run packages/web/scripts/verify-emails.ts`)
  - Leo accepted → "You keep honest" card shows Maya streak 1 / Today: done / 100% consistent — NO tasks/notes leaked
  - Nudge correctly hidden (Maya didn't miss yesterday) — untested live, error paths exist server-side
  - Maya's side shows accepted partner + Remove; Profile shows Email verified row + Challenge badge
  - Email graceful skip confirmed in /tmp/steady-web.log ("RESEND_API_KEY missing — skipped ...")
- RESEND_API_KEY still NOT provided — real emails start when user submits the secrets form.

## Test accounts
- maya@steady.test / steady1234 — challenge, verified, 2 tasks, today complete, partnered with Leo
- leo@steady.test / steady1234 — challenge, verified, 1 task ("Stretch 5 minutes"), partnered with Maya
- beastman9956@gmail.com — user's real account, basic, DON'T TOUCH

## Round 3 COMPLETE (2026-09-08) — rollover polish + badges + leaderboards
- Schema: profiles.leaderboardOptOut (default false) + badges table (unique userId+code) — pushed to Turso (manual ALTER for the column, db:push confirmed in sync)
- API: routes/leaderboard.ts (get: mode basic/challenge × range week/month/year × bucket 1/2/3+, score = full days in caller-tz-correct ranges, tiebreak streak→name, opt-out + 0-task players excluded, MAX_PLAYERS 100), routes/badges.ts (6 codes, lazily awarded on get, never revoked), profile.update accepts leaderboardOptOut. Router composed.
- Mobile: new Ranks tab (podium icon, between Progress and Partner) — mode/range segments, bucket chips, glass list rows (rank/name/taskCount/full days/flame streak, isMe highlight), empty state, "Appear on leaderboards" switch + privacy note; badges grid on Progress (earned = colored + date, unearned = 45% opacity + description); "Reuse last month's tasks" outline button on unconfirmed-month card (copyPrevious → onboarding?step=tasks); removed stale "Coming soon" card on Profile.
- Checks: web+mobile tsc clean, lint clean, build clean.
- E2E via mb (screenshots /tmp/r1-r7.png): Ranks defaults to Maya's mode (challenge) + bucket (2 tasks), Maya rank 1 / 1 full day / streak 1; bucket "1 task" shows only Leo (0 days) — no cross-bucket leakage; opt-out toggle hides Maya + shows hidden note, toggling back restores; Basic board empty as expected; Progress badges: "First full day" earned Sep 8, rest muted. Rollover button code-reviewed (month confirmed → untestable live mid-month).
- ⚠️ edit-tool silently dropped 3 edits this session — always verify with rg after editing.

## Round 4 COMPLETE (2026-09-08) — accountability contact + task timers + UI polish
- Schema (pushed to Turso): tasks.duration_minutes (nullable int 5–480), accountability_contacts (one per user, 6-digit code, 30-min TTL, verified_at), miss_alerts (unique userId+missedDate dedupe).
- API: routes/accountability.ts (get/set/verify/resend/remove — self-email blocked, contact ≠ partner), services/miss-sweep.ts ($0 "lazy sweep": rides on today.get traffic, 15-min module throttle, insert-first dedupe, emails verified contacts on missed days), tasks create/copyPrevious/current carry durationMinutes.
- Mobile:
  - lib/theme-context.tsx + rewritten use-color-scheme hooks — Light/Dark/Auto toggle on Profile, persisted (steady.themeMode).
  - components/boot-splash.tsx — first open: cursive "steady" Hershey-script dash-draw (~2.6s) then fade; later opens: quick fade (steady.hasBooted flag).
  - components/duration-wheel.tsx — snapping watch-style wheel (ITEM_H 42, "No timer" + 5–480 min), tick.mp3 + haptic per detent; in onboarding tasks step ("Focus time (optional)").
  - app/timer/[taskId].tsx — full-screen timer: keyword-matched bundled image (6 in assets/timer/), mono countdown, progress bar, pause/resume/stop, keep-awake; natural finish → Today with ?note=<taskId> auto-opening the NoteSheet.
  - Today: duration chip + play button on incomplete timed tasks; nag card for challenge users without verified contact (links Profile).
  - Onboarding challenge path: mandatory contact step ("Who keeps you honest?") before tasks; Partner tab mode-switch gated by inline AccountabilitySetup.
  - Glass polish: LinearGradient top-highlight on glass-card.
- Checks: web+mobile tsc clean, lint clean (fixed exhaustive-deps in timer via extracted `armed` bool), build clean.
- E2E via mb (screenshots /tmp/e2e-*.png, boot video /tmp/e2e-boot.mp4): boot draw + quick-fade both verified; Dark toggle applies app-wide and persists on reload; Maya added coach@steady.test → code 390459 read from DB → verified card + nag gone; email graceful-skip logged; duration wheel snapped to 5 min (scrolled via JS scrollTop — mouse wheel/drag don't move RN-web FlatList); "Stretch break" 5-min task created (task id 23, left in place for demo); timer full flow: 04:58 countdown → pause froze at 04:42 → resume → stop returned to Today; /?note=23 opened NoteSheet ("Mark done" + 10-char min).
- Maya left in dark mode with verified contact + one incomplete timed task (richer demo state).
- RESEND_API_KEY still NOT provided — all emails (verify + miss alerts) warn+skip until the secrets form is submitted. SMS deferred (paid).

## Future phases (none scoped)
- All originally-scoped V1 features done. Web frontend still untouched template.
- SMS miss alerts (Twilio) deferred until user is ready to pay.

## Env/infra notes
- Dev servers in tmux: steady-web (4200), steady-mobile (4300) — likely still running; vite hot-reloads API
- WEBSITE_URL=https://steady-7wy0t47-preview-4200.runable.site/
- Test acct exists: maya@steady.test / steady1234 (onboarded, 2 tasks locked, today complete)

## Round 4.1 — Add-task UI (user-reported gap)
- Gap: months could only grow via API, but there was no UI to add a task after confirming the month.
- New: `packages/mobile/components/add-task-sheet.tsx` — AddTaskSheet bottom sheet ("Raise the bar / Add a task"): title input (2–80 chars), optional DurationWheel focus time, footer hint "Counts from today. Tasks can be added any time — removing waits for next month."
- Edited `packages/mobile/app/(tabs)/index.tsx`: dashed "Add a task" button at the bottom of Today's task list — visible only when month confirmed and under the 10-task cap (hidden at cap; server enforces too). Wires `useCreateTask`, omits durationMinutes when "No timer".
- Server unchanged: `tasks.create` already handles mid-month adds (startDate = today, no retroactive misses); `tasks.remove` still FORBIDDEN once confirmed.
- Verified: mobile tsc clean, lint clean, build clean. E2E on :4300 (Maya): button renders, sheet opens, typed "Drink 2L water", wheel → 10 min, submit → sheet closes, ring 2/3 → 2/4, task on Today with 10-min chip + play.

## Round 5 — DB guide + resumable timer
1. Database question: no code change needed — DB already live (Turso libsql + Drizzle, $0). Wrote `/home/user/steady/database-guide.md`: maps the user's Supabase plan 1:1 to existing schema (users→user+profiles, plan lock→commitments, completions, streaks computed live, partners+nudges), explains RLS-equivalent (authed oRPC scoped by context.user.id), db:push/generate/migrate workflow, bun inspect script, phase-in list.
2. Resumable timer (`packages/mobile/app/timer/[taskId].tsx` rewritten): remaining seconds persisted to AsyncStorage keyed `steady.timer.<taskId>.<localDate>` (localDate from today.get). Saves on pause/stop/unmount + 5s checkpoint during ticking; cleared on natural finish; stale prior-day keys for the task removed on open; "Resumed — X already done today" hint shown when resuming. New day = fresh full duration.
- Verified: mobile tsc clean, lint clean, build clean. E2E on :4300 (Maya, new day Sept 9, 0/4): started 10-min "Drink 2L water", ran ~20s, stop → reopened at 09:24/10:00 with resume hint + partial progress bar.
