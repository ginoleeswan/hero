# Desktop "Guess the Hero" — two-panel reveal stage

**Date:** 2026-06-21
**Route:** `/play` (web)
**Touches:** `src/components/game/DailyGame.tsx` only

## Problem

`DailyGame` is a thin view over `useDailyHero`, shared by `app/play.tsx` (native)
and `app/play.web.tsx` (web) via React Native Web. Its layout is a single
scrolling column tuned for a phone: a 156×208 card with clue stickers huddled
around it, a ~380px-wide dossier, and a 2-column options grid. On a wide desktop
browser that column floats in the middle of a large screen and reads as an
unstyled mobile page.

We want a desktop-designed layout for `/play` on wide screens, while leaving the
mobile-web and native experiences exactly as they are today.

## Approach

A **responsive branch inside `DailyGame.tsx`** — no new files, no changes to
`useDailyHero` or any other component.

- `useWindowDimensions().width` drives an `isWide` flag.
- **Breakpoint:** `isWide = Platform.OS === 'web' && width >= 960`.
- When `isWide` → render the new **two-panel** layout.
- Otherwise (mobile web + all native) → render today's single-column layout,
  unchanged.

All state, handlers, and derived values (`status`, `hero`, `options`, `guesses`,
`blur`, `clues`, `dossier`, `streak`, `stats`, `percentile`, `finished`,
`shareText`, `submitGuess`, `onShare`, `statsOpen`, etc.) are computed once at
the top of the component and shared by both branches.

## Desktop layout

A centered shell, `maxWidth: 1100`, with the existing dark `LinearGradient`
bleeding full-viewport behind it. No outer `ScrollView` is required at desktop
sizes (content fits a typical viewport), but the shell is wrapped so it degrades
gracefully if it overflows on short windows — keep a `ScrollView` with
`contentContainerStyle` centring the shell.

### Top bar (spans both panels)

The existing header row — back button (left), `Daily Challenge / No. N` (center),
streak pill (right) — rendered once across the top of the shell.

### Left panel — theatre (~46% width)

- Hero card scaled up to **240×320** (`CARD_W_WIDE` / `CARD_H_WIDE`).
- Warm radial `GLOW` disc grown proportionally (~480px) and re-centred.
- Holographic sheen gradient and the finished-state dark overlay
  (name + "View profile →", `won`/`cardDone` border) preserved.
- Finished card remains pressable → routes to `/character/[id]` with
  `imageUri`. Disabled while playing — unchanged.
- Clue stickers fan around the larger card. The mobile `STICKER_SLOTS` map is
  joined by a **desktop variant** `STICKER_SLOTS_WIDE` with the same five keys
  (Publisher / Alignment / Signature power / First appeared / Origin), retuned
  so the stickers sit clear of the bigger card with more spread. `STICKER_TILT`
  is reused as-is. The branch picks the map by `isWide`.

### Right panel — gameplay (~54% width)

A vertically-centred stack, `maxWidth: 480`:

1. **Case file** — the existing `dossierBlock`, widened.
2. **While playing:** the progress **pips** row.
   **When finished:** the **result block** (`Solved it!` / `Out of guesses`,
   subtitle, percentile line, Stats + Share buttons, "A new hero drops
   tomorrow.") — same content as today's `result`.
3. **While playing:** the **"Who is it?"** line-up.
   - Header row: title + "N guesses left" (reused).
   - Options grid becomes **3 columns** (`flexBasis: '31%'`) so six names form
     two tidy rows.
   - Each option keeps its eliminated state; a **hover** affordance is added for
     mouse via a web-only `&:hover`-style (RNW `Pressable` already exposes
     `onHoverIn/onHoverOut`, or a style injected like the existing
     clue-peel CSS pattern). Hover is cosmetic and web-only; the pressed and
     eliminated states are unchanged.

## What stays identical

- `useDailyHero` and every other hook/module — untouched.
- Colors (`COLORS`), fonts, sticker SVGs (`ClueSticker`), `MysteryPortrait`,
  `StatsSheet` (already `maxWidth`-capped — renders fine over either layout).
- Share logic, finished-card profile link, percentile, streak.
- Native and mobile-web rendering — byte-for-byte the current layout.

## Implementation notes

- Add the desktop constants (`CARD_W_WIDE`, `CARD_H_WIDE`, `STICKER_SLOTS_WIDE`,
  glow size) near the existing ones.
- Add a `stylesWide` block (or extend `styles`) for the panel shell, the two
  columns, and the 3-col grid. Keep `StyleSheet.create`; no inline objects
  except `StyleSheet.absoluteFill` per house style.
- The card/glow/sheen/finished-overlay JSX is near-identical between layouts;
  factor the card into a small local render helper inside the component (closure
  over `hero`, `blur`, `finished`, `won`, `router`) so it isn't duplicated, and
  feed it the size + sticker map for the active layout.

## Testing

- No unit tests — this is presentational layout. (House rule: don't test
  rendering of full screens.)
- Verify on web via iOS Safari device screenshot (mobile, must be unchanged) and
  a wide desktop browser (new two-panel layout). User performs device
  verification.

## Out of scope

- No changes to game rules, clue logic, data, or stats.
- No tablet-specific intermediate layout (one breakpoint only).
- No native layout change.
