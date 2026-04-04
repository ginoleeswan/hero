# Hero App — Expo 55 Upgrade & Modernisation Design

**Date:** 2026-04-04  
**Status:** Approved

## Overview

Upgrade the Hero superhero encyclopedia app from Expo SDK 42 (2021) to Expo SDK 55, replacing the existing architecture with a clean foundation: Expo Router for file-based navigation, Supabase for auth + data + user features, a centralised API layer, and TypeScript throughout. The app targets iOS, Android, and Web.

The migration uses a fresh-scaffold-in-place strategy — the root is replaced with a new Expo 55 project, and only assets, images, fonts, and colour styles are preserved. Existing business logic is re-implemented cleanly rather than ported.

---

## Architecture

```
hero/
├── app/                          # Expo Router file-based routing
│   ├── (auth)/                   # Unauthenticated group
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/                   # Authenticated tab group
│   │   ├── _layout.tsx           # Bottom tab navigator
│   │   ├── index.tsx             # Home screen
│   │   ├── search.tsx            # Search screen (shell)
│   │   └── profile.tsx           # Profile screen (shell)
│   ├── character/[id].tsx        # Character detail (dynamic route)
│   └── _layout.tsx               # Root layout: auth gate, providers
├── src/
│   ├── components/               # Shared UI components
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client init
│   │   └── api.ts                # SuperheroAPI + ComicVine calls
│   ├── hooks/
│   │   └── useAuth.ts            # Auth state hook
│   ├── types/                    # Shared TypeScript types
│   └── constants/
│       └── colors.ts             # Migrated from app/styles/colors.js
├── assets/                       # Fonts + images (preserved)
├── .env.local                    # API keys (gitignored)
└── app.config.ts                 # Dynamic config (reads .env)
```

---

## Navigation

Auth-gated routing via root `_layout.tsx`:

- **Unauthenticated** → redirected to `(auth)/login`
- **Authenticated** → redirected to `(tabs)`

Tab structure (authenticated):
- **Home** (`(tabs)/index.tsx`) — hero carousels
- **Search** (`(tabs)/search.tsx`) — shell with placeholder UI
- **Profile** (`(tabs)/profile.tsx`) — shell showing email + favourite count

Stack on top of tabs:
- **Character** (`character/[id].tsx`) — detail screen, reached by tapping any hero card

---

## Supabase

### Auth
- Email + password (Supabase Auth)
- Session persisted via `@react-native-async-storage/async-storage`
- `useAuth` hook wraps `supabase.auth.onAuthStateChange`, exposes `user`, `signIn`, `signUp`, `signOut`

### Schema

```sql
-- Curated hero lists (replaces hardcoded HeroesContext)
heroes (
  id          text primary key,       -- SuperheroAPI ID e.g. "620"
  name        text not null,
  publisher   text,
  image_url   text,
  category    text                    -- 'popular' | 'villain' | 'xmen'
)

-- User favourites
user_favourites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade,
  hero_id     text references heroes(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_id, hero_id)
)

-- User profiles (shell — not built out in this phase)
user_profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at   timestamptz default now()
)
```

### Data flow
- Home screen fetches `heroes` grouped by `category` on load
- Tapping a hero card navigates to `character/[id]` and fetches external API data
- Favouriting on CharacterScreen upserts into `user_favourites`
- Profile screen queries favourite count for the current user

---

## API Layer

File: `src/lib/api.ts`

All external API calls live here. Keys are read from `expo-constants` (injected via `app.config.ts` from `.env.local`), never hardcoded in components.

```
fetchHeroStats(id: string)      → GET superheroapi.com/api/<key>/<id>/
fetchHeroDetails(name: string)  → GET comicvine.gamespot.com/api/characters/?filter=name:<name>...
fetchFirstIssue(issueId: string)→ GET comicvine.gamespot.com/api/issue/4000-<id>/
```

Called in sequence when navigating to CharacterScreen. Errors are caught per-call and surfaced as user-visible error states on the screen.

---

## Package Changes

| Removed | Replacement | Reason |
|---|---|---|
| `expo-app-loading` | `expo-splash-screen` | Deprecated |
| `react-native-unimodules` | — | Merged into Expo SDK |
| `react-native-snap-carousel` | `react-native-reanimated-carousel` | Unmaintained |
| `react-native-elements` | `expo-image` + `@expo/vector-icons` | App only used Image and Icon; both covered by Expo SDK directly with better performance |
| `react-native-big-list` | `FlatList` (RN core) | Overkill for dataset size |
| `react-native-image-gallery`, `lightbox` variants | `react-native-image-viewing` | Consolidate to one |
| `axios` | native `fetch` | Already using fetch; redundant |
| `react-native-flatlist-alphabet` | — | Unused |
| `pretty-error` | — | Not applicable in RN |
| `@react-navigation/*` | Expo Router (built on React Navigation) | Replaced by file-based routing |

**Added:**
- `@supabase/supabase-js`
- `@react-native-async-storage/async-storage`
- `react-native-url-polyfill`
- `expo-image` (replaces react-native-elements Image — caching, blurhash, better perf)
- `@expo/vector-icons` (replaces react-native-elements Icon — already in Expo SDK)

**Kept:** `react-native-reanimated` (v3), `react-native-gesture-handler`, `react-native-svg`, `expo-linear-gradient`, `react-native-safe-area-context`, `react-native-figma-squircle`, `react-native-touchable-scale`, `@react-native-masked-view/masked-view`, all `@expo-google-fonts/*`

---

## Migration Phases

### Phase 1 — Foundation
- Scaffold Expo 55 project with TypeScript + Expo Router in-place
- Replace `app.json` → `app.config.ts`, configure `.env.local`, update `babel.config.js` and `metro.config.js`
- Move assets (fonts, images) to `assets/`
- Port `colors.js` → `src/constants/colors.ts`
- **Exit criteria:** App boots to a blank screen on iOS, Android, and Web

### Phase 2 — Supabase + Auth
- Install and configure Supabase client (`src/lib/supabase.ts`)
- Create Supabase project, apply schema, seed `heroes` table with current hardcoded data
- Build `(auth)/login.tsx` and `(auth)/signup.tsx`
- Implement `useAuth` hook and root auth gate in `app/_layout.tsx`
- **Exit criteria:** Login/signup works; app redirects correctly between auth and tab groups

### Phase 3 — Home Screen + Navigation
- Build `(tabs)/_layout.tsx` with bottom tab navigator
- Build `(tabs)/index.tsx` — fetch heroes from Supabase, render carousels with `reanimated-carousel`
- Add shell screens for Search and Profile
- **Exit criteria:** App looks and navigates like the original; hero lists load from Supabase

### Phase 4 — Character Screen
- Implement `character/[id].tsx` dynamic route
- Centralise API calls in `src/lib/api.ts`
- Full character detail UI (stats, summary, first issue, publisher)
- Favourite button writes to `user_favourites`
- Loading and error states
- **Exit criteria:** Tapping any hero card shows full detail; favouriting persists to Supabase

### Phase 5 — Polish + CLAUDE.md
- TypeScript types for all shared data shapes
- Shell screens with placeholder UI (not blank)
- Remove all dead code and commented-out blocks
- Write `CLAUDE.md` with setup instructions, commands, architecture summary, and gotchas
- **Exit criteria:** Clean codebase, app fully runnable with setup instructions

---

## Out of Scope (this phase)

- Search functionality implementation (screen is a shell)
- Profile editing / display name
- Social features
- Push notifications
- App Store / Play Store submission
