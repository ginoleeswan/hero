# CLAUDE.md

## Project

**Mythique** — a superhero/villain encyclopedia app built with Expo SDK 56 / React Native.  
Targets iOS, Android, and Web. (Repo slug + internal package dir stay `hero`; the product is branded **Mythique**.)

## Documentation system

**`docs/README.md` is the docs index — start there for any feature you don't
already know.** Three layers, trust flows downward:

1. This file — conventions, commands, hard rules.
2. `docs/features/` + `docs/architecture/` — **evergreen as-shipped references**
   per domain (Explore/Pulse, Arena, dailies, search, character page, profile,
   sharing/OG, auth/identity, push, platform/motion, admin, pipelines, houses).
   Kept current: **if a PR changes a domain's behaviour, update its doc in the
   same PR.**
3. `docs/superpowers/specs|plans/` — ~170 dated historical design docs. The
   decision record, not the current truth; status lines in them go stale.
   Hidden from Grep via `.ignore` — read by explicit path only.

## Package manager

Always use **yarn**. Never use npm or bun.

```sh
yarn install
yarn add <package>
yarn expo install <expo-package>   # use for Expo-managed packages (pins correct version)
yarn start                         # dev server
yarn test:ci                       # run all tests once (CI mode)
```

## Tech stack

| Concern       | Library                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| Navigation    | expo-router 4 (file-based)                                                       |
| Auth + DB     | Supabase (`@supabase/supabase-js`)                                               |
| Images        | expo-image                                                                       |
| Icons         | @expo/vector-icons (Ionicons)                                                    |
| Fonts         | @expo-google-fonts/nunito, @expo-google-fonts/righteous + custom Flame/FlameSans |
| Animations    | react-native-reanimated 4                                                        |
| Carousel      | react-native-reanimated-carousel                                                 |
| Progress bars | react-native-progress                                                            |
| Card shape    | react-native-figma-squircle + @react-native-masked-view/masked-view              |
| Testing       | jest-expo + @testing-library/react-native                                        |

## Directory structure

Most screens are a native/web pair (`foo.tsx` + `foo.web.tsx`) over one shared
hook — see "Platform-specific files" below.

```
app/
  _layout.tsx(.web)    Root layout — fonts, splash, AuthGate, providers
  index.tsx            Landing page (web) / redirect to /explore (native)
  (auth)/              login, signup, forgot-password
  (tabs)/
    _layout.tsx(.web)  Native Tabs (Explore / Search / Arena / Profile)
    explore(.web).tsx  Home magazine feed  → docs/features/explore-feed-and-pulse.md
    search/            Federated search    → docs/features/search.md
    versus(.web).tsx   Arena hub           → docs/features/arena-and-matchups.md
    profile(.web).tsx  Profile             → docs/features/profile-and-gamification.md
  character/[id]       Flagship detail     → docs/features/character-page.md
  biography/[id]       Long-form ComicVine biography
  social-web/[id]      Relationship-graph explorer
  compare/             Battle builder + arena result pages
  versus/team/         Team battles (daily [battleId] + drafted)
  play.tsx(.web)       Daily "Guess the Hero" → docs/features/dailies-and-streaks.md
  house/               Family dynasties (index + [slug]) → docs/architecture/family-trees-and-houses.md
  event/               Live-event dossiers (index + [slug])
  category/[slug]      One source-aware browse screen — universe/ and franchise/ re-export it
  team/[id] · title/[id] · issue/[id] · film/[tmdbId] (legacy redirect)
  admin/health         Web-only command center → docs/features/admin-command-center.md
  settings / support / privacy / terms

api/                   Vercel serverless crawler surface (OG cards, share-meta,
                       bot pages) — its own package, NOT part of the app
                       build → docs/features/sharing-and-og.md

src/
  components/          UI by domain: home/ versus/ compare/ character/ profile/
                       search/ takes/ game/ family/ event/ film/ contribute/
                       report/ landing/ admin/ web/ skeletons/ ui/ …
  constants/           colors.ts (COLORS) · publishers.ts (PUBLISHER_BRANDS
                       universe registry) · heroImages.ts
  hooks/               ~45 platform-neutral screen hooks — find the hook first
  lib/
    supabase.ts        createClient<Database>() — import this, never re-create
    api.ts             External REST (SuperheroAPI, ComicVine)
    db/                Per-table DB access (heroes barrel, favourites, takes, …)
    query/             React Query hooks + cache keys
  types/
    database.generated.ts   Auto-generated from Supabase — NEVER edit manually
    index.ts                App types (derives Hero/UserFavourite from generated)

supabase/
  migrations/          Version-controlled SQL migrations
  functions/           Edge functions (enrichment drains, verdicts, push, …)
  seed.sql             initial seed (DB has grown to ~34,000 heroes)

scripts/brand/         Brand asset generators — build-splash.mjs draws the
                       native splash lockup AND the outlined wordmark the
                       boot stage renders, so both come from one source
scripts/social/        Social content factory → docs/brand/design-language.md
__tests__/             Jest tests mirroring src/ structure
```

