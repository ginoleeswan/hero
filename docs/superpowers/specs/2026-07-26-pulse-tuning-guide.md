# The Pulse / Live Events — working reference

**Date:** 2026-07-26 · **last verified 2026-07-27**
**Companion to:** `2026-07-26-live-events-and-pulse-design.md` (the _why_, and the
measurements every threshold came from). This file is the _where_ — for making
edits and tweaks without re-reading the whole design.

---

## 1. What this feature is, in one paragraph

Explore's "Right Now" band used to report **states** ("in cinemas", "197k
pageviews"), which stay true for months and so never give anyone a reason to open
the app today. It now also reports **events** — things that happened at a knowable
time. Three sources: a real-world event detected from Wikipedia attention (SDCC),
a trailer drop from TMDB, a comic hitting shelves. They're scored into one ranked
feed and rendered as the **Pulse rail** at the top of the band, plus an honest
freshness label in the header and a hero that prefers today's news over a random
popular title.

---

## 2. Every knob, and what happens if you turn it

### Event detection — `src/lib/events/detect.ts`

Is a real-world event (SDCC, a Direct) happening right now? Two Wikipedia signals,
both required.

| Constant            | Line | Now  | Turn it up →                            | Turn it down →                                                       |
| ------------------- | ---- | ---- | --------------------------------------- | -------------------------------------------------------------------- |
| `RECENT_DAYS`       | 86   | 4    | Slower to notice, steadier              | Twitchier                                                            |
| `SPIKE_MIN`         | 88   | 2.5  | Fewer false positives                   | NYCC (1.74×) starts passing                                          |
| `EDIT_BURST_MIN`    | 90   | 4    | —                                       | Weak gate; see below                                                 |
| `EDITS_ABS_MIN`     | 96   | 3    | Stricter                                | **This is the real veto.** Drop to 1 and any drive-by edit qualifies |
| `MIN_PEAK_VIEWS`    | 109  | 250  | Small cons (CCXP, Lucca) can never fire | Tiny-article noise gets through                                      |
| `MIN_EDIT_BASELINE` | 115  | 0.05 | —                                       | Inflates the burst ratio on sparse articles                          |
| `WINDOW_ENTER`      | 119  | 2    | Tighter inferred window                 | Window creeps into the ramp-up                                       |

**Two counter-intuitive facts, both measured in production:**

- `EDIT_BURST_MIN` looks like a gate but barely is. On a sparsely-edited article
  the denominator hits `MIN_EDIT_BASELINE`, so the ratio reports a floor, not a
  rate. NYCC scored **4.32×** off a single edit and cleared it. `EDITS_ABS_MIN` is
  what actually rejects a dormant convention.
- `MIN_PEAK_VIEWS` currently contributes nothing to rejecting NYCC — its peak is
  exactly **250**, sitting on the threshold with zero margin. `SPIKE_MIN` is doing
  that work. Re-tune when NYCC actually runs in October.

### Pulse ranking — `src/lib/home/pulse.ts`

`score = KIND_WEIGHT × decay(age) × relevance`, `decay(h) = 2^(−h/halfLife)`.

| Constant                | Line | Now                                    | Notes                                                                |
| ----------------------- | ---- | -------------------------------------- | -------------------------------------------------------------------- |
| `KIND_WEIGHT`           | 75   | trailer 1.0, surge 0.85, issue 0.55    | Live events ignore this — pinned                                     |
| `KIND_HALF_LIFE`        | 101  | trailer **120h**, surge 96h, issue 96h | Was 48h for trailers; see below                                      |
| `PIN_SCORE`             | 113  | 1e6                                    | Live events sort first by construction, not a special case           |
| `MAX_AGE_HOURS`         | 116  | 336 (14d)                              | Hard cutoff regardless of score                                      |
| `MIN_CHARACTERS`        | 121  | 1                                      | Trailers/surges need catalogue cast with art; issues exempt          |
| `KIND_CAP`              | 139  | issue 3, surge 2                       | **Volume gate.** Without it, 20 Wednesday comics take the whole rail |
| `MIN_NEWS_EVENTS`       | 156  | 1                                      | No rail at all if only comics qualify                                |
| `WINDOW_LAG_GRACE_DAYS` | 210  | 1                                      | Days past `live_to` the card still says Live                         |

**The trailer half-life is the one that has already bitten.** At 48h against 96h
for issues, trailers decayed twice as fast as the weekly comic shipment they
compete with: a 7-day-old Avengers: Doomsday trailer scored 0.088 against a
4-day-old comic at 0.5, and the 0.55 issue weight nowhere near closed a 5.7x gap.
The biggest story in the catalogue was in the database and off the rail. There is
a test that fails if it goes back under.

### Surge detection — `get_pulse_candidates` + `surge_started_at` (SQL)

