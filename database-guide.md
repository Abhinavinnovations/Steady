# Steady database guide

Steady uses **Turso/libSQL with Drizzle**, accessed through the server. Mobile and web clients call typed oRPC procedures; they do not receive database credentials.

This guide describes the current code, not a guarantee about another clone's provisioned database. Keep production, development and disposable test databases separate.

## Schema map

Application schema: [`packages/web/src/api/database/schema.ts`](./packages/web/src/api/database/schema.ts). Authentication schema: [`auth-schema.ts`](./packages/web/src/api/database/auth-schema.ts).

| Tables | Purpose |
| --- | --- |
| `user`, `session`, `account`, `verification` | Better Auth accounts, sessions and verification |
| `profiles` | Display name, timezone, onboarding and leaderboard preference |
| `commitments` | One user/month plan; `confirmedAt` locks the commitment |
| `tasks` | Monthly Basic/Challenge tasks, start date, duration, category, schedule and retry identity |
| `completions` | Task completion note, unique per task/local date |
| `categories` | User-owned labels for tasks and to-dos |
| `todos`, `todo_completions` | Casual tasks, recurrence and occurrence completion |
| `partners`, `nudges` | Accountability relationships and limited nudges |
| `invitation_deliveries` | Frozen invitation attempt and delivery outcome ledger |
| `recipient_links` | Hashed public invitation/stop capabilities |
| `recipient_consents` | Explicit, versioned recipient consent and eligibility start |
| `recipient_suppressions` | Owner/recipient suppression that survives relationship removal |
| `miss_alert_deliveries` | Deduplicated missed-date alert attempts and transport outcomes |
| `accountability_contacts`, `miss_alerts` | Retained legacy contact/alert data; old claims also prevent duplicate alerts |
| `badges` | Awarded achievement records |

Streaks and leaderboard scores are calculated from history, not maintained as a separate streak snapshot table. Do not infer that an empty email ledger means a user had no missed days: consent, eligibility and traffic-triggered checks also affect delivery.

## Rules worth preserving

- Dates and month boundaries use the profile's timezone. Operational timestamps can be recorded in UTC, but a local missed date is not a UTC delivery schedule.
- The monthly task cap is 10 across Basic and Challenge. Locked tasks cannot be removed, and their focus duration cannot be reduced.
- New active-Challenge tasks can be completed today. `commitment-add:` request identities persist their first-partial-day email exemption in the existing task request ledger.
- A task's `createRequestId` and fingerprint make exact retries safe. Do not regenerate those fields to force a retry, or strip their namespace during a data cleanup.
- Explicit scheduled-commitment activation preserves task identity and history. Merely viewing a future commitment does not activate it.
- Completion notes belong to the owner. Accountability emails share a high-level missed-day status, not titles, notes or Basic tasks.
- Consent and suppression are distinct from accepted relationship status. An accepted legacy relationship does not authorize new missed-day email enrollment.

Implementation references: [`add-commitment.ts`](./packages/web/src/api/lib/add-commitment.ts), [`start-commitment.ts`](./packages/web/src/api/lib/start-commitment.ts), [`miss-sweep.ts`](./packages/web/src/api/services/miss-sweep.ts), and [email setup](./EMAIL_SETUP.md).

## Authorization boundaries

User procedures use session authentication and owner filters. Public recipient endpoints use limited capabilities for inspecting an invitation and explicitly responding. Admin procedures require a separate `ADMIN_KEY` and intentionally allow privileged SQL.

These are **application-layer authorization controls**, not SQLite row-level security. New endpoints must select the appropriate authorization boundary and enforce ownership of every referenced row. Do not assume that importing an oRPC router automatically makes every procedure authenticated.

## Connecting safely

Set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in the single root `.env`. The managed client reads that configuration. Never put database access tokens in Expo public settings or browser code.

Before running tests or scripts:

1. Confirm whether the database is disposable or live, without printing its credentials.
2. Use isolated fixtures for regression tests. Do not create real users or send real emails merely to validate a UI change.
3. Keep private backups outside the repository with restricted permissions.
4. Start with read-only inspection and obtain explicit authorization for live mutations.

## Migration workflow

### Existing populated database

1. Inspect the current schema and applied migration state.
2. Make a consistent backup, restore it privately and verify integrity, foreign keys and row counts or hashes.
3. Test the exact proposed SQL on the restored copy.
4. Review destructive operations and changes to existing rows.
5. Apply only the needed migration through an authorized database workflow.
6. Independently recheck schema, integrity and preserved data after commit.

Never treat `db:push` as a harmless inspection command. It changes the configured database.

### Drizzle-generated migrations

From `packages/web`, using a deliberately selected environment:

```bash
bun run db:generate   # Generate migration artifacts for review
bun run db:migrate    # Apply the generated migration journal to the configured database
```

The output directory configured by `drizzle.config.ts` is `./drizzle`. For a new disposable database, `bun run db:push` can synchronize the current schema after you have confirmed the target. It is not a substitute for a reviewed production migration.

### Standalone additive migrations

These reviewed SQL files are in `packages/web/migrations/`, not the generated Drizzle journal:

- `20260925_invitation_deliveries.sql`
- `20260927_recipient_consent.sql`

They were already applied to the existing configured Steady database during the earlier rollout. Do not replay them blindly. On another database, inspect existing objects and apply only missing changes after the backup/review procedure. `bun run db:migrate` does not automatically discover these standalone files.

The September 28 active-Challenge addition uses existing task fields and requires no additional schema migration.

## Admin console

Open `/admin` on your actual web/API origin. Set a strong `ADMIN_KEY` in the root `.env`; without it the console refuses access. Do not publish the key in documentation, URLs or screenshots.

The console can list tables, browse rows and execute SQL, including writes and schema changes. Query results are capped at 500 rows, but that is **not a write limit**. There is no undo. Prefer read-only queries and review mutations before execution.

The browser stores the key locally for subsequent requests. Use **Lock console** when finished and avoid shared or untrusted browsers. The key is sent to the API for authorization; it is not confined to local storage.

## GitHub and deployment

Repository: [Abhinavinnovations/Steady](https://github.com/Abhinavinnovations/Steady).

Fetch and review incoming changes before committing. Preserve managed files, assigned ports and Expo identity. Commit source, reviewed migration SQL and safe documentation, not `.env`, database files, backups, recipient links or local test evidence.

A GitHub push updates source control only. It does not apply SQL, migrate accounts, publish a mobile build or activate an email provider. Publishing and environment configuration are separate operations.
