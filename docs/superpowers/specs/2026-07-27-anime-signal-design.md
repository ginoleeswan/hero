# Coverage — an anime signal, because Wikipedia cannot see one

**Date:** 2026-07-27
**Status:** Design. Nothing built.
**Related:** the surge lane in `2026-07-26-pulse-tuning-guide.md`, which this
extends with a second sensor rather than replacing.

---

## 1. The measurement

**Jujutsu Kaisen: The Culling Game** landed on Netflix on 2026-07-23 with twelve
episodes. Measured on 2026-07-27, four days later:

| Character       | Spike     |
| --------------- | --------- |
| Satoru Gojo     | **1.02×** |
| Yuji Itadori    | 0.98×     |
| Monkey D. Luffy | 0.94×     |
| Tanjiro Kamado  | 1.10×     |

One Piece's Elbaf arc closed its first cour in the same window. Anime Expo
announced a Solo Leveling film and a Demon Slayer streaming date.

Nothing moved. Compare the same instrument on the same days: Doctor Doom 10.4×,
He-Man 5.5×, Moss Man 11.0×.

**That is not a quiet week. It is the wrong instrument.** Anime fandom does not
read English Wikipedia — it watches on Crunchyroll and Netflix, tracks on MyAnimeList
and AniList, and argues on Reddit and X. The one freshness signal the app has is
structurally blind to a whole vertical of its own catalogue.

## 2. Why it matters here specifically

This is not a hypothetical gap. Shueisha and Kodansha are real parts of the
catalogue — they appear in `heroes.publisher`, they ship the comics the New Comics
rail carries weekly, and the anthology work of 2026-07-27 was entirely about
getting their issues _right_.

So the app carries the content and cannot see when it matters. Every surface built
on the pageview signal — Trending Movers, the surge lane, the live card's "Moving
fastest" — is Western-comics-only by accident.

## 3. The source: AniList

AniList's GraphQL API is **free, keyless, and rate-limited politely**. It exposes
per-title trending and popularity that update continuously, plus characters per
title.

Why it over the alternatives:

- **MyAnimeList** — larger, but its official API needs OAuth and its trending data
  is thinner.
- **Crunchyroll** — no public API; a release calendar would have to be scraped.
- **TMDB** — already integrated and already failing here: anime series are
  sparsely covered and their TMDB popularity does not track fandom attention.

AniList's `Media.trending` is the closest thing to "what anime people are paying
attention to right now" that can be read without a key.

## 4. The hard part is not fetching, it is mapping

Every prior external-id integration in this repo has cost more in **matching** than
in fetching, and the failures are documented:

- ComicVine name-resolution matched Bane to Wolfsbane and collided on a unique
  `comicvine_id` (`project_comicvine_resolve_collision`).
- IGDB game characters arrived with the wrong publisher and franchise, and hundreds
  are still wrong.
- Wikidata resolution only became reliable once it used a **deterministic**
  CV-ID → QID path instead of fuzzy name matching.

So the mapping strategy has to be decided up front, not discovered:

1. **Deterministic first.** AniList exposes `idMal`. If any hero or title already
   carries a MAL id, that is an exact join. Check coverage before anything else —
   if it is near zero, this whole approach changes shape.
2. **Title-level, not character-level.** Map AniList _media_ to `titles`, then use
   the existing `hero_media_appearances` links to reach characters. Mapping
   thousands of anime characters by name is the trap that produced the IGDB debt.
3. **Store the id.** `titles.anilist_id`, resolved once, never re-fuzzed. A
   `no_match` sentinel so an unmatched title is not retried forever — the same
   pattern as `comicvine_status = 'unmatched'` and the blurhash `''` sentinel.
4. **Manual for the marquee few.** A dozen hand-mapped franchises (One Piece,
   JJK, Demon Slayer, Chainsaw Man, Solo Leveling) probably covers most of the
   attention. Do those first and measure whether automation is even needed.

## 5. Shape

- `sync-anilist-trending` edge function, daily. Fetches trending media, resolves to
  `titles` via stored `anilist_id`, writes a trending rank and timestamp.
- A new Pulse kind, or — more likely — **the existing `surge` kind with a second
  source**. The card says "surging"; whether the evidence came from Wikipedia or
  AniList is an implementation detail the reader does not need.
- The `surge_started_at` dating trick needs an equivalent. AniList trending is a
  rank rather than a curve, so either store a daily rank series (the same
  fetch-and-keep move that made `views_daily` work) or use rank-entry date as the
  event time.

## 6. Non-goals

- **Replacing the Wikipedia signal.** It works well for Western comics and film.
  This is a second sensor for a blind spot, not a migration.
- **Ingesting anime characters wholesale.** The catalogue's problem is depth, not
  breadth (`project_catalogue_depth_strategy`): ~50k rows of which a small
  fraction are good. Adding thousands of thinly-populated anime characters would
  make that worse, not better.
- **Episode-level tracking.** A weekly episode is the anime equivalent of the
  comic shipment — a regular cadence, and `KIND_CAP` exists because regular
  cadences crowd out irregular news.

## 7. Open questions, in the order they should be answered

1. **How many `titles` can be resolved to an AniList id at all?** If the answer is
   "a handful", the manual-marquee route is the whole project and §5 is overkill.
2. Does AniList trending actually move on the events that matter? Backtest against
   2026-07-23 (JJK on Netflix) before building anything — if it did not move
   either, the premise is wrong and this document should be deleted rather than
   implemented.
3. Is the right unit a _series_ or a _franchise_? One Piece has a manga, an anime,
   films and a live-action series. The surge lane already groups by publisher for
   exactly this reason.

## 8. How we would know it worked

The bar is concrete and pre-registered: **on the next comparable anime event, the
Pulse surfaces it.** JJK hitting Netflix moved the current signal by 2%. If the new
sensor cannot beat that on a rerun of the same week, it has not earned its cron.