Character surges are a Pulse kind as of 2026-07-27. Thresholds live in the RPC,
not in TS, because the selection is an indexed scan:

| Knob        | Now                 | Notes                                                                                                                                                                      |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spike floor | 2.5x                | week-over-week ratio                                                                                                                                                       |
| views floor | 1,500/wk            | keeps a 3x on 40 reads out                                                                                                                                                 |
| grouping    | `publisher`         | NOT `franchise` — that column is null for all but 2 of the 11 Mattel rows it exists to name                                                                                |
| face        | `pulse_face_weight` | fame x ln(spike). Fame alone fronts Marvel with Mister Fantastic (95, 3.1x) over Doctor Doom (74, 10.4x); spike alone fronts MOTU with Moss Man (23, 11x) over He-Man (94) |
| dating      | `surge_started_at`  | first day of the contiguous run at >= 2x the 14-day median, and **null once the curve falls back** — a decayed surge stops being an event on its own                       |

Dating is what made surges admissible at all: `pageviews_at` is when we looked,
not when it happened. `heroes.views_daily` (written by `sync-wiki-pageviews` from
a response it was already fetching) holds the curve. Sanity check: it dates Doctor
Doom's surge to 2026-07-20, which is the day the Doomsday trailer published.

### Freshness label — `src/lib/home/freshness.ts`

| Constant             | Line | Now      | Notes                                                  |
| -------------------- | ---- | -------- | ------------------------------------------------------ |
| `STALE_AFTER_HOURS`  | 49   | 168 (7d) | Past this the label is **null** — header shows nothing |
| `PULSE_WITHIN_HOURS` | 51   | 48       | Dot stops animating here, before the label disappears  |

### Auto-hero — `src/lib/db/trending.ts`

| Constant                     | Line | Now | Notes                                                   |
| ---------------------------- | ---- | --- | ------------------------------------------------------- |
| `TRAILER_HERO_MAX_AGE_HOURS` | 361  | 72  | Inside this, a trailer beats the random popularity pick |

---

## 3. File map

