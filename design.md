# Steady — White Paper / 2026

## Functional follow-up — September 16, 2026
Retain the approved White Paper Light/Dark/Auto appearance. Add labelled microphone actions within setup and Add to-do, reuse the existing capture/review card design. Context is explicit: commitment entries are daily; Challenge review stages only title/focus duration and clearly defers saving until Lock in. Unsupported setup schedule/category fields are not offered. Preserve typed input when switching to/from voice.
Show a separate quiet focus balance beneath every timed Today row (and Calendar to-do), using unambiguous hours/minutes, e.g. “1h 59m left of 2h”. Duration remains the original target; completion notes remain separate from focus time.
One Profile heading: Accountability contact. Existing invitation system, accepted state required before starting Challenge; pending is not eligible. Basic and to-do remain private. Explain retirement of old email-code contacts without deleting records or silently inviting anyone. This approved behavior scope supersedes the earlier presentation-only restriction; all unrelated contracts remain unchanged.

## Production adoption — approved September 13, 2026
This section supersedes the Mineral presentation below for the mobile application. Historical gallery sections remain unchanged in scope: the galleries themselves are not being modified.

Light uses #FAF9F5 paper, #262620 ink, #64645B secondary text, #A4482D terracotta actions and #50634B sage success. Warm hairlines and solid ivory content surfaces; no glass on ordinary content. Dark keeps the mineral #101316 base with warm pale text, soft terracotta actions and sage success. Preserve Light/Dark/Auto storage and system-following default.

Libre Caslon Display is for screen/display/section headings; static DM Sans weights for body and controls. A spaced STEADY wordmark, 20–24px gutters, editorial hierarchy, ruled lists and quieter unboxed summaries replace the old card-heavy composition. Responsive centered content up to 700px. Large text wraps; controls are at least 44px tall. Paper texture fades from the top into the background; never overlays content. Mobile assets and OFL/provenance notices live in assets/paper. The reference texture is user-supplied, not independently licensed stock.

Navigation is a floating five-label capsule, with reflective rim, sage active capsule, safe-area-aware clearance and keyboard hiding. iOS may use one blur; Android uses layered inexpensive fills, not native Apple Liquid Glass. Web/iOS reduced-transparency fallbacks remain opaque. No new decorative motion.

Apply across setup, auth, all tabs, contact/partner, note/task/to-do/voice sheets and timer. Keep the timer photos subdued with theme scrims and legible mono digits. Preserve every existing data/action contract, 10-trimmed-character completion note rule, real verification states, timezone semantics, reminder/speech/auth engines and recovery identities. Never copy gallery fixtures into production. No backend or live-account changes.

## Design read
A mobile-first consistency companion, not a productivity dashboard: calm, tactile and legible. Keep Today, Progress, Ranks, Calendar and Profile and all existing commitment rules. Reference the clear hierarchy and contextual scheduling of Things, the voice interaction of the supplied Todoist recording, and the supplied task swipe actions. Taste is a landing-page skill: borrow restraint, material hierarchy and anti-template principles, not its marketing layouts. Vercel interface guidance informs contrast, labels, keyboard alternatives, reduced motion and error states.

## Palette
Dark: background #101316, foreground #F2F5F3, surface #1B2023, elevated sheet #22292C, border #313A3E, secondary text #A5B0AE. Primary mint #ACDFC8 with dark text #163329. Primary soft rgba(172,223,200,.10). Success #ACDFC8, caution #DDBB7B, error #F0A5A8.
Light: background #F3F5F3, foreground #1D2924, surface #FFFFFF, elevated #FFFFFF, border #DCE4DE, secondary #58685F. Primary #326B51 with white text. Success #326B51.
Solid sheets and task content preserve contrast. Glass is a controls/navigation material: translucent segmented tracks, inset selected capsules, edge highlights and restrained depth. Dedicated control-glass tokens must not make ordinary content cards translucent. Ranks Basic/Challenge and Week/Month/Year lead the treatment, shared across appropriate screen controls. Android defaults to inexpensive layered gradients/translucent fills rather than stacked experimental live blurs. Respect reduced motion/transparency; no claim of native Apple Liquid Glass. No heavyweight 3D canvas; the circular progress and voice orb provide useful depth without taxing Android.

## Typography
Poppins retained for familiarity: 400 body, 500 controls, 600 headings. Main Today title 34/42, tracking -1.2. Screen headings 28/36. Task title 15/22. Body 13/20. Metadata 11/17. Numeric timer uses existing mono. Don't add slogan clutter.

## Layout
24px screen padding; 4px spacing unit. Responsive centered content up to 700px for tablet/browser, full mobile width. 44px minimum action targets. Summary is horizontal: intention left, progress ring right. Lists group with subtle separators, not a stack of oversized decorative cards. Primary action remains within reach; voice entry clearly labelled. Five-item bottom navigation with selected pill, inset home-safe space. Cards 20px radius; sheets 28px top radius; buttons 14px; chips pill.

