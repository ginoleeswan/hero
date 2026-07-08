# Ad-Safe Content Factory — Design

**Date:** 2026-07-08
**Status:** Approved (user), pre-implementation
**Builds on:** `scripts/social/ads/` (Safe Ad System), `scripts/social/lib.mjs`
(`renderPng`/`renderVideo`), `music.mjs`, `safety.mjs`, the command-center
Publish lane (`social_posts` + `SocialDomain.tsx`).

## Problem / goal

The user needs a **large, varied library of ad-safe (franchise-free) social
content — reels AND carousels for Instagram + TikTok** — generated in one run
(~30 pieces / month) so they can browse and pick a fresh, non-repeating piece
for any day. Today the only ad-safe assets are *static single images* (brand
looks, one matchup, one ranking); the existing reel/carousel generators show
**character faces**, so they are organic-only. This project adds a unified
factory: one variety engine feeding two face-free renderers, publishing the
batch to the command-center Publish tab as a browsable, filterable library.

## Non-negotiable: ad-safety

Everything this system produces must be **safe to boost as a paid ad.** Enforced
in four layers:

1. **No portraits, ever — enforced in code.** Renderers draw from *data only*
   (stat bars, radars, rank lists, names, text). There is no hero-image code
   path. This is the aesthetic (face-free plates / mystery / redaction), not a
   restriction bolted on.
