# Native Versus tab (matchup hub)

**Date:** 2026-06-11
**Status:** Approved (design)

## Goal

Give native a dedicated **Versus** tab — the entry point web exposes via its TopBar
"Versus" item. On native it's a **matchup hub**: a destination that surfaces a
daily matchup, a random "Surprise me" battle, curated rivalries, and a path to
build your own. This closes the parity gap where native had no top-level way into
the compare/arena flow (you could only reach it from a hero's Compare button).

All hub data already exists and is cross-platform (`getTodaysMatchup`,
`getTopRivalries`, `getIconicHeroes`); this is new native presentation plus one
repurposed route.

## Architecture

A new tab route renders the hub. Sections fetch through one react-query hook.
Tapping any matchup stashes both fighters' art (instant arena paint) and navigates
to the existing arena route `/compare/[hero]/[opponent]`. "Build your own" routes
to a repurposed first-fighter picker that flows into the existing per-hero
opponent picker.

Existing arena + per-hero picker screens are unchanged. We reuse `VsBadge`,
`OpponentCard`, `heroImageSource`, `stashFighters`, and `useHeroSearchInfinite`.

## Files

**Create:**
- `app/(tabs)/versus.tsx` — the hub screen (navy stage over beige sheet, scrollable).
- `src/hooks/useVersusHub.ts` — react-query hook returning `{ matchup, rivalries, iconicPool, loading }`.
- `src/components/versus/TodaysMatchupCard.tsx` — native daily-matchup card.
- `src/components/versus/RivalriesRail.tsx` — native horizontal rivalries rail.
- `src/lib/versus.ts` — `pickRandomPair(pool, rng?)` pure helper for "Surprise me".

**Modify:**
- `app/(tabs)/_layout.tsx` — add the 4th `NativeTabs.Trigger` (versus).
- `app/compare/pick.tsx` — replace the redirect stub with a real "pick fighter A" screen.

**Test:**
- `__tests__/lib/versus.test.ts` — unit tests for `pickRandomPair`.

## Component / data detail

### Tab registration — `app/(tabs)/_layout.tsx`
Add a trigger between Search and Profile (final order: Explore · Search · Versus ·
Profile). Icon: `git-compare` (Ionicons), matching web's Versus glyph. Label: "Versus".

```tsx
<NativeTabs.Trigger name="versus">
  <NativeTabs.Trigger.Icon
    src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="git-compare" />}
  />
  <NativeTabs.Trigger.Label>Versus</NativeTabs.Trigger.Label>
</NativeTabs.Trigger>
```

### Data hook — `src/hooks/useVersusHub.ts`
One hook, react-query backed (cached like explore.web):
- `getTodaysMatchup()` → `matchup: TodaysMatchup | null` (already computes verdict,
  cached per pair via the edge function with graceful fallback).
- `getTopRivalries(12)` → `rivalries: Rivalry[]`.
- `getIconicHeroes(24)` → `iconicPool: Hero[]` (fuels "Surprise me").
Use separate `useQuery` calls (independent staleness/caching) and expose a combined
`loading`. Failures degrade gracefully — a null/empty section is simply hidden.

### Hub screen — `app/(tabs)/versus.tsx`
Layout mirrors other native screens (transparent floating header, navy stage with a
gold eyebrow + "Versus" title, beige sheet). A shared `openArena` helper:

```tsx
const openArena = (a: FighterArt, b: FighterArt) => {
  stashFighters(a, b);
  router.push(`/compare/${a.id}/${b.id}`);
};
```

Sections, in order:
1. **Today's Matchup** — `<TodaysMatchupCard matchup={matchup} onOpen={openArena} />`.
   Hidden while loading / when null.
2. **Surprise me** — a prominent button. On press: `pickRandomPair(iconicPool)` →
   `openArena(a, b)`. Disabled until `iconicPool.length >= 2`. Light haptic.
3. **Greatest Rivalries** — `<RivalriesRail rivalries={rivalries} onOpen={openArena} />`.
   Hidden when empty.
4. **Build your own** — a row/button → `router.push('/compare/pick')`.

### Native section components
- **`TodaysMatchupCard`** — two portraits flanking a `VsBadge`, the wins tally, and
  the verdict line in quotes; whole card pressable → `onOpen(heroA, heroB)`. Native
  styling only (no web `cursor`/`boxShadow`/responsive breakpoints); follows the
  app's StyleSheet + font conventions. `MatchupHero` already matches `FighterArt`.
- **`RivalriesRail`** — a horizontal `ScrollView` of compact dual-portrait cards
  (reusing the `Rivalry` shape `{ a, b, crossUniverse }`), each → `onOpen(r.a, r.b)`.

### Surprise helper — `src/lib/versus.ts`
```ts
export function pickRandomPair<T extends { id: string }>(
  pool: T[],
  rng: () => number = Math.random,
): [T, T] | null {
  if (pool.length < 2) return null;
  const i = Math.floor(rng() * pool.length);
  let j = Math.floor(rng() * (pool.length - 1));
  if (j >= i) j += 1; // guarantee distinct without bias toward i
  return [pool[i], pool[j]];
}
```

### First-fighter picker — `app/compare/pick.tsx`
Replace the `<Redirect href="/explore" />` stub with a real "pick fighter A" screen,
structurally a subject-less twin of `app/compare/[hero]/pick.tsx`:
- Same navy-stage/beige-sheet shell and `OpponentCard` 2-col grid.
- Header eyebrow: "Choose your first fighter" (no `VsAnchor`, since no subject yet).
- Roster + search via `useHeroSearchInfinite` (the same query the Search tab uses):
  empty query shows the default roster; typing searches all heroes.
- Picking a hero → `router.push('/compare/${id}/pick?name=${encodeURIComponent(name)}')`
  (the existing opponent picker, which then routes to the arena). Long-press → `HeroPeek`.

This also makes the `/compare/pick` deep link behave like web instead of bouncing
to explore.

## Navigation flow

```
Versus tab
├─ Today's Matchup card ─→ /compare/[a]/[b]            (arena)
├─ Surprise me          ─→ /compare/[randA]/[randB]    (arena)
├─ Greatest Rivalries   ─→ /compare/[a]/[b]            (arena)
└─ Build your own       ─→ /compare/pick (pick A)
                            └─→ /compare/[A]/pick (pick B)
                                 └─→ /compare/[A]/[B]  (arena)
```

## Error / empty handling
- Each data section hides itself on null/empty; the hub never shows a broken section.
- "Surprise me" is disabled until the iconic pool has ≥2 heroes.
- First-fighter picker shows the existing picker skeleton while the roster loads and
  an empty state when a search returns nothing.

## Out of scope
- View-transition / shared-element morphs (web-only; native uses instant stash paint).
- Reworking explore's existing carousels or the web hub.
- Changing the arena or per-hero picker screens.
- Persisting recent/last matchups on the hub.

## Testing
Per `CLAUDE.md`, no full-screen render or navigation tests. The one piece of pure
logic — `pickRandomPair` — gets unit tests in `__tests__/lib/versus.test.ts`:
returns `null` for pools < 2, always returns two **distinct** items, and (with an
injected deterministic `rng`) returns the expected indices including the boundary
case where the second index must skip past the first. Everything else is
presentational wiring over already-tested data functions; verification is manual
(tab appears; each section loads, hides when empty, and opens the right arena;
Surprise me yields distinct fighters; Build-your-own completes A→B→arena).
