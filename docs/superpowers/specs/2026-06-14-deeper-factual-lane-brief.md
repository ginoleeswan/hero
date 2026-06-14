# Lane 3 — Deeper Factual Enrichment (Kickoff Brief)

**Date:** 2026-06-14
**Status:** Brief — needs its own brainstorming → spec → plan cycle.
**Part of:** `2026-06-14-enrichment-roadmap.md`

> Open this brief in a fresh tab, run the **brainstorming** skill to resolve the
> open questions below, write a full design spec, then plan.

## Goal

Add encyclopedic, structured facts that ComicVine/SuperheroAPI don't provide:
voice actors, canonical first-appearance dates, creator credits, awards, and
cross-media presence. This is the most "encyclopedia"-flavored lane and the
heaviest plumbing per source.

## Candidate sources

- **Wikidata** (free SPARQL, structured) — first-appearance dates, creators, voice
  actors/performers, awards, "present in work" cross-media links, publisher. Best
  structured-data-to-effort ratio; no API key.
- **DBpedia** — similar, complementary coverage.
- **Marvel API** (official, free key) — canonical Marvel-only events, series, and
  comic appearance counts. Marvel-only, so partial catalog coverage.

Recommend starting with **Wikidata** for breadth (covers DC, Marvel, indie) before
adding the publisher-specific Marvel API.

## The hard part: entity resolution

Matching a hero row to the correct Wikidata QID is the crux (many same-named
characters, reboots, alternate versions). Likely approach: search by name +
disambiguate using publisher/first-appearance hints already in `heroes`; store the
resolved `wikidata_qid` once and reuse. Record unmatched explicitly (mirror the
TMDB `unmatched` status) so resolution isn't retried forever.

## Likely data model

- `heroes.wikidata_qid` (1-to-1 external id) — acceptable as a `heroes` column.
- A `hero_people` (or `hero_credits`) side-table for 1-to-many facts: voice actors,
  performers, creators — `(hero_id, person_name, role, source)`. Sets up the future
  link from TMDB `cast` (Lane 1) into a shared people concept.
- An `external_ids` pattern if more sources accrue.
- Public-read RLS on all new tables.

## Pipeline

A new edge function drain, popularity-ordered, logged to `enrichment_runs` +
`api_usage`. Wikidata SPARQL is generous; Marvel API has its own rate limits — add
a key to `app.config.ts` extra (server-side only) if used.

## Open questions for brainstorming

1. Wikidata first, or Wikidata + Marvel together?
2. Which facts surface in the UI vs. just power relationships/search?
3. Entity-resolution confidence threshold and manual-review path for marquee heroes.
4. Should `hero_people` be the shared people table that TMDB cast (Lane 1) also
   feeds, or keep them separate for now? (Coordinate with Lane 1 owner.)

## Collision notes

Most independent lane (own sources, own tables). Touches `app.config.ts` extra
(Marvel key) and `[id].tsx` (one new section component). Coordinate the "people
table" shape with Lane 1 if you want voice-actor ↔ film-cast linking later.
