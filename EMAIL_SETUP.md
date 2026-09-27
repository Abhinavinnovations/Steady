# Steady email setup

## Current rollout, September 27, 2026

The approved account-free flow is active using the existing free Gmail sender. New invitations contain a secure browser link to `/invitation`, with explicit Accept or Decline and a separate Stop emails link. Recipients need no Steady account or app installation. Opening a link never accepts an invitation.

Only newly and explicitly consented contacts can receive automatic Challenge missed-day emails. Existing accepted contacts retain their status but are not enrolled automatically. No old invitations were resent, no legacy contacts were enrolled, and no historical alerts were replayed. No new live test email was sent during this rollout.

Activation uses `RECIPIENT_FLOW_ENABLED=true`, `INVITATION_DELIVERY_ENABLED=true`, `MISS_ALERTS_ENABLED=true`, and `MISS_ALERTS_START_DATE=2026-09-28`. The link is the verified public HTTPS web/API entry at `https://steady-tpgwcgt-preview-4200.runable.site/invitation`, not the mobile `/profile` page. The cutoff is an eligible missed date in each owner's timezone, not a promised UTC send time. Only whole local days after acceptance qualify.

The supplied September 27 message passed SPF, DKIM and DMARC. Gmail's exact spam reason was not exposed. Plain-text invitations and clear opt-out improve clarity but do not guarantee inbox placement. Provider acceptance is not proof of receipt. A separately authorized real recipient test is still needed.

## Root `.env` only

- `EMAIL_PROVIDER=gmail`: explicitly selects Gmail SMTP. Omitted defaults to Resend; invalid values fail closed. No silent provider fallback.
- `GMAIL_USER`: authorized Gmail sender.
- `GMAIL_APP_PASSWORD`: Google App Password, never the regular account password. Submit through the secure form. Keep server-side; never log or expose to clients. Copied spaces are normalized.
- `EMAIL_FROM`: `Steady <the-authorized-gmail-address>` or that plain address. Other Gmail senders are refused. Envelope and displayed sender use the authenticated account.
- `RESEND_API_KEY`: needed only with `EMAIL_PROVIDER=resend`, along with a verified-domain `EMAIL_FROM`.
- `INVITATION_DELIVERY_ENABLED=true`: enables the invitation attempt ledger after both migrations. With absent/false flags, an invitation may be saved but no invitation email is sent, and the client reports unavailable delivery.
- `RECIPIENT_FLOW_ENABLED=true`: enables public decisions, consent and suppression. Activate only after the recipient migration. Disabling it also disables new invitation delivery and missed-day alerts; recipient preference actions become unavailable.
- `INVITATION_APP_URL`: verified public HTTPS web/API origin with exact `/invitation` path, no query, fragment, credentials or trailing slash. Never use the mobile `/profile` or backend homepage. Native deep links are not assumed.
- `MISS_ALERTS_ENABLED=true`: permits future consented alerts. To pause automated alerts while keeping Stop available, disable this flag, not the recipient flow.
- `MISS_ALERTS_START_DATE=YYYY-MM-DD`: approved earliest eligible local missed date. Use a future date for initial rollout; never backdate it to catch up missed alerts.
- `BETTER_AUTH_SECRET`: existing server secret also derives the AES-256-GCM key for new frozen invitation payloads. Do not rotate without resolving retained encrypted payloads. Wrong-key/tampered payloads fail closed. Never expose the secret or payloads.

Gmail uses TLS on `smtp.gmail.com:465`, certificate validation, bounded timeouts, no debug logging, and no message-content file or URL access. Runtime errors expose safe codes only. Gmail is for a small trial: it exposes the sender address, shares personal sending limits, and can be throttled or filtered. A verified-domain transactional provider is preferable for broader rollout, but no purchase is required here.

## Additive migrations and preservation

The September 25 standalone migration `packages/web/migrations/20260925_invitation_deliveries.sql` was already applied. It added the invitation ledger/index without changing its 17 existing tables or 405 rows. A single separately approved transport test was accepted by Gmail SMTP at 20:10 UTC that day. It did not create an invitation or prove inbox delivery.

