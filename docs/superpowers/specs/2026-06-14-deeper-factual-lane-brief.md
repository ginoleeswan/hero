# Lane 3 — Deeper Factual + Cross-Media Appearance Backbone (Kickoff Brief)

**Date:** 2026-06-14 (revised: media-appearance-sourcing folded in)
**Status:** Brief — needs its own brainstorming → spec → plan cycle.
**Part of:** `2026-06-14-enrichment-roadmap.md`

> Open this brief in a fresh tab, run the **brainstorming** skill to resolve the
> open questions below, write a full design spec, then plan.

## Goal

Two interlocking jobs, both powered by **Wikidata**:

1. **Cross-media appearance backbone (the big one).** Source *which* films, TV
   series, and video games each hero appears in — the linkage ComicVine can't
   give us (its `movies` relation is film-only). This becomes the single source
   of "appears-in" edges that feeds media enrichment (Lane 1).
2. **Encyclopedic facts.** Voice actors/performers, canonical first-appearance
   dates, creator credits, awards, publisher — structured data SuperheroAPI and
   ComicVine don't provide.

## Why Wikidata makes the appearance backbone clean

Wikidata models a fictional character and the works it appears in, and — crucially
— stores the **external IDs we need as first-class properties**, so we skip the
fuzzy title-matching the film lane had to do:

- **TMDB movie ID** (P4947), **TMDB TV series ID** (P4983) → enrich via the TMDB
  pipeline we already built (Lane 1).
- **IGDB game ID** (P5794) → enrich via a new IGDB pipeline.
- The character node links to works via "present in work" (P1441) / "performer"
  (P175) / "characters" (P674) relations, classified by the work's type
  (film / television series / video game).

So one SPARQL query per resolved hero yields a typed, ID-stamped list of media
appearances across all three media types — no title search, no `unmatched`
guessing for anything Wikidata has covered.

## How it interlocks with Lane 1 (media enrichment)

- **Wikidata (this lane) = appearance edges + external IDs.**
- **TMDB (Lane 1) = enrich film *and* TV** titles (posters, backdrops, trailers,
  cast, stills, providers). The existing `enrich-tmdb-batch` generalizes from
  `/movie/{id}` to also handle `/tv/{id}`.
- **IGDB (new) = enrich games** (box art, screenshots, trailers, platforms,
  ratings).

ComicVine's `movies` relation stays as a supplementary film source / fallback for
heroes Wikidata doesn't cover.

## Data model (generalize Lane 1's film tables)

The `films` + `hero_film_appearances` tables from Lane 1 generalize into a
media-agnostic backbone (decide exact shape in brainstorming):

- **`titles`** (rename/extend `films`): `id`, `media_type` ('film' | 'tv' |
  'game'), `source` ('tmdb' | 'igdb'), `external_id`, plus the shared media
  columns (title, year, poster/backdrop/art, rating, overview, trailer_key,
  providers, etc.) + source-specific extras. Migrate existing `films` rows in as
  `media_type='film', source='tmdb'`.
- **`hero_media_appearances`** (rename/extend `hero_film_appearances`):
  `(hero_id, title_id, media_type, rank, source)`.
- **`heroes.wikidata_qid`** (1-to-1 external id) — resolved once, reused.
- **`hero_people`** side-table for 1-to-many facts (voice actors, performers,
  creators) — `(hero_id, person_name, role, source)`. Shares a concept with the
  TMDB `cast` we already store on titles.
- Public-read RLS on all new tables. Keep an `unmatched`/status column per the
  TMDB pattern so unresolved heroes aren't retried forever.

## The hard part: entity resolution (heroes → QID)

Matching a hero row to the correct Wikidata QID is the crux (same-named
characters, reboots, alternate versions). Approach: search by name + disambiguate
using publisher / first-appearance / alias hints already in `heroes`; store the
resolved `wikidata_qid` once. Marquee heroes may warrant a manual-review pass.
(Note: once the QID is right, the *media* IDs come for free — resolution effort
is front-loaded onto the character, not every title.)

## Pipeline

- New `resolve-wikidata` + `enrich-wikidata` edge-function drains (popularity-
  ordered, logged to `enrichment_runs` + `api_usage`). Wikidata SPARQL is free and
  generous (be polite; cache QID resolution).
- New `enrich-igdb-batch` for game titles (IGDB needs a Twitch client id/secret →
  `app.config.ts` extra, server-side only).
- Generalize `enrich-tmdb-batch` to enrich TV as well as film.

## Open questions for brainstorming

1. Generalize `films` → `titles` in place (one migration), or add parallel
   `tv`/`games` tables? (Generalizing is cleaner long-term but a bigger migration.)
2. Wikidata-only first, or Wikidata + Marvel API together for the facts half?
3. Entity-resolution confidence threshold + manual-review path for marquee heroes.
4. Which facts surface in the UI vs. only power search/relationships?
5. Should the On-Screen section split by media type (Films / TV / Games tabs or
   shelves), or interleave? (Coordinate with the Lane 1 UI we already built.)
6. IGDB now, or land Wikidata + TV first and add games as a fast follow?

## Collision notes

This lane now **owns the media backbone**, so it touches Lane 1's tables
(`films`/`hero_film_appearances`) and the On-Screen UI — coordinate closely rather
than treating it as independent. Also touches `app.config.ts` extra (Marvel/IGDB
keys) and the character screen. Sequence after Lane 1 is stable (it is).