## Behavior
- Voice: ready, permission pending, listening, paused, transcribing, review, saving and actionable error states. Waveform driven by actual audio metering, no fake transcript. Approved update: installed builds use native speech recognition with visibly distinct provisional words, preserving pause/resume/cancel and explicit Finish → review → save. Native recognition alone owns the microphone; do not run expo-audio concurrently. Disclose that the phone speech service may process audio online while listening; Steady receives text only after Finish. Expo Go/web retain after-Finish recording through the existing gateway, clearly labelled. Missing native service/denied permission offers typed or explicit recording fallback without silently changing privacy modes. Use existing calm material, typography, spacing and accessible controls; no layout redesign.
- Review up to 20 editable/selectable task cards before explicit Add selected tasks (N). Keep the action fixed above the safe area/keyboard. Saved cards stay distinct from rejected or outcome-unknown cards; unknown retries retain their exact payload and save ID. Errors preserve recoverable input. Android Modal Back and the close control share the in-flight-save warning.
- Basic/Challenge remains the first setup choice. Basic Skip opens normal Today without a month lock. Challenge Back preserves existing contacts/commitments and discards only confirmed-to-discard local staged entries. New Challenge entries become active only at final confirmation.
- Swipe is a shortcut, never the only way. Visible overflow toggles the same Date, Flag, Focus and Delete actions. Delete confirms. Consistent task delete not offered after confirmation.
- Calendar quick choices Today/Tomorrow/Weekend + full month picker. To-do recurrence only; consistent tasks labelled Every day, not editable repeat. Completed occurrence history stays immutable except explicit undo.
- No default red missed-day shaming. Neutral amber + text and icon communicate states, not color alone.
- Async feedback uses accessibilityLiveRegion, inputs and icon actions have labels, selected controls expose accessibilityState. Respect reduced motion; no endless decorative animation. Keep all existing auth, partner, accountability, badges, timer and theme controls.

## Sources
- https://github.com/Leonxlnx/taste-skill
- https://github.com/vercel-labs/web-interface-guidelines
- https://github.com/voltagent/awesome-design-md
- https://culturedcode.com/things/features/
- User supplied Todoist and To-do List recordings

## Preview-only exploration — approved September 11, 2026
The `/ui-options` browser gallery explores five welcome treatments: Quiet Paper, Sunlit Paper, Ink & Wash, Soft Linen and Midnight Paper. This does not change the production Mineral theme or any mobile screen.

Reference: supplied ivory crumpled-paper welcome screenshot. Preserve left-aligned editorial serif quote, spaced STEADY wordmark, muted attribution, generous negative space and bottom terracotta pill. Shared fixed quote: “Small steps, kept quietly, become the shape of who you are.” Use locally hosted Libre Caslon Display with DM Sans for this preview only; natural wrapping rather than forced short marketing headlines.

Gallery chrome: warm off-white editorial workspace, fine separators, numbered five-direction selector with material swatches, restrained dark ink controls. Phone previews are the focal point, with optional two-up desktop comparison. Palette of each preview remains independent from system theme. No fake device clock, extra slogan or quote card.

Materials: locally sourced/licensed paper and linen; stationary texture with slow transform/opacity illumination layers. Continuous closed motion cycles, no video/boomerang playback. Text and button are stationary. Pause, reduced-motion, offscreen and hidden-tab suspension are required. Solid-color fallbacks and accessible contrast take priority over exact reference colors. Begin is a safe local demo interaction only. No production adoption until separately approved.

## White Paper application studies — approved September 13, 2026
Preview only at `/paper-studies`: source-matched web representations of the current Basic/Challenge choice, Today, Progress, Ranks, Calendar, Profile and completion-note sheet. Use sample fixtures, no production queries/mutations; mobile and API remain unchanged. Deliver real browser PNG captures, not generated concept images. Additional Profile lower-section view and navigation close-up make all requested components visible.

Closer to the supplied reference: use its blank upper paper area as a decorative texture crop (no text or interface pixels), fade into white/ivory #FAF9F5. Ink #262620, secondary #64645B, terracotta #A4482D, muted sage #50634B for completed states, amber #87652D for missed days. Large editorial Libre Caslon Display headings with DM Sans UI, both existing local licensed fonts. Paper texture stays strongest above headings and never competes with dense content. Solid near-white content panels, hairline rules, 20–24px margins. Do not turn every card into glass.

Bottom navigation: floating five-item transparent white capsule, strong reflective hairline edges, subtly refracted/blurred background, inset active capsule, dark readable inactive labels. CSS backdrop-filter browser approximation, not a claim of native Apple Liquid Glass. Include opaque fallback for reduced transparency. No new motion in these screenshot studies; preserve existing welcome motion unchanged. Source rules retained: consistent tasks require a 10-character note; to-dos do not affect streaks; Basic is private; Challenge requires verified contact and confirmation; rank scoring uses full days and respects mode/task buckets. All preview times labelled UTC; no fake device status bars. Preview controls never send emails or alter accounts.