The September 27 migration `packages/web/migrations/20260927_recipient_consent.sql` adds four tables: `recipient_links`, `recipient_consents`, `recipient_suppressions`, and `miss_alert_deliveries`. Before applying, the live database was read consistently, restored and reopened locally, and checked by row hashes, integrity and foreign keys. The migration was tested on a private disposable copy first. At commit and in an independent postcommit read, all 18 existing tables and 408 rows were unchanged; all four new tables were empty, integrity passed and foreign-key violations were zero. No backfill, reset, seed, or full schema push was used.

Both migrations are already applied to the configured database. Do not rerun them. Private backup and verification records live outside the app under `/home/user/steady-review/recipient-flow-private`, with directory mode 0700 and files 0600. They contain account data and must never be publicly uploaded or delivered. For a different database, obtain approval, make a verified backup, inspect existing objects, and apply only the required standalone additive SQL.

## Recipient capabilities and consent

- Public links use random 256-bit capabilities, separate from owner request IDs. Only SHA-256 hashes are stored in `recipient_links`. New exact retry payloads containing links are encrypted; legacy plaintext payloads remain readable but are not automatically replayed.
- Invite capabilities expire after seven days. Stop capabilities do not expire and survive relationship removal. Stop also works from expired or cancelled invite capabilities.
- Capabilities arrive in the URL fragment, are scrubbed before deferred analytics/app code, and remain only in memory. Refresh requires reopening the original email. Treat the email link as secret: anyone holding it can act as its recipient. Do not forward it or add it to logs.
- Public inspect/respond use POST; only an explicit action records a decision. No GET accepts an invitation.
- Consent version `challenge-email-v1` records acceptance time and the first whole eligible local day. Old signed-in clients without that version do not enroll recipients. Existing accepted rows never gain consent implicitly.
- Stop suppresses new invitations and alerts for that owner plus normalized recipient mailbox. It does not delete accounts, tasks or the accepted relationship, and is not a global opt-out from all Steady account mail. Suppression survives removal/reinvitation. SMTP already in flight cannot be recalled.
- Browser acceptance sends no additional notification email to the owner; owners refresh contact status. Existing signed-in acceptance notification and recipient-to-owner nudges retain their prior fire-and-forget behavior and do not have delivery receipts.

## Retry safety and automatic alerts

Gmail success requires final SMTP 250 and the intended accepted recipient. A generated Message-ID is not enough. Refusal is failed; a lost acknowledgment or timeout is unknown.

- Invitation attempts freeze provider, sender and exact payload. Old payloads without a provider are treated as Resend.
- Gmail unknown sends and expired sending leases require a manual provider check, never automatic SMTP replay. UI disables resending in that state. Provider switches do not replay uncertain attempts.
- Completed attempts are cached. Definite failures permit a new user-requested attempt after cooldown. Transactional claims and compare-and-set outcomes protect concurrent sends.
- Resend uncertain attempts can replay only the exact original payload/key within the existing 23-hour safety window while Resend stays selected. Failed retries cannot erase prior uncertainty.
- Missed-day checks run on Today traffic, at most once per 15 minutes per process, not a scheduled service. Quiet periods can skip alerts. There is no exact-time or guaranteed daily delivery.
- Checks consider yesterday only, Challenge tasks only, an accepted relationship, versioned consent, rollout cutoff and no suppression. Timezone changes cannot make the reinterpreted acceptance day eligible. Completed, rest and future-task days do not send. Task names, notes and Basic tasks stay private.
- Unique owner/date alert claims prevent duplicate attempts. The new ledger records `sending`, `accepted`, `failed`, `unknown` or `suppressed`, not invented inbox delivery. Failed/unknown alerts are not automatically retried. A process interruption can leave a `sending` claim requiring manual inspection; it is never replayed automatically. Old `miss_alerts` claims also block duplicate dates.

Provider references: https://nodemailer.com/smtp, https://support.google.com/accounts/answer/185833, https://support.google.com/mail/answer/22839, https://support.google.com/mail/answer/81126, https://resend.com/docs/dashboard/emails/idempotency-keys.

## Verification and remaining gates

Isolated backend tests and mocked browser/mobile-preview tests cover decisions, consent, opt-out, retry uncertainty, future-day eligibility and privacy without sending mail. Account verification still uses Better Auth and a successful send never marks an account verified. Unverified owners must verify before inviting.

Obtain a designated recipient and explicit permission before any new live test. Record provider acceptance separately from recipient-confirmed inbox placement and completed account-free acceptance. Never automatically resend historical invitations. Physical Samsung/Poco testing and production publication remain separate gates; web preview tests do not prove native device behavior.
