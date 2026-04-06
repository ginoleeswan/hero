# Home Screen Takeover — Design Spec

**Date:** 2026-04-06  
**Approach:** C — Full-screen immersive home (Netflix/Spotify hybrid)

---

## Overview

Overhaul `app/(tabs)/index.tsx` into a premium, immersive home experience. A full-bleed spotlight hero fills the top of the screen (behind the status bar), with a vertically scrolling feed of personalised and curated carousels below. Search moves from an always-visible bar to a modal bottom sheet triggered by an icon overlay on the spotlight.

---

## Screen Architecture

### 1. Spotlight Zone (top ~45% of screen)

- Full-bleed hero image extending behind the status bar (same `useSafeAreaInsets` pattern used on the character detail screen).
- The featured hero is drawn from the `popular` category. A new array of spotlight hero IDs is defined in the home screen — rotated on each app open (random pick) or auto-advancing every 6 seconds if the user leaves the screen idle.
- A dot indicator row shows how many spotlight heroes there are and which is active.
- A search icon (🔍) is positioned top-right as a floating overlay with a frosted-glass background (`rgba` + `backdropFilter` on iOS). Tapping it opens the search modal sheet.
- A gradient fades the bottom of the spotlight into the beige background (`#f5ebdc`) so rows beneath it blend in smoothly.
- Metadata displayed over the image: small orange label ("Featured Hero"), hero name in `Flame-Bold`, publisher in `FlameSans-Regular`.

### 2. Scrollable Rows Feed (below spotlight)

A `ScrollView` with `contentInsetAdjustmentBehavior="never"` (web parity handled separately). Each section follows the pattern: optional small label in orange caps, section title in `Flame-Regular`, horizontal `FlatList` of cards.

**Personal rows** (shown only when data exists; hidden with no empty-state placeholder):

| # | Section | Data source | Card style |
|---|---------|-------------|------------|
| 1 | Jump Back In | `user_view_history` — last 15 distinct heroes, ordered by `viewed_at desc` | Landscape thumb (90×58px) |
| 2 | Your Favourites | `user_favourites` — ordered by `created_at desc` | Tall portrait (existing `HeroCard`) |

**Curated rows** (always visible; shown in fixed order):

| # | Section | Query |
|---|---------|-------|
| 3 | Popular Heroes | `category = 'popular'` |
| 4 | Villains | `category = 'villain'` |
| 5 | X-Men | `category = 'xmen'` |
| 6 | Anti-Heroes | `alignment ilike '%neutral%'`, limit 20 |
| 7 | Marvel Universe | `publisher ilike '%marvel%'`, order by name, limit 20 |
| 8 | DC Universe | `publisher ilike '%dc%'`, order by name, limit 20 |
| 9 | Strongest Heroes | `order by strength desc`, filter `strength is not null`, limit 20 |
| 10 | Most Intelligent | `order by intelligence desc`, filter `intelligence is not null`, limit 20 |

**Card visual distinction:**
- Personal rows use **landscape thumb cards** (90×58px, `borderRadius: 8`) — signals "your history".
- All curated rows use the existing **tall portrait `HeroCard`** (~60% screen width, same as today).

### 3. Search Modal Sheet

- A React Native `Modal` with a slide-up animated sheet built using `react-native-reanimated` (already in project — no new dependency). The sheet renders over a semi-transparent backdrop.
- All current search logic (`searchHeroes`, `rankResults`, publisher filter) moves into this sheet unchanged.
- Sheet dismissed by: swiping the handle down, tapping the backdrop, or pressing the close button.

---

## New Infrastructure

### Database: `user_view_history` table

```sql
create table user_view_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hero_id text not null,
  viewed_at timestamptz not null default now(),
  unique(user_id, hero_id)
);

create index on user_view_history(user_id, viewed_at desc);

alter table user_view_history enable row level security;
create policy "Users can manage their own view history"
  on user_view_history for all
  using (auth.uid() = user_id);
```

- **Upsert on every character screen open:** `insert ... on conflict (user_id, hero_id) do update set viewed_at = now()`. This keeps one row per hero, always reflecting the most recent visit.
- Query for "Jump Back In": select the 15 most recent `hero_id` values by `viewed_at desc`, then join to `heroes` for name/image.

### `src/lib/db/viewHistory.ts`

```ts
recordView(userId, heroId): Promise<void>   // upsert
getRecentlyViewed(userId, limit = 15): Promise<FavouriteHero[]>
```

### `src/hooks/useViewHistory.ts`

- Wraps `recordView` / `getRecentlyViewed`.
- `recordView` is called from `app/character/[id].tsx` on mount (fire-and-forget, no await needed in UI).

### Migration file

`supabase/migrations/YYYYMMDDHHMMSS_add_user_view_history.sql`

---

## Data Loading Strategy

All home screen data is fetched in parallel on mount via `Promise.all`:

```
[heroCategories, recentlyViewed, favourites, antiHeroes, marvelHeroes, dcHeroes, strongest, mostIntelligent]
```

- Personal rows (`recentlyViewed`, `favourites`) require an authenticated `userId`. If user is not authenticated these queries are skipped and the rows are hidden.
- Curated rows are fetched regardless of auth state.
- Skeleton shown until all curated rows resolve. Personal rows can lazy-render independently (show skeleton row, then content).

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `app/(tabs)/index.tsx` | Full rewrite — spotlight + rows + search modal |
| `app/character/[id].tsx` | Add `recordView` call on mount |
| `src/lib/db/viewHistory.ts` | New file |
| `src/lib/db/heroes.ts` | Add `getAntiHeroes`, `getHeroesByPublisher`, `getHeroesByStatRanking` queries |
| `src/hooks/useViewHistory.ts` | New hook |
| `src/components/skeletons/HomeSkeleton.tsx` | Update to reflect new spotlight + row layout |
| `supabase/migrations/*_add_user_view_history.sql` | New migration |
| `src/types/database.generated.ts` | Regenerate after migration |

---

## Design Tokens

Consistent with existing app:

- Background: `COLORS.beige` (`#f5ebdc`)
- Spotlight gradient: `transparent → rgba(245,235,220,1)` over bottom 40% of spotlight
- Section label: `COLORS.orange`, `Nunito_700Bold`, 9px, 2px letter-spacing, uppercase
- Section title: `COLORS.navy`, `Flame-Regular`, 22px
- Personal row label: `"Personal"` in orange caps (same as above)
- Card border radius: 10px (portrait), 8px (landscape thumb)

---

## What Is Not In Scope

- Replacing the native tab bar or adding/removing tabs.
- Infinite scroll or pagination on any row.
- Push notifications or personalisation beyond view history and favourites.
- Web-specific (`index.web.tsx`) changes — handled in a follow-up.