## Database conventions

### Types

- `src/types/database.generated.ts` is generated by the Supabase MCP tool (`mcp__supabase__generate_typescript_types`). Regenerate it after every migration — never edit it by hand.
- App types in `src/types/index.ts` derive from generated types: `export type Hero = Tables<'heroes'>`.

### Query layer

- Screens **never** import `supabase` directly. All DB access goes through `src/lib/db/`.
- `src/lib/api.ts` handles external REST APIs (SuperheroAPI, ComicVine).
- Supabase/PostgREST has a default 1000-row cap — always add `.limit()` or use `.range()` for pagination on large tables. The `heroes` table has ~34,000 rows.

### Popularity / fame ranking

- Popularity ordering uses `heroes.fame_score` (0–100), **not** `issue_count`. It's a mainstream-recognizability score computed by the `recompute_fame_scores()` SQL function from `fame_tier` (a 0–4 recognizability tier hand-rated by Claude for the ~2k-hero candidate pool; everyone else defaults to 0) plus winsorized `wikidata_sitelinks` + `movie_count` + `issue_count`. Design/plan: `docs/superpowers/specs/2026-06-27-hero-popularity-fame-score-design.md`.
- `compute_fame_score(tier, n_site, n_movie, n_issue)` is the pure blend; tier sets the band, hard signals position within it. Re-tune by editing constants, bumping `fame_score_version`, and re-running `recompute_fame_scores()` — no re-rating needed.
- After large catalog growth, re-rate new candidate-pool heroes (those with `fame_rated_at IS NULL`) and re-run the recompute. `wikidata_sitelinks` is backfilled by `enrich-wikidata-batch`.

### Migrations

- All schema changes must be a new SQL file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`.
- Apply via the Supabase MCP tool (`mcp__supabase__apply_migration`), not manually in the dashboard.
- After applying a migration, regenerate `database.generated.ts`.

## Environment variables

Stored in `.env.local` (gitignored). See `.env.example` for required keys.

| Variable                   | Used by                                        |
| -------------------------- | ---------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts` via `process.env`        |
| `EXPO_PUBLIC_SUPABASE_KEY` | `src/lib/supabase.ts` via `process.env`        |
| `SUPERHERO_API_KEY`        | `app.config.ts` → `Constants.expoConfig.extra` |
| `COMICVINE_API_KEY`        | `app.config.ts` → `Constants.expoConfig.extra` |

`EXPO_PUBLIC_*` vars are inlined by Metro at build time. Never read them via `expo-constants`.

## Auth + navigation

`app/_layout.tsx` renders an `AuthGate` child component (must be a child, not the root, so the router context exists). It uses `useSegments` + `useRouter` to redirect:

- Authenticated landing on an auth screen or the root → `/explore`

The app is **not** fully auth-gated: logged-out users can browse `/explore` and the rest of the catalogue. **Matchup votes are anon-friendly**: `cast_matchup_vote_v2` / `get_matchup_tally_v2` are granted to `anon` and dedupe by a per-device voter key (`src/lib/voterKey.ts`) — no login wall at the vote moment (`useMatchupVote`). Other per-user writes (favourites, takes, profile edits) still require auth: check `useAuth().user` and route to `/(auth)/login` when absent — those RLS-locked RPCs reject anon and otherwise fail silently.

## Testing

Tests live in `__tests__/` mirroring the source tree. Run with `yarn test:ci`.

