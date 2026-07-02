# Character Dossier — character detail page redesign (web)

**Date:** 2026-07-02
**Status:** Approved design, pre-implementation
**Scope:** Web character screen only — `app/character/[id].web.tsx` (desktop + MobileDossier paths). Native `app/character/[id].tsx` untouched. No schema or data-layer changes.

## Goal

Elevate the character detail page from a flat stack of same-weight white cards into an editorial, magazine-profile **Character Dossier**: per-character atmosphere, strong section hierarchy, interactive delight, and top-to-bottom storytelling flow (identity → powers → lore → media → deep cuts). Keeps the beige canvas, ink band, SURFACE seam signature, and Flame/FlameSans type system.

## Design language

**Character Dossier** (chosen over Trading-Card Shrine and Living Encyclopedia): sections stop being identical cards and each gets a purpose-built layout; an ambient per-character accent color threads through the page as ink tints, glows, and washes.

## 1. Ambient theming engine

- New pure util `getBlurhashAccent(blurhash: string): string | null` — decodes only the DC (average color) component of the stored `heroes.portrait_blurhash` (first color group of the base83 string). ~15 lines, synchronous, no pipeline changes.
- From the base color derive a per-character mini-palette:
  - `accent` — chroma-boosted, lightness-clamped so muddy/desaturated portraits still yield a usable, legible hue.
  - `accentDeep` — darker variant for glows on the ink band.
  - `accentWash` — 4–6% alpha tint for paper-side band backgrounds.
- Fallback chain: blurhash DC color → publisher brand color (`PUBLISHER_BRANDS`) → current teal.
- Computed once per hero (memoized on the hero row) near `useHeroDetail`; passed down as a single `theme` object. Sections never re-derive it.
- Empty-string blurhash sentinel ('' = attempted-no-hash) must fall through to the publisher fallback.

## 2. Hero band (ink section)

- Radial `accentDeep` glow blooms behind the name side of the band; portrait card gets a soft accent halo so it reads anchored, not floating.
- Tag chips (ALIEN / LEGACY HERO / …) move up **into** the band as translucent accent-tinted chips — identity belongs with the name. They leave the paper area.
- HERO / power / issues pills merge into a single stat-strip with accent divider ink.
- Ink→paper seam signature unchanged.

## 3. Power Profile (signature visualization)

- Power Stats leaves its white card and becomes a **full-bleed band** directly under the seam, paper-toned and washed with `accentWash`.
- Six stats keep the existing per-stat colors.
- Bars animate on first scroll-into-view (reanimated): fill sweep + number count-up. Fire once.
- Each bar shows a faint tick at the catalog median for that stat, giving numbers context. Medians are a small hardcoded constants table (derived once from the DB, checked into the code) — no runtime query.
- "Stronger than N% of heroes" becomes an accent-colored percentile badge anchored in the band.
- Compare action sits in the band corner, accent-colored.

## 4. Biography — pull-quote editorial

- First sentence of the teaser set large in Flame-Regular as a pull quote with an accent quote-bar; remainder in FlameSans below; "Read biography →" in accent.
- No card chrome — sits directly on the beige with generous whitespace. The page's breathing moment.
- Respect the Flame line-height rule (≥1.22× fontSize when clamped).

## 5. Abilities — tiered

- **Signature powers** (top ~4–6): larger tiles with icon + name + one-line decoded explainer folded in. Selection heuristic: powers with decoded/explainer data first, then category order. No new data.
- Remaining powers: existing categorized chip grid (Physical / Mental / …), collapsed past ~2 rows with an "all N →" expander per category.
- Category label keeps its colored tick; count becomes a quiet numeral.

## 6. Relationships — portrait mosaic

- Enemies / Allies / Teams render as **portrait tiles** (small squircle headshot + name from `portrait_url` + blurhash placeholder), grouped into three labeled shelves.
- Enemies get a subtle red-tinged tile edge; Allies a warm one; Teams show wordmarks where `teamBrands` has them.
- Ordered by fame_score (established popularity rule).
- Tiles navigate to the related character — the page's exploration engine.
- Missing portraits fall back to a monogram tile so sparse shelves still look composed.

## 7. Legend band — lore & media timeline

- First Appearance + Did You Know + Portrayed By merge into one editorial band on an `accentWash` strip.
- Horizontal timeline spine; first-appearance cover art is the anchor moment with the year large in Flame.
- Did You Know cards flow as swipeable moments along the spine.
- Portrayed By renders as portrait-medallion stops (actor + year).
- Gallery stays its own strip below with a filmstrip treatment: edge-faded, larger lead image.
- In Print / Links keep content but drop to a quieter footer register.

## 8. Right rail

- Quick Facts tiles: accent-tinted icons, one level less border-noise (flatter tiles, hairline dividers).
- Rail (portrait + facts) becomes **sticky** on desktop — the identity anchor stays in view while the left column scrolls.

## 9. Motion & in-page nav

- One shared scroll-into-view reveal (reuse `src/components/web/Reveal.tsx`): short rise+fade, once, never looping.
- Stat fills/count-ups fire on first reveal only.
- Hover: relationship tiles lift with accent edge; gallery frames brighten; chips tint.
- Desktop-only **section dot-rail** on the far left (Power / Abilities / Relations / Legend / Gallery): tracks scroll, click-to-jump, labels on hover only.
- Respect `prefers-reduced-motion` (skip reveals/count-ups, render final state).

## 10. Mobile web (MobileDossier path)

Same language, stacked: accent glow band with in-band tags; full-width Power Profile band with the same animated bars; relationships as horizontally scrolling portrait shelves; Legend band as a vertical timeline. No dot-rail. Every pass must look finished on iOS Safari (user verifies via device screenshots).

## Delivery — three passes, each landing on main

1. **Atmosphere:** accent util + hero band + Power Profile band + sticky rail.
2. **Sections:** biography pull-quote, tiered abilities, relationship mosaic, Legend band, gallery filmstrip, footer register.
3. **Life:** reveals, count-ups, hovers, dot-rail, reduced-motion, mobile polish sweep.

## Guardrails

- Web only; both desktop and MobileDossier layouts in `[id].web.tsx`.
- No schema, RPC, or data-layer changes; everything derives from data already fetched.
- New visual components live in `src/components/web/character/` — the 3,886-line screen file must shrink, not grow.
- Never Flame-Bold; Flame-Regular for display, FlameSans/Nunito elsewhere.
- StyleSheet.create only; canonical textShadow props (no raw CSS strings); explicit widths on aspect-ratio grid items (WebKit collapse).

## Testing

- Unit tests for `getBlurhashAccent` (valid hash → color; '' sentinel → null; garbage → null) and the palette derivation clamps.
- Unit test for the signature-power selection heuristic.
- Visual verification via user's device screenshots (iOS Safari) + desktop screenshot per pass; no full-screen render tests.
