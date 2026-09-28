# Steady build history

Current documentation revision: **September 28, 2026**. This log summarizes implemented milestones; the [README](../README.md) and [email setup](../EMAIL_SETUP.md) describe current behavior. Earlier designs and email behavior have been superseded where noted.

## September 28: active challenge additions and navigation

- Added a dedicated active-commitment task action. New tasks have Challenge mode fixed, start today and support immediate completion with the normal note requirement.
- Preserved the shared monthly capacity, accepted-contact checks, ownership, category validation and date-boundary guards on the server.
- Exact retry identities and fingerprints protect against lost responses and duplicate creation. Closing and reopening an uncertain save retains the original draft and request identity.
- Exempted a newly added task's partial first day from missed-day email eligibility. Older unfinished eligible tasks still count. No schema migration or retrospective alert replay.
- Kept Basic tasks in Today > Consistent Tasks and Challenge tasks on the commitment page.
- Renamed the active action on Today and Profile to **Open consistency challenge**. On Today, **Want to challenge your consistency?** and the action sit below the consistent list/Add a task and above To-dos. Existing visibility and destination are unchanged.
- Updated repository documentation and added the **first** 20-second launch video to the README. The second cut is not included.
- The separately reviewed broader explanatory-copy proposal remains unapplied.

## September 27: commitment controls, consent and device-facing fixes

- Added an explicit start-today action for eligible scheduled commitments; task identity and history remain intact.
- Added direct completion/undo and notes on the active commitment page. Locked tasks cannot be deleted; focus duration can only increase.
- Restored task-specific Focus photos and retained dark Focus presentation without changing the user's overall theme preference.
- Unified microphone controls across Basic/Challenge setup and task/to-do entry while retaining existing voice handling and drafts.
- Retained original font assets and replaced problematic icon-font consumers with SVG paths. Added font readiness, retry and fallback handling. Browser verification is not proof of physical Samsung/Poco rendering.
- Introduced account-free email invitation Accept/Decline and Stop actions with explicit versioned consent. Links use hashed capabilities; frozen link-bearing invitation payloads are encrypted server-side.
- Added recipient suppression and honest delivery outcome ledgers. No automatic enrollment of legacy contacts, invitation replay or historical missed-day backfill.
- Enabled future consent-based alerts in the existing Gmail trial. The sweep remains traffic-triggered and yesterday-only, not scheduled for midnight.

## September 25–26: email trial and launch media

- Added an explicit Gmail SMTP provider alongside Resend, with no silent provider fallback.
- Introduced safe invitation attempts, frozen payloads and provider-aware handling of ambiguous delivery. A generated message identifier alone is not proof of SMTP acceptance or inbox receipt.
- Kept test sends separate from real invitation enrollment and missed-day state changes.
- Created two launch cuts. The repository includes only the original September 26 cut: 20 seconds, 1920 × 1080, instrumental soundtrack, fictional sample data. Later UI changes may differ from the recorded video.

## Earlier foundations

- Better Auth accounts, monthly task commitments, mandatory completion notes and timezone-based dates.
- Computed streaks, mode/task-band rankings, badges and month reuse.
- Private Basic tasks, optional Challenge accountability and high-level contact status.
- Focus timers with pause/stop and saved remaining time, task images and completion-note flow.
- Separate casual to-dos, categories, recurrence, local reminders and Calendar day detail.
- Context-aware voice entry with typed fallback, reviewable drafts and guarded retry state.
- White Paper visual direction, Light/Dark/Auto themes, original type assets, SVG navigation and a floating glass tab bar.
- Web companion and privileged database console.

## Verification boundaries

The repository's reproducible baseline commands are:

```bash
bun run typecheck
bun run lint
bun run build
bun test packages/mobile/lib packages/web/src/shared
```

Additional development verification used isolated backend databases and browser network fixtures for commitment activation/additions, contact consent, retry uncertainty, privacy, theme/layout and accessibility. Private fixtures, backups and real-recipient evidence are not published with this repository.

Known limitations:

- The root build covers web/desktop tasks, not an installable Expo release.
- Physical-device font, keyboard, microphone and notification behavior needs device acceptance; browser screenshots are not sufficient.
- Native local reminders are not browser push notifications.
- The missed-day sweep requires traffic and can skip quiet periods. It makes no fixed-time delivery promise.
- SMTP acceptance, recipient-confirmed inbox receipt and correctness of the automatic trigger are separate observations.
- Increasing a focus target does not reinterpret legacy saved remaining-time checkpoints as elapsed-time records.
- Free-tier-friendly architecture is not a guarantee that every provider, AI request or distribution build costs zero.
- A source push does not deploy the app, migrate its database or send email.

For safe schema changes, see the [database guide](../database-guide.md). For consent and provider operations, see [EMAIL_SETUP.md](../EMAIL_SETUP.md).