| File                                              | Job                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/events/detect.ts`                        | Pure event detection. **Mirrored** — see §4                          |
| `src/lib/home/pulse.ts`                           | Ranking, decay, relevance, caps, badges, subtitles, day counter      |
| `src/lib/home/freshness.ts`                       | The header's freshness claim + shared `relativeAgeLabel`             |
| `src/lib/tmdb/mapVideos.ts`                       | TMDB video parsing. **Mirrored** — see §4                            |
| `src/lib/db/pulse.ts` · `videos.ts` · `events.ts` | Readers. All degrade to `[]` on error                                |
| `src/lib/query/exploreQueries.ts`                 | Wires it together: `ranked` (header + hero) vs `pulse` (rail)        |
| `src/components/home/PulseRail.tsx`               | Native rail — poster cards + the live-event card                     |
| `src/components/web/home/PulseRail.tsx`           | Web rail, same structure, larger                                     |
| `src/components/{home,web/home}/RightNowBand.tsx` | Mounts the rail, derives `topMover`                                  |
| `supabase/functions/sync-watched-events`          | Polls Wikipedia, writes verdicts. Cron `7,37 * * * *`                |
| `supabase/functions/sync-title-videos`            | Daily `/videos` sweep. Cron `40 6 * * *`                             |
| `supabase/functions/sync-tmdb-slate`              | Ingests the UPCOMING slate. Cron `40 5 * * 1`                        |
| `supabase/functions/verify-issue-cast`            | Replaces guessed comic casts with ComicVine truth. Cron `10 5 * * *` |
| `src/constants/eventBrands.ts`                    | The 20 event marks, by `watched_events.slug`                         |
| `supabase/functions/_shared/videos.ts`            | Shared by the sweep and `enrich-tmdb-batch`                          |

**Migrations** — all applied. In order:
`20260726150000_watched_events` · `…210000_title_videos` · `…220000_pulse_candidates` ·
`…230000_pulse_event_window` · `20260727090000_schedule_tmdb_slate` ·
`…120000_verify_issue_cast` · `…122000_strip_anthology_issue_casts` ·
`…140000_schedule_verify_issue_cast` · `…150000_trending_wiki_exclude_encyclopedia_traffic` ·
`…160000_hero_views_daily` · `…170000_pulse_surge_events`

**`create or replace` cannot add a column to a `RETURNS TABLE` signature** —
Postgres rejects it with 42P13. Every migration that widens `get_pulse_candidates`
needs an explicit `drop function` first, and the drop takes the grants with it.

---

## 4. The one footgun: mirrored logic

Deno can't import from `src/`, so two files exist twice. **Change both together.**

| TypeScript original (tested) | Deno mirror                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| `src/lib/events/detect.ts`   | inlined in `supabase/functions/sync-watched-events/index.ts` |
| `src/lib/tmdb/mapVideos.ts`  | `supabase/functions/_shared/videos.ts`                       |

The tests only cover the originals. A mirror that drifts fails silently in
production and passes CI. This is the repo's existing convention (`enrich-tmdb-batch`
already mirrors `src/lib/tmdb/mapFilm.ts`), not something invented here.

---

## 5. Verify before pushing

```sh
yarn typecheck      # must be clean
yarn test:ci        # 141 suites, 1,149 tests
yarn lint           # 0 errors; ~79 warnings is the pre-existing ratchet
yarn format:check   # the pre-push hook runs this — it globs ts/tsx/js/json only
```

Feature test coverage: `pulse` 53 · `detect` 23 · `mapVideos` 21 · `freshness` 17 ·
`synthesizeCampaign` 16 · `events`/`videos` readers 6 each.

---

## 6. Gotchas that will bite

- **Every `.ts` under `__tests__/` is a test suite.** No shared fixture files —
  jest-expo's `testMatch` treats them as suites and fails on "no tests". Inline
  fixtures instead.
- **Clamped Flame text needs `lineHeight ≥ 1.22 × fontSize`** or descenders clip
  under `-webkit-line-clamp`. Applies to every `numberOfLines` + Flame pairing in
  the rail.
- **`as never` on an RPC** means the migration hasn't been applied and types not
  regenerated. Drop the cast after regenerating — don't leave it.
- **RLS posture:** `watched_events`, `title_videos` and `explore_bundle_cache` have
  RLS on with _no policies_. Reads go through security-definer RPCs; sync functions
  write with the service role. Don't add a client-side `.from()` against them.
- **`admin_set_watched_event_approval` can't be driven from the Supabase MCP** — it
  checks `auth.uid()`, which is null for the service role. Fine from a signed-in
  admin client; script the equivalent `update` instead.
- **Testing `get_explore_bundle` by hand needs the current `BROWSE_PODS` slugs**
  (`src/components/home/CategoryPodGrid.tsx`). A stale list misses the cache, falls
  through to live-compute, and 500s on the 3s anon timeout. That's the documented
  fallback, not an outage.

---

## 7. Where this goes next — four specs

Written 2026-07-27, after the surge lane shipped. Read them in this order; the
first is a dependency of the next two.

| Spec                                     | What it is                                          | Why now                                                                                     |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `2026-07-27-event-attribution-design.md` | Join a surge to the trailer/event that caused it    | The app can measure but not explain. Everything below needs a sentence, not a metric        |
| `2026-07-27-pulse-reach-design.md`       | Social auto-posts + permanent `/event/[slug]` pages | **Do this first of the three.** One user, one vote — the constraint is reach, not detection |
| `2026-07-27-pulse-return-design.md`      | Countdowns, notify-me, personal Pulse, event push   | Brings people back; needs an audience to bring back, so it follows reach                    |
| `2026-07-27-anime-signal-design.md`      | A second sensor via AniList                         | JJK on Netflix moved Gojo's enwiki traffic 2%. A whole vertical is invisible                |

## 8. Known issues, best next levers

1. ~~**The catalogue is historical.**~~ **FIXED 2026-07-27** by
   `sync-tmdb-slate`: future titles went 1 → 59, `title_videos` 471 → 612, and
   the nightly sweep now checks 120 rows rather than 9.
2. ~~**Trending Movers pollution.**~~ **FIXED 2026-07-27.** A fame floor was the
   obvious fix and the wrong one — Orko (23), Beyonder (24) and Dr. Facilier (3)
   are legitimate surges, indistinguishable from Orestes (24) on fame. The
   `In the Public Domain` / `Non-Fictional` buckets are the discriminator, and
   both `get_trending_heroes_wiki` and the surge lane now exclude them.
3. **`get_pulse_candidates` isn't in `get_explore_bundle`.** One extra round trip.
   Folding it in needs the current `compute_explore_bundle` body, which has changed
   several times — do it with DB access, don't reconstruct it blind.
4. **Steps 5–6 of the design are untouched:** takeover skin + approve gate, and
   event push (`send-daily-push` already runs a VAPID pipeline — cap volume hard).
5. **Only 1 of 14 surging heroes has an `avatar_url`.** Any face-stack UI must use
   `portrait_url` instead.
6. **Anime is invisible to the Pulse.** Jujutsu Kaisen landing on Netflix moved
   Gojo's English Wikipedia traffic by 2%. enwiki pageviews structurally
   under-measure anime fandom, and Shueisha/Kodansha are a real part of the
   catalogue. AniList's GraphQL API is free and keyless if this matters.
7. **The catalogue can't hold a story it has no character for.** The single
   biggest SDCC reveal was a Ryan Gosling Ghost Rider, and the only Ghost Rider
   here is a 1949 Magazine Enterprises western with no pageview tracking.