- Unit-test pure logic and hooks with mocked Supabase/fetch.
- Do not test navigation or rendering of full screens — keep tests fast and focused.
- The `act()` warnings from React 19 in `useAuth.test.ts` are cosmetic; the tests pass.

## Ratchets

Two counts in this repo may fall and may not rise. Both exist because the
alternative — a rule strict enough to fail on every existing violation — is a
rule someone turns off, which is how the last three token files ended up
decorative.

- **Lint warnings.** `yarn lint` runs with `--max-warnings=71`. Zero errors is
  the hard floor; the warnings are the budget. If a change adds one, either fix
  it or, when the pattern is genuinely deliberate, declare it with an
  `eslint-disable-next-line` **and a reason on the line above** — the lazy
  `require()`s for native modules are the worked example. Lower the number in
  `package.json` in the same commit whenever you clean some up; that is how the
  budget tightens.
- **Off-scale design values.** `yarn check:ui` counts radius and font literals
  that are not on the scale, against `scripts/ui/design-baseline.json`. It fails
  when the count rises and *tells you* when it has slack, so a cleanup can be
  banked rather than quietly absorbed.

The point of both is that an exception has to be an explicit, reviewed act
rather than one more entry in a number nobody reads.

## Code style

- TypeScript throughout — no `any`, prefer `unknown` for caught errors.
- Functional components only.
- `StyleSheet.create` for all styles — no inline style objects except `StyleSheet.absoluteFill`.
- Font families: `Flame-Regular` for headings, `FlameSans-Regular` for body, `Nunito_*` for
  UI text. **Never `Flame-Bold`** — the bold cut's strokes close up the counters at
  heading sizes, so the word reads as a shape rather than as letters, and it gets
  worse the larger it is. The face is not registered in either root layout and is not
  embedded by the expo-font plugin, so a reference to it falls back to the system
  font; `yarn check:ui` fails on the string. Weight comes from size and colour, not
  from a heavier cut.
- Background colour: `#f5ebdc` (`COLORS.beige`) — the app's base canvas.
- **No emoji anywhere in the product.** UI copy uses vector icons
  (Ionicons/MaterialCommunityIcons) and typography, never emoji — they render
  as coloured glyphs that ignore the palette, differ per OS, and read as
  filler. Text-presentation symbols are fine (★ ratings, † deceased,
  ❖ ornament, ✓). The two content exceptions (the daily-game share payload,
  social captions) are allowlisted by file. Enforced by `yarn check:ui`.
- **Horizontal rails bleed to the screen edge — never clipped by parent
  padding.** A horizontal `ScrollView`/`FlatList` inside a padded container
  clips its content at the padding box: cards cut off at both edges, and the
  scrolled-in content vanishing early. Either keep the scroller's ancestors
  unpadded and put the inset on `contentContainerStyle`, or escape a padded
  parent with the pair:
  `style={{ marginHorizontal: -H_PAD }}` +
  `contentContainerStyle={{ paddingHorizontal: H_PAD }}`.
  The rail's first card then aligns with the page inset, but content scrolls
  all the way to the physical screen edge.
- **Every `withRepeat(..., -1)` needs a Reduce Motion check AND a resting value.** An endless loop is the most literal thing Reduce Motion exists to suppress — more so than any transition, because it never stops. Park it at the state that reads as CORRECT rather than wherever it was cancelled: full opacity for a live indicator (30% looks broken), the end state for a loader (0 is a loader that loads nothing), and don't draw a travelling highlight at all (held still it is a bright band at one edge, which reads as a rendering defect). Loops on a screen inside `NativeTabs` also need `useScreenFocused` — native tabs keep every screen mounted, so an unpaused loop runs forever on a tab nobody is looking at.

- **Never put a `perspective`/`rotateX`/`rotateY` transform on a view a later transform scales up.** iOS rasterises a 3D-transformed layer differently, and a view magnified afterwards gets clipped — a hard straight edge through the artwork, on device only. Established by A/B in `BootStage` across four shipped builds: the 3D tilt was removed and the clipping stopped, restored on its own and it came straight back. The arithmetic said it was safe every time (bounded keystone, near edge at 16% of the camera distance, level before any large scale) and it clipped regardless — reasoning is not the missing ingredient here, a device is. If a depth cue is wanted, approximate it with a 2D affine (skew + axis-differential scale), which cannot change how the layer is rasterised. A smaller angle is not a fix.

