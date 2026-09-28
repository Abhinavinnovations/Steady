# Steady web and API

This package serves the Hono API and React web companion from one managed port. The primary product interface is the Expo app in `packages/mobile`.

## Entry points

- `/api/rpc/*`: typed oRPC procedures for tasks, commitments, Today, calendar, contacts and other features.
- `/api/auth/*`: Better Auth account/session endpoints.
- `/invitation`: account-free recipient Accept/Decline/Stop flow. Opening a link does not record acceptance.
- `/admin`: privileged database console, gated separately by `ADMIN_KEY`.
- `/`: web companion and navigation.

User routes enforce session ownership. Recipient routes use capability-based authorization; admin routes use a privileged key. Do not assume every procedure has the same authorization model.

## Development

From the repository root:

```bash
bun install
bun run dev
```

Use the single root `.env` and the assigned port from `__ports.cjs`. Do not create a package-local environment file or change managed plumbing to resolve a port conflict.

The mobile client's effective API URL must point at the intended backend. Verify it before using a cloned project with real accounts.

## Checks

From the repository root:

```bash
bun run typecheck
bun run lint
bun run build
bun test packages/mobile/lib packages/web/src/shared
```

These commands do not create an installable mobile release. Database migration and production publishing are separate operations.

## Source map

| Directory | Responsibility |
| --- | --- |
| `src/api/routes` | Feature procedures and authorization boundaries |
| `src/api/lib` | Commitment rules, activation/additions, dates and streaks |
| `src/api/services` | Provider selection, invitation delivery, consent and missed-day alerts |
| `src/api/database` | Application/auth schema and managed database client |
| `src/shared` | Shared recurrence and assistant rules |
| `src/web` | React screens, queries and recipient UI |
| `public` | Web-served fonts, images and other static assets |
| `migrations` | Reviewed standalone SQL, separate from Drizzle's generated journal |

## Operational notes

- The missed-day sweep is triggered by Today traffic. It checks yesterday in the owner's timezone and is not a midnight scheduler.
- New active-Challenge tasks are immediately completable, but their partial first day cannot by itself cause a missed-day email.
- Gmail SMTP and Resend are explicit alternatives. Missing or invalid configuration must not be interpreted as successful delivery.
- Keep credentials, recipient capabilities and private backups out of browser bundles and Git.
- `db:push` changes the configured database. Read the migration guide before touching populated data.

See the [main README](../../README.md), [email setup](../../EMAIL_SETUP.md), [database guide](../../database-guide.md) and [build history](../../docs/build-log.md).
