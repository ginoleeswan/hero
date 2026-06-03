# VS Screen Redesign — Design

**Date:** 2026-06-03
**Scope:** `app/compare/[hero]/[opponent].tsx`, `app/compare/[hero]/[opponent].web.tsx`, `src/components/compare/ClashPortraits.tsx`

## Problem

The compare ("vs") result screen has three issues:

1. **Old portraits.** The native screen calls `heroImageSource(hero, statsA.image.url)` without the third `portraitUrl` argument, so it skips the Supabase portrait the character screen uses and falls back to old bundled images.
2. **Broken header.** A navy top bar sits *below* a beige status-bar strip with a lowercase "vs" title — inconsistent with the immersive full-bleed style used elsewhere in the app.
3. **Dated overall design.** The screen needs a cohesive visual overhaul.

## Chosen Direction: Immersive Clash + Gold Glow

Cinematic, edge-to-edge. The split clash portraits extend behind the status bar; there is no contained navy header. The winner is celebrated with a restrained warm gold glow (no crown/laurel icons), and the loser is visually muted so focus lands on the winner.

## Changes

### 1. Portrait fix (both native and web)

Pass the Supabase portrait URL as the third argument so the clash uses the same high-res portraits as the character screen:

```ts
const imageA = heroImageSource(hero, statsA.image.url, statsA.image.portraitUrl);
const imageB = heroImageSource(opponent, statsB.image.url, statsB.image.portraitUrl);
```

`heroImageSource` priority is `portraitUrl → local bundled → imageUrl → CDN`, so passing `portraitUrl` makes the Supabase portrait win when present. No type changes — `HeroStats.image.portraitUrl` already exists.

### 2. Header → full-bleed + floating buttons

- Remove the navy `topBar` (back / "vs" / share) entirely.
- Portraits render full-bleed to the top edge (behind the status bar). The `ClashPortraits` clash is the top of the screen; its height includes the area behind the status bar.
- Back and share become floating circular translucent-glass buttons (`rgba(20,20,20,0.4)` background, white glyph), absolutely positioned at `top: insets.top` (with a small offset), left and right.
- Force `StatusBar` to `light` (white status-bar glyphs) since dark portrait imagery sits behind it. Use `expo-status-bar`'s `<StatusBar style="light" />`.
- The root no longer needs `paddingTop: insets.top`; the scroll content starts at the top edge. Verdict, stats, and button continue below on the beige canvas.

### 3. Winner / loser treatment (in `ClashPortraits`)

- **Loser half:** a heavier cool-dark scrim overlay (e.g. `rgba(20,28,33,0.55)`) dims and mutes the panel. The loser name renders greyed; the status pill reads `LOST` on a dark translucent background.
- **Winner half:** a warm gold inner-glow overlay — a layer with a large inset gold glow (`shadowColor`/inner radial approximation via a semi-transparent gold gradient or an inset-shadow View). The winner name renders white; the status pill is a solid gold (`COLORS.yellow`) `WINNER` pill with navy text.
- **New animation beat:** the winner gold-glow layer fades in as the final step of the existing sequence (after labels), via a new shared value `glowOp` with `withDelay(...).withTiming(1)`.
- **Tie case:** neither half is dimmed; both get a soft (lower-opacity) gold glow; both pills read `TIE`.

True grayscale is not reliably available in expo-image on native, so "muted" is implemented as scrim overlays rather than a CSS-style desaturate filter. This is robust cross-platform and visually sufficient.

`ClashPortraits` keeps its existing slam → shake → flash → bolt → VS-badge animation; only the glow beat and the winner/loser scrim styling are added. The `winner: 'A' | 'B' | 'tie'` prop already drives which half is winner/loser.

### 4. Verdict band

Unchanged in content and behaviour (navy band, AI verdict with italic placeholder fallback). May receive minor spacing polish to sit cleanly under the now full-bleed clash.

### 5. Stat battle rows

Keep the existing dual left/right `StatBattleRow` bars (winner side keeps its accent color, loser side dimmed). Visual polish only — no structural change.

### 6. "Compare with someone else" button

Restyle from the faded, low-opacity flat button to a solid, full-opacity navy primary button with beige text and a trailing arrow. Same `router.replace` behaviour.

## Out of Scope

- No database, query-layer, or generated-type changes.
- No change to `compareStats` / verdict generation logic.
- No new dependencies (glow via existing reanimated + Views; status bar via existing `expo-status-bar`).

## Files

| File | Change |
| --- | --- |
| `app/compare/[hero]/[opponent].tsx` | Portrait arg fix; remove navy header; floating glass buttons; `StatusBar` light; restyle compare button; spacing. |
| `app/compare/[hero]/[opponent].web.tsx` | Mirror portrait fix + winner/loser/header treatment for web consistency. |
| `src/components/compare/ClashPortraits.tsx` | Loser scrim + winner gold-glow overlay; glow animation beat; pill/name color states; extend behind status bar. |