- **An absolutely-positioned box that a transform SCALES must declare its own `width`/`height`.** A box with only `left`/`top` is sized by Yoga from what is left of the parent. Harmless for a badge pinned inside its parent; destructive for anything a transform then multiplies. A box positioned at a negative `left` (because it is a large square centred on a small mark) gets silently clamped, which both clips its content and moves its centre — the origin the transform scales about. In `BootStage` that was a 29.7pt origin shift plus a 9pt clip, which the reveal magnified into 362pt of drift and most of a mask shorn off. Anything a transform multiplies has to be exactly right _before_ the transform touches it.

- **Clamped Flame text needs `lineHeight ≥ 1.22× fontSize`.** The Flame font's ink spans ~119% of its em box (tall caps + deep descenders). Any `Text` with `numberOfLines` set to a `Flame-Regular` style clips its descenders (`g`/`y`/`p`) if `lineHeight` is tighter — RNW turns `numberOfLines` into `-webkit-line-clamp` + `overflow: hidden`, so the descender gets cut. Non-clamped Flame text overflows visibly and is fine at any line-height.

## Platform-specific files (`.web.tsx` / `.tsx`)

Several screens have a native (`foo.tsx`) and web (`foo.web.tsx`) version; Metro
picks by platform extension. Keep these as **thin view layers**: shared data
fetching, state, and derived values belong in a platform-neutral hook in
`src/hooks/` (no `.web`/`.native` suffix, so both views import the same one).
Do **not** duplicate `useEffect`/fetch logic across the pair — change it once in
the hook. When adding a screen with a web variant, both `foo.tsx` and
`foo.web.tsx` must exist or expo-router throws a resolution error.

## Reading screenshots from a dev build

The user tests on an **Expo dev client**, so screenshots contain Expo's own
chrome on top of the app. Do not report these as app bugs:

- **The floating gear / bubble** (usually top-right, sometimes overlapping real
  controls) is the **expo-dev-client debug menu launcher**. It is not in the
  app, it is not in production builds, and there is nothing in this repo that
  renders it.

Before calling anything in a screenshot a layout bug, check it exists in the
source. If you cannot find the element in `app/` or `src/`, it is dev-client
chrome or an OS overlay.

## Working efficiently in this repo (for agents)

- **Find the hook first.** Screen logic lives in `src/hooks/` and
  `src/lib/query/`. Read the hook, not the giant view file, to understand data
  flow.
- **Don't read these unless required:** `src/types/database.generated.ts`
  (1.5k auto-generated lines — use `src/types/index.ts` for app types instead),
  and the `.web.tsx` view files (large JSX). They're excluded from search via
  `.ignore` where appropriate.
- **Scope searches** to `src/` and `app/`. `docs/superpowers/**` and `yarn.lock`
  are excluded from `rg`/Grep via the repo's `.ignore` file — read them by
  explicit path only when needed.

## Map: where things live

| Concern                        | Path                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| Screens / routes               | `app/` (expo-router file-based)                                  |
| Reusable hooks                 | `src/hooks/`                                                     |
| React-Query data hooks + cache | `src/lib/query/`                                                 |
| DB access (per-table modules)  | `src/lib/db/`                                                    |
| External REST APIs             | `src/lib/api.ts`                                                 |
| UI components                  | `src/components/` (admin → `admin/`, web-only → `web/`)          |
| Types                          | `src/types/index.ts` (app) · `database.generated.ts` (generated) |
| Palette / constants            | `src/constants/`                                                 |
| SQL migrations                 | `supabase/migrations/`                                           |
| Edge functions                 | `supabase/functions/`                                            |
| Crawler / OG surface           | `api/` (own package — see `docs/features/sharing-and-og.md`)     |
| Feature-domain docs            | `docs/features/` — index at `docs/README.md` (read first)        |
| Data pipelines / enrichment    | `docs/architecture/data-pipelines.md` (read it first)            |
| Family trees / houses          | `docs/architecture/family-trees-and-houses.md` (read it first)   |
| Builds / OTA updates           | `eas.json` · `docs/architecture/builds-and-updates.md`           |
