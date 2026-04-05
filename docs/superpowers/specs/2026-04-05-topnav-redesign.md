# TopNav Redesign — Web

**Date:** 2026-04-05
**Status:** Approved

## Problem

The existing TopNav is inconsistent across pages:

1. **Desktop Explore** — search bar in center, plus a redundant "Profile" text link and an avatar in the right slot. Both go to `/profile`. The text link uses a dim, inactive-looking style.
2. **All other pages** — "Explore" + "Profile" nav pills in center, plus an avatar in the right slot. Two paths to Profile, no active state on the avatar.

Root cause: the avatar has no clear role. It duplicates a nav link rather than owning account actions.

## Design

### Nav structure

```
[ Logo ]   [ Center ]   [ Avatar ]
```

| Slot   | Desktop                          | Mobile    |
|--------|----------------------------------|-----------|
| Left   | Logo → navigates to `/`          | Logo      |
| Center | Search bar (all pages)           | — empty — |
| Right  | Avatar (account dropdown button) | Avatar    |

### Center — global search bar (desktop only)

- The search bar appears on **all desktop pages**, not just Explore.
- Behaviour and style identical to the existing desktop-explore search bar (underline style, clear button).
- When a query is typed while not on `/`, the router navigates to `/`. The explore screen reads from `SearchContext` so results appear immediately.
- On mobile, the center slot is empty. The existing command bar inside the Explore screen body is unchanged.

### Right — avatar as account button

- Orange circle showing the user's email initial. Same visual as today.
- Shows an **orange ring** (`borderWidth: 2, borderColor: COLORS.orange`) when the dropdown is open OR when `pathname === '/profile'`.
- Hover: `opacity: 0.85` (same as today).
- Click → opens account dropdown. Click again or click outside → closes.

### Account dropdown

- Floats below the avatar, right-aligned to the nav's right edge.
- Appears above all content (`zIndex: 200`).
- Dismissed by: clicking outside (full-screen transparent `Pressable` overlay behind the menu), or pressing Escape.
- Contents:

| Item | Action |
|------|--------|
| Profile | `router.push('/profile')`, closes menu |
| Sign out | `signOut()` then `router.replace('/(auth)/login')`, closes menu |

- Style: navy background (`COLORS.navy`), `borderRadius: 10`, `borderWidth: 1`, `borderColor: 'rgba(245,235,220,0.1)'`, `boxShadow`, min-width 160px.
- Items: `paddingHorizontal: 16, paddingVertical: 12`, beige text, hover background `rgba(245,235,220,0.07)`.
- "Sign out" text uses `COLORS.orange` to distinguish it as a destructive action.

### Removed

- Nav pills ("Explore" + "Profile") — removed entirely.
- The "Profile" text link from the right slot on desktop explore — removed.

## Files changed

- `src/components/web/TopNav.tsx` — sole file changed.
  - Remove `showSearch` gate; search bar shown whenever `isDesktop`, regardless of `pathname`.
  - Update query in SearchContext first, then call `router.push('/')` when not already on explore.
  - Remove nav pills render branch.
  - Remove `profileLink` / `profileLinkText` styles and render.
  - Add `menuOpen` state + dropdown render + overlay.
  - Add avatar ring logic.

## Out of scope

- Mobile nav changes.
- Adding more items to the account dropdown in the future (e.g. Settings).
- Animation on dropdown open/close (can be added later).
