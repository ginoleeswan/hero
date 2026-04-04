# Hero Web Version — Design Spec

**Date:** 2026-04-04  
**Status:** Approved

## Overview

A web-first redesign of the Hero superhero encyclopedia app. The web version gets its own purpose-built screens while sharing the existing data layer (Supabase, SuperheroAPI, ComicVine), auth logic, and TypeScript types with the native app. Native (iOS/Android) is unchanged.

## Tech Foundation

### Web compatibility
- `app.config.ts` already set to `output: 'single-page-application'` — no SSR, pure client-side rendering
- Create `metro.config.js` with `resolver.resolveRequest` that aliases native-only packages to web stubs for the web platform:
  - `@react-native-masked-view/masked-view` → `View` with `overflow: hidden`
  - `react-native-figma-squircle` → no-op passthrough
  - `react-native-touchable-scale` → `Pressable`
  - `react-native-circular-progress` → horizontal bar equivalent
- This replaces the current piecemeal `.web.tsx` workarounds with a single centralised resolver

### Shared with native
- `src/lib/supabase.ts` — auth client (already patched for web)
- `src/lib/api.ts` — SuperheroAPI + ComicVine fetches
- `src/lib/db/` — all Supabase query functions
- `src/hooks/useAuth.ts` — session state
- `src/types/` — all app types
- `src/constants/colors.ts`, `heroImages.ts`

### Web-only files
All web screens live under `app/` using Expo Router's `.web.tsx` platform extension or a dedicated web route group `app/(web)/`.

## Visual Language

| Token | Value |
|---|---|
| Background | `#f5ebdc` (COLORS.beige) |
| Primary dark | `#1a1a2e` (COLORS.navy) |
| Accent | `#e8621a` (COLORS.orange) |
| Nav height | 52px |
| Content max-width | 1200px (discover grid), 860px (detail + profile) |
| Border radius | 10–14px for cards/sections |
| Section bg | `white` with `1px solid #e8ddd0` border |

Fonts: same as native — Flame-Regular for headings, FlameSans-Regular for body, Nunito for UI text.

## Shared Navigation

A persistent top nav bar across all pages:
- Left: HERO logo (orange, Flame-Regular)
- Centre: Discover / Search / Profile links
- Active state: white text + 2px orange underline
- Background: `#1a1a2e`
- Height: 52px

No tab bar on web. Auth pages (login/signup) hide the nav.

## Screens

### 1. Discover (`/`)

**Layout:** Immersive Portal — full-width grid on a beige canvas.

**Structure:**
- Top nav (shared)
- Hero grid: CSS grid, `repeat(auto-fill, minmax(220px, 1fr))`, gap 16px, padding 24px
- First card spans 2 columns and 2 rows — the "featured" spotlight with a badge, hero name, and publisher subtitle
- All other cards: dark `#1a1a2e` background, hero image as `expo-image`, name overlaid at bottom-left
- Cards are clickable → navigate to `/character/[id]`
- Data: `getHeroesByCategory()` — popular, villain, x-men sections each rendered as a titled row group with a horizontal rule

**No carousels on web** — `react-native-reanimated-carousel` is replaced by a CSS grid for each category section.

### 2. Character Detail (`/character/[id]`)

**Layout:** Editorial long-form — centred max-width 860px.

**Structure:**
- Top nav with back link (← Discover or ← Search), hero name centred, ♡ favourite button right
- **Hero banner:** `#1a1a2e` card, border-radius 14px, hero name large (Flame-Regular 36px), alias + publisher subtitle, hero image positioned right if available
- **2-column section grid** below the banner:
  - **Power Stats** — 6 stats as horizontal progress bars (coloured per stat, matching `STAT_CONFIG` colours). No `react-native-circular-progress` on web.
  - **Biography** — key/value rows (full name, alter egos, place of birth, first appearance, alignment, aliases)
  - **Appearance** — key/value rows (gender, race, height, weight, eyes, hair)
  - **Work** — occupation, base
  - **Connections** — group affiliation, relatives
  - **Summary** (full width) — ComicVine description paragraph, skeleton lines while loading
  - **First Appearance** (full width, if available) — comic cover image centred

**Loading state:** Skeleton placeholders using `SkeletonProvider` + `Skeleton` (already web-compatible).

### 3. Search (`/search`)

**Layout:** Dedicated page with hero search bar.

**Structure:**
- Top nav (shared, Search link active)
- **Search hero bar:** dark `#1a1a2e` background, centred large search input (rounded pill, white bg), publisher chips (All / Marvel / DC / Other) + category chips (Popular / Villains / X-Men) below
- **Results grid:** same card style as Discover, `repeat(auto-fill, minmax(200px, 1fr))`, updates live as user types
- Empty state: "Search for a hero or villain…" placeholder
- Data: same CDN fetch as native search (`akabab/superhero-api`), filtered client-side

### 4. Profile (`/profile`)

**Layout:** Split — user panel left, favourites right.

**Structure:**
- Top nav (shared, Profile link active)
- **Left panel** (260px, `#1a1a2e` background, full height):
  - Avatar circle (initial letter, orange bg)
  - Username + email
  - Divider
  - Favourites count
  - Sign out button (bottom)
- **Right panel** (flex 1, beige bg, padding 24px):
  - "Favourites" section title
  - CSS grid of favourite hero cards, same style as Discover cards
  - Empty state if no favourites: prompt to browse and add some
- Unauthenticated: redirect to `/login`

### 5. Login & Signup (`/login`, `/signup`)

**Layout:** Centred card on beige background.

**Structure:**
- No nav bar
- Centred card (max-width 420px, white bg, border-radius 16px, soft shadow)
- HERO logo at top (orange)
- Email + password inputs (styled to match brand)
- Primary action button (navy bg, beige text)
- Link to toggle between login / signup
- Same `useAuth` hook as native

## File Structure

```
app/
  (web)/                    # Web-specific route group
    _layout.tsx             # Web root layout — top nav, fonts
    index.tsx               # Discover (web)
    search.tsx              # Search (web)
    profile.tsx             # Profile (web)
    character/
      [id].tsx              # Character detail (web)
  (auth)/
    login.tsx               # Shared or web-specific login layout
    signup.tsx

src/
  components/
    web/                    # Web-only components
      TopNav.tsx            # Shared top navigation bar
      HeroCard.tsx          # Web hero card (Image + name overlay)
      StatBar.tsx           # Horizontal stat bar (replaces circular progress)
      HeroDetailSections.tsx # Bio/appearance/work/connections section renderer
  lib/                      # Unchanged — shared with native
  hooks/                    # Unchanged
  constants/                # Unchanged
  types/                    # Unchanged

metro.config.js             # New — resolver aliases for native-only packages
```

## Metro Resolver Aliases

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const webAliases = {
  '@react-native-masked-view/masked-view': require.resolve('./src/web-stubs/MaskedView.js'),
  'react-native-figma-squircle': require.resolve('./src/web-stubs/SquircleView.js'),
  'react-native-touchable-scale': require.resolve('./src/web-stubs/TouchableScale.js'),
  'react-native-circular-progress': require.resolve('./src/web-stubs/CircularProgress.js'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && webAliases[moduleName]) {
    return { filePath: webAliases[moduleName], type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

Each stub exports a minimal web-safe replacement (View, Pressable, or a no-op component).

## What's Not in Scope

- Responsive breakpoints for tablet/mobile web (web version targets desktop browser)
- Web-specific animations or transitions beyond CSS hover states
- PWA / service worker / offline support
- SEO / SSR (SPA mode only)
- Changing native app screens in any way
