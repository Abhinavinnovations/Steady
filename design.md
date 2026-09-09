# Steady — Design System

Calm, dark, minimal. The app should feel like a quiet coach, not a drill sergeant. Nothing heavy, no gamified noise. Generous spacing, one accent, soft motion.

## Personality
- Apple-clean onboarding: lots of empty space, one serif-feeling quote, one button.
- Never punitive: missed days are shown neutrally (muted dot), never red alarm.
- Fast: Today screen readable in under 3 seconds — date, streak, ring, tasks.

## Color (v2 — muted, low saturation, easy on eyes)
| Token | Light | Dark | Usage |
|---|---|---|---|
| background | #F2F2F7 | #101018 | base under the gradient backdrop |
| glass | rgba(255,255,255,0.60) | rgba(255,255,255,0.07) | card fill over blur |
| glassBorder | rgba(255,255,255,0.65) | rgba(255,255,255,0.10) | 1px card borders |
| foreground | #26262E | #ECECF2 | primary text |
| muted | #73737F | #96969F | secondary text |
| primary | #7A73C9 | #8B85D6 | muted violet — buttons, ring, active |
| primarySoft | rgba(122,115,201,0.12) | rgba(139,133,214,0.16) | chips, selected bg |
| success | #4F9F7E | #6FB99A | soft sage green ticks |
| streak | #C98F4E | #D9A868 | soft amber, never alarm |
| destructive | #B07079 | #C08890 | muted rose, small text only |

Backdrop blob palette (both modes, very low alpha): lavender #B9B3E6, periwinkle #A8C3E6,
pale peach #E6C9B3. Dark mode: same hues at 10–14% alpha over #101018.

## Typography
- Font: Poppins (400 / 500 / 600 / 700) everywhere.
- Quote screen: Poppins 300/400, 26–30px, line-height 1.45, letter-spacing slight.
- Screen titles 24/600. Section labels 12/600 uppercase, letter-spacing 1.2, muted.
- Numbers (streak, counts): 600 weight, tabular feel.

## Layout & spacing
- Base unit 4. Screen padding 20. Card padding 16, radius 16. Buttons radius 14, height 52.
- One column, no dense grids. Progress ring is the Today hero (streak number inside).
- Bottom sheets for the note-entry flow — slide up, dim behind.

## Motion
- Subtle only: fade+slide (200–250ms) on screen mount, spring scale on tick (0.95→1).
- Ring animates fill on load. No confetti in V1; a brief scale pulse on "day complete".
- Animated with useNativeDriver: false (web preview safety).
- Boot: first open draws a cursive "steady" wordmark (single-stroke dash animation, ~2.6s) then fades; later opens are a quick 1s wordmark fade. Overlay bg = theme background.

## Theme
- Light/Dark/Auto toggle on Profile (segmented control), persisted via AsyncStorage (`steady.themeMode`). All color lookups route through the theme context — never raw `useColorScheme` from react-native.
- Glass cards carry a faint LinearGradient top-highlight (white at low alpha) for depth — deeper "liquid glass" feel in both modes.

## Timer screen
- Full-screen ImageBackground (task-keyword-matched dark cinematic photo from assets/timer/), dark scrim, mono countdown (large, letter-spaced), thin progress bar, circular pause/stop controls. Keep-awake while running.

## Components
- TaskCard: title, status circle right (empty ring → success check), tap opens note sheet. Completed = title stays, card dims slightly, check in success color.
- NoteSheet: textarea, hint "Type or use the mic on your keyboard", min 10 chars, primary CTA "Mark done".
- StreakBadge: flame icon (Ionicons "flame") + count in streak color.
- ProgressRing: SVG circle, primary stroke, track = border color.
- ModeCard: big tappable card, title + one-line description, selected = primary border + primarysoft bg.

## Voice
- Copy is short, encouraging, lowercase-calm. Examples:
  - Empty today: "All set. Do one thing, write one line."
  - Day complete: "That's a full day. See you tomorrow."
  - Missed yesterday: "Fresh start today." (never "You failed")