2. **Names only = nominative use.** Character names as text ("Goku vs Superman —
   who wins?") are informational/fan use — the same call `ad-matchup`/
   `ad-ranking` already make. No likeness, logo, or official art.
3. **Disclaimer baked in.** `shell.mjs` stamps "Unofficial fan encyclopedia.
   Characters © their respective owners." on every render; reels get it too.
4. **Render-time safety assertion.** Before any asset is written, the pipeline
   scans the rendered HTML for a hero-image URL / portrait reference and
   **hard-fails** if found. Only passing assets are marked `ad_safety: 'ad_safe'`.
   Unit-tested so a future edit can't silently reintroduce a face.

**Optional tier filter** (`--exclude-tier-s`, off by default): excludes Tier-S
*names* (Marvel/Disney/anime, per `safety.mjs`) from ad output for maximum
caution. Off by default because names are safe; available if wanted.

## Architecture

```
  ads/data.mjs      ← ad-safe data selectors (matchup pairs, rankings, guess
        │             targets, facts) from the catalogue, by fame, names only
  ads/plan.mjs      ← variety engine: buildPlan({ n, seed, mix }) → entries
        │             rotating 4 angles × 2 formats, deterministic + no-repeat
        ├─→ ads/render-carousel.mjs   → multi-slide PNGs (reuses shell.mjs)
        └─→ ads/render-reel.mjs       → face-free 9:16 MP4 + poster (renderVideo)
        │
  ads/batch-month.mjs → plan → render all → manifest (batch dir + PLAN.md + gallery)
        │
  publish-posts.mjs  → collect ad-library batch → upload (Cloudinary, incl.
        │               video resource_type) → upsert social_posts (ad_safe)
        │
  SocialDomain.tsx   → video card (poster + play/download) + angle/format
                        filter chips for the large library
```

### File structure

| File | Responsibility |
| --- | --- |
| `scripts/social/ads/data.mjs` (new) | Ad-safe selectors: `pickMatchup`, `pickRanking`, `pickGuess`, `pickFact` — return names + stats, never portraits |
| `scripts/social/ads/plan.mjs` (new) | `buildPlan({ n, seed, mix, excludeTierS })` → `PlanEntry[]`; the variety/no-repeat logic (pure, tested) |
| `scripts/social/ads/safe-assert.mjs` (new) | `assertNoPortrait(html)` — throws if a hero-image reference is present (tested) |
| `scripts/social/ads/render-carousel.mjs` (new) | `renderCarousel(entry) → { dir, slides[], caption }` |
| `scripts/social/ads/render-reel.mjs` (new) | `renderReel(entry) → { dir, mp4, poster, caption }` |
| `scripts/social/ads/batch-month.mjs` (new) | Orchestrator: plan → render → write batch dir + gallery + manifest |
| `scripts/social/publish-posts.mjs` (modify) | Collect the ad-library batch, upload video, set media_type/video_url/angle |
| `supabase/migrations/*_social_posts_media.sql` (new) | `+ media_type`, `+ video_url`, `+ angle` |
| `src/lib/db/socialPosts.ts` (modify) | Type additions (regen from generated types) |
| `src/components/admin/health/domains/SocialDomain.tsx` (modify) | Video card + angle/format filter chips |
| Tests | `plan.test.mjs`, `safe-assert.test.mjs`, `data.test.mjs` |

## Variety engine

`buildPlan({ n = 30, seed, mix = { carousel: 18, reel: 12 }, excludeTierS = false })`:

- Rotates the 4 **angles** (`matchup`, `ranking`, `guess`, `fact`) across the 2
  **formats** to hit the `mix`, ensuring every angle appears in both formats.
- Selects data per angle, **seeded** (a batch never repeats; different seeds →
  different months):
  - **matchup** → a rivalry pair, or two fame-ranked heroes with contrasting
    stats ("brains vs brawn").
  - **ranking** → a stat dimension (`strength`/`speed`/`intelligence`/
    `durability`/`power`/`combat`/`fame`) × scope (overall or by universe) → top
    N. ~20 distinct rankings before any repeat.
  - **guess** → a hero with a distinctive stat spread → radar + name reveal.
  - **fact** → a narrative fact (`hero_narrative_facts`) or a computed
    superlative ("most connected", "most live-action appearances", "fastest
    rated").
- Returns `PlanEntry { angle, format, title, data, caption, music }`.

`PlanEntry` is the single interface between the engine and both renderers.

## Renderers

### Carousel (`render-carousel.mjs`)
Multi-slide PNGs (all ratios the tab needs; 4x5 cover first). Reuses `shell.mjs`
+ the existing ad slide builders. Per angle:
- matchup → hook slide · stat rounds · "who's right?" slide
- ranking → title slide · rank reveals · CTA slide
- guess → radar slide · "who is it?" · answer slide
- fact → fact slide · supporting stat · CTA slide

### Reel (`render-reel.mjs`) — 9:16 MP4, quality-gated
Face-free video via `renderVideo`, one animated template per angle. **Quality is
a first-class requirement** (see below). Music suggestion per reel via
`music.mjs`.
- **matchup** → mystery plates (? vs ?) slam in → round-by-round stat tug-of-war
  (numbers count up, bar fills, "X takes it") → vote-split reveal → "who's
  right? 👇"
- **ranking** → "TOP 10 STRONGEST" → countdown #10→#1, each a name + stat bar
  sliding in, #1 with a flourish → "agree?"
- **guess** → stat radar draws in → "who has these stats?" → 3·2·1 → name reveal
- **fact** → bold fact card motion → supporting stat → "explore 35k → mythique.app"

### Reel quality bar (explicit acceptance criteria)
- **Aspect ratio: exactly 1080×1920 (9:16)** — TikTok/IG Reels/Shorts native.
- **Scroll-stopping hook in the first ~1.5s** — the question/number/claim lands
  immediately; no slow intro.
- **Motion design, not slideshow** — deliberate easing, staggered entrances,
  count-ups, a flash/impact on the reveal (reuse the existing reel's
  `slam`/`pop`/`flash`/`shake`/`burst` keyframe vocabulary). Runs on the premium
  brand system (ink stage, gold, Flame display, grain) — **must not read as a
  generic AI/template reel.**
- **Short + loopable** — target ~7–15s; ends on a beat that invites a rewatch or
  a comment (the argument/reveal), not a dead card.
- **Native-format grammar** — countdowns, "who would win", 3-2-1 reveals: the
  formats the platforms already reward.
- **Baked on-screen text hooks** (music is added in-app; captions/hook text are
  rendered into the video).

## Publish + data model

Migration adds to `social_posts`: `media_type text not null default 'image'`,
`video_url text`, `angle text`. Reels: `image_url` = poster frame (thumbnail),
`video_url` = MP4, `media_type = 'video'`. Carousels: `slide_urls[]` as today,
`media_type = 'image'`. `angle` drives the filter chips.

`publish-posts.mjs` gains an ad-library collection pass: uploads carousel PNGs +
reel MP4 (Cloudinary `resource_type: 'video'`) + poster, upserts rows with
`ad_safety: 'ad_safe'`, `batch: 'ad-library'` (or `ad-library-YYYY-MM`),
`angle`, `media_type`, `video_url`, `guide_music`.

## Publish tab UI

- **Video card**: poster thumbnail with a play badge; tap → open the MP4
  (download for posting). Reuses the existing card grammar.
- **Filter chips** (angle + format): `All · Matchup · Ranking · Guess · Fact ·
  Reels · Carousels` — a single active filter narrows the library; keeps 30+
  items navigable on a phone. Client-side over the loaded `social_posts`.
- The library batch renders in the existing `CardGrid`.

## Volume / defaults

- Default run: **~30 pieces**, `mix = { carousel: 18, reel: 12 }` (tunable via
  flags). Carousels are cheap; reels are ~30–60s of ffmpeg each, so a full run
  is minutes, not seconds — acceptable for a monthly batch.
- Idempotent per `(batch, ord)`; re-running overwrites the same rows.

## Testing

- `plan.test.mjs` — mix distribution hits target, every angle present, no
  intra-batch repeats, `excludeTierS` removes Tier-S names, determinism by seed.
- `safe-assert.test.mjs` — `assertNoPortrait` throws on a hero-image URL, passes
  clean data HTML.
- `data.test.mjs` — selectors return names + stats and never a portrait field.
- Renderers verified by rendering a sample of each angle/format and eyeballing
  (reels checked for the 1080×1920 dimension + hook timing); not unit-tested
  (they're HTML→media).

## Constraints / invariants

- **Ad-safe by construction** — the four-layer guarantee above is the spec's
  central invariant.
- Reuse `shell.mjs`, `renderPng`, `renderVideo`, `music.mjs` — do not fork the
  render pipeline.
- Names OK; portraits never.
- Web Publish tab stays the pick surface; video support is additive (image
  posts unchanged).
- `yarn only`; TypeScript no `any`; migration via Supabase MCP then regen types.
