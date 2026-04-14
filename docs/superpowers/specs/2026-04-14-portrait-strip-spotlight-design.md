# Portrait Strip Spotlight — Design Spec

**Date:** 2026-04-14  
**Scope:** Web only (`app/(tabs)/index.web.tsx`)  
**Replaces:** `WebSpotlight` component (the 580px full-bleed banner)  
**Native mobile:** Untouched — `SpotlightBanner.tsx` stays as-is

---

## Problem

The current `WebSpotlight` component is 580px tall on desktop and 420px on mobile web. It takes up a large portion of the viewport before the user sees any content. Additionally, hero images are predominantly vertical (portrait) format — cramming them into a wide landscape banner causes heavy zoom and cropping.

---

## Solution

Replace `WebSpotlight` with a new `PortraitStripSpotlight` component. Portrait cards are shown at their natural vertical ratio. The active/featured card drives an info panel. No full-bleed banner.

---

## Component: `PortraitStripSpotlight`

### Props

```ts
interface PortraitStripSpotlightProps {
  heroes: Hero[];       // spotlight pool (up to SPOTLIGHT_POOL = 10)
  onHeroPress: (id: string) => void;  // fired by "View Profile" button
}
```

Internal state: `activeIndex` (number, starts at 0).

---

## Desktop layout (≥768px)

```
┌─────────────────────────────────────────────────────────┐
│  [Portrait] [Port] [Por] [Po]  │  Info panel            │
│  active=160px  110  80   60    │  FEATURED HERO label   │
│  full opacity  0.8  0.5  0.3   │  Hero Name (large)     │
│                                │  Publisher             │
│                                │  Summary (2 lines)     │
│                                │  [View Profile →]  ●●○ │
└─────────────────────────────────────────────────────────┘
```

- **Height:** 260px
- **Portrait cards:** left-aligned flex row, no scroll, cards beyond index 4 are hidden
- **Active card:** 160px wide, full opacity, "FEATURED" badge top-left
- **Behind cards:** 110px → 80px → 60px, opacity 0.8 → 0.5 → 0.3
- **Info panel:** flex:1, `#1d2d33` background, border-radius 12px, padding 20px
  - `FEATURED HERO` label (orange, 8px, uppercase, tracked)
  - Hero name (28px, Flame-Bold, beige)
  - Publisher (10px, muted, uppercase)
  - Summary text (12px, muted, 2-line clamp) — falls back gracefully if `hero.summary` is null
  - `View Profile →` button (orange pill) — calls `onHeroPress(hero.id)`
  - Dot indicators (one per hero in pool) — clicking a dot sets `activeIndex`
- **Interaction:** clicking a portrait card sets it as active (updates info panel). Does not navigate.
- **Auto-advance:** every 6 seconds, wraps around. Pauses on hover (optional, nice-to-have).
- **Keyboard:** `ArrowLeft` / `ArrowRight` cycle active index.

---

## Mobile web layout (<768px)

```
┌───────────────────────────────┐
│  [Portrait]  │  Info panel    │
│  110px wide  │  label         │
│  full height │  Name          │
│              │  Publisher     │
│              │  Summary(3ln)  │
│              │  [View→]  ●●○  │
└───────────────────────────────┘
```

- **Height:** 170px
- Single portrait card (110px wide), no strip depth effect
- Info panel fills remaining width
- Same dot indicators and auto-advance as desktop
- Summary clamps to 3 lines

---

## Interaction model

| Action | Result |
|---|---|
| Click portrait card | Sets as active hero, updates info panel |
| Click dot indicator | Sets corresponding hero as active |
| Click "View Profile →" | Navigates to `/character/[activeHero.id]` |
| Auto-advance timer | Cycles `activeIndex` every 6s |
| `ArrowLeft` / `ArrowRight` | Cycles `activeIndex` |

---

## Data

- **Query:** `getSpotlightHeroes()` — existing function, no changes
- **Pool size:** `SPOTLIGHT_POOL = 10` — unchanged
- **Images:** `heroImageSource(id, image_url, portrait_url)` — existing helper, `contentPosition="top"` to anchor portrait faces
- **No DB migrations or API changes required**

---

## Files changed

| File | Change |
|---|---|
| `app/(tabs)/index.web.tsx` | Replace `WebSpotlight` component + styles with `PortraitStripSpotlight` |

No new files. No changes to native, shared hooks, DB layer, or types.

---

## Out of scope

- Native mobile spotlight (`SpotlightBanner.tsx`) — untouched
- Swipe gesture on mobile web (dots + auto-advance are sufficient)
- Hover-pause on auto-advance (nice-to-have, not required)
