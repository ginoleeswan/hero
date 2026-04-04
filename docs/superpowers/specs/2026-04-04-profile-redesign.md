# Profile Screen Redesign

**Date:** 2026-04-04  
**File:** `app/(tabs)/profile.tsx`

## Overview

Redesign the profile screen to feel like a real profile page — with a branded cover banner, avatar overlap, and tighter visual hierarchy. All changes are cosmetic; no data model or logic changes are required.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Cover + avatar overlap | Instagram-style — establishes a real "profile" feel |
| Cover style | Navy gradient + halftone dots + hero logo | On-brand with the app's dark navy palette; logo adds identity |
| Stats | Single "X saved heroes" pill | Clean and minimal; no need to derive hero/villain split |
| Favourites grid | 3-column square grid (keep current) | Compact, works well with many heroes; squircle masking preserved |
| Account rows | Coloured rounded-square icon badges | iOS Settings-style — more polished than bare Ionicons |

## Layout Structure

```
┌─────────────────────────────────┐
│  Cover banner (navy, 140px)     │
│  · halftone dot pattern         │
│  · hero-logo.svg bottom-right   │
│    (48px, opacity 0.10,         │
│     bottom: -4px for clip)      │
│                    ┌────────┐   │
└────────────────────┤ Avatar ├───┘  ← overlaps by ~30px
                     └────────┘
         Username (Flame-Bold, 22)
         email (Nunito, grey, 13)
         ❤ 12 saved heroes  [pill]

         ─────────────────  hairline

  My Favourites                [12]
  ┌──────┐ ┌──────┐ ┌──────┐
  │      │ │      │ │      │
  └──────┘ └──────┘ └──────┘
  (squircle-masked, 3-col, aspect 0.8)

  Account
  ┌────────────────────────────────┐
  │ [✉ navy badge]  Email   value  │
  │ ─────────────────────────────  │
  │ [🚪 red badge]  Sign Out       │
  └────────────────────────────────┘
```

## Component Changes

### Cover banner
- New `View` with height `140`, `overflow: 'hidden'` — replaces the standalone `pageTitle` text
- Background: `LinearGradient` from `expo-linear-gradient` with `colors={['#293C43', '#3d5a66']}`, `start={{ x: 0, y: 0 }}`, `end={{ x: 1, y: 1 }}`
- Halftone overlay: absolute `Svg` (from `react-native-svg`) filling the cover, using `<Defs><Pattern>` with a `<Circle r={1.5}` fill `rgba(231,115,51,0.22)` on a 14×14 tile, then a full-size `<Rect fill="url(#dots)"`. `react-native-svg` is already in the project via `react-native-figma-squircle`.
- Hero logo: inline `<Svg viewBox="0 0 1024 1024">` with the single `<Path>` from `assets/hero-logo.svg`, positioned absolute, `bottom: -4`, `right: 8`, `width: 48`, `height: 48`, `opacity: 0.10`. Inline avoids any asset loader complexity.
- Cover has `overflow: 'hidden'` so the logo clips at the bottom edge naturally

### Avatar
- Remove `avatarWrapper` — shadow goes directly on the `LinearGradient` avatar circle
- Add `borderWidth: 4`, `borderColor: COLORS.beige` to create the overlapping white ring
- Avatar zone: centered `View` with `marginTop: -30` to pull it up over the cover edge

### Identity block
- Remove standalone `pageTitle` ("profile" text)
- Keep `username`, `email`, `statPill` — no logic changes

### Hairline divider
- Add a `View` with `height: StyleSheet.hairlineWidth`, `backgroundColor: '#e8ddd0'`, `marginHorizontal: 16` between the identity block and the favourites section

### Favourites section
- No structural changes — keep existing grid, `FavouriteThumb`, squircle masking

### Account rows
- Replace bare `Ionicons` with a small rounded-square badge `View` containing the icon
  - Email badge: `backgroundColor: '#e8f0f2'` (light navy tint), `borderRadius: 8`, `width: 32, height: 32`
  - Sign Out badge: `backgroundColor: '#fde8e8'` (light red tint), same shape
- Keep `Ionicons` inside the badge at size 16

## What Does NOT Change
- All data fetching logic (`getUserFavouriteHeroes`, `useAuth`)
- `FavouriteThumb` component (squircle masking, gradient overlay, name label)
- Account section structure (email row + sign out row + divider)
- Empty state design
- Font families, colour palette
- Navigation behaviour

## SVG Rendering Note
`hero-logo.svg` is rendered inline as `<Svg><Path>` from `react-native-svg` (already in the project). The path data is copied directly from `assets/hero-logo.svg`. This avoids any asset transformer setup and keeps opacity control straightforward.
