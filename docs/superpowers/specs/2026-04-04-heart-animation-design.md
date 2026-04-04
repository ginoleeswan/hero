# Heart Animation Design

**Date:** 2026-04-04  
**Status:** Approved

## Overview

Replace the static `Ionicons` heart in the character screen's native header with an animated floating `HeartButton` component that plays a Twitter-style burst animation when a hero is favourited.

## Motivation

The CodePen inspiration (mindstorm/aZZvKq) uses a CSS sprite sheet (`steps(28)`) to play through 28 frames of the Twitter heart animation. That technique is web-only and doesn't translate to React Native. We recreate the same visual effect — ring burst, dot scatter, heart pop — using Reanimated 4, which is already in the project.

## Approach

Pure Reanimated 4 programmatic burst. No new dependencies. Works identically on iOS, Android, and web.

## Component

**New file:** `src/components/HeartButton.tsx`

### Props

```ts
interface HeartButtonProps {
  favourited: boolean;
  loading: boolean;
  onPress: () => void;
}
```

The component is purely presentational. All favourite state and DB logic remains in `app/character/[id].tsx` and is passed down as props.

### Placement

`position: absolute`, bottom-right of the hero image container:
- `bottom: 20, right: 20` relative to `heroImageContainer`
- Rendered as a sibling of `LinearGradient`, above it in the z-order
- Button is circular, ~52px diameter
- Background: `rgba(0,0,0,0.35)` — readable against both light and dark hero images
- `overflow: visible` on the container so particles can burst outside button bounds

## Animation Sequence

### On favourite (off → on)

Three layers animate simultaneously, triggered by a single `isActive` shared value:

1. **Ring burst**
   - A circle starts at ~20px diameter, expands to ~80px
   - Fades from `COLORS.red` to transparent
   - Duration: ~400ms via `withTiming`

2. **Dot scatter**
   - 6 dots arranged radially (every 60°), each ~6px diameter
   - Fly outward ~35px with a spring, then fade out
   - Colours cycle through app palette: red, orange, yellow, blue, green, brown (`COLORS.*`)
   - Staggered slightly per dot for a natural burst feel

3. **Heart pop**
   - Scale: `1 → 1.5 → 1` via `withSequence(withSpring(1.5), withSpring(1))`
   - Icon colour: transitions to `COLORS.red`

### On unfavourite (on → off)

Heart only — no burst (matches Twitter's behaviour):
- Scale: `1 → 0.8 → 1` with a soft spring
- Icon colour fades back to white

## Files Changed

| File | Change |
|---|---|
| `src/components/HeartButton.tsx` | **Create** — animated heart button component |
| `app/character/[id].tsx` | Remove `headerRight` heart; add `<HeartButton>` inside `heroImageContainer` |

No changes to `src/lib/db/favourites.ts` or any other file.

## Architecture Notes

- Dot and ring views are absolutely-positioned siblings of the heart icon inside the button container
- `overflow: visible` ensures particles render outside button bounds
- All animations driven by a single `isActive` shared value derived from the `favourited` prop
- Haptics remain as-is in `toggleFavourite` in `[id].tsx`
