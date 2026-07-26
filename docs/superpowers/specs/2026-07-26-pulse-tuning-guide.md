# The Pulse / Live Events — working reference

**Date:** 2026-07-26
**Companion to:** `2026-07-26-live-events-and-pulse-design.md` (the *why*, and the
measurements every threshold came from). This file is the *where* — for making
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

| Constant | Line | Now | Turn it up → | Turn it down → |
| --- | --- | --- | --- | --- |
| `RECENT_DAYS` | 86 | 4 | Slower to notice, steadier | Twitchier |
| `SPIKE_MIN` | 88 | 2.5 | Fewer false positives | NYCC (1.74×) starts passing |
| `EDIT_BURST_MIN` | 90 | 4 | — | Weak gate; see below |
| `EDITS_ABS_MIN` | 96 | 3 | Stricter | **This is the real veto.** Drop to 1 and any drive-by edit qualifies |
| `MIN_PEAK_VIEWS` | 109 | 250 | Small cons (CCXP, Lucca) can never fire | Tiny-article noise gets through |
| `MIN_EDIT_BASELINE` | 115 | 0.05 | — | Inflates the burst ratio on sparse articles |
| `WINDOW_ENTER` | 119 | 2 | Tighter inferred window | Window creeps into the ramp-up |

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

| Constant | Line | Now | Notes |
| --- | --- | --- | --- |
| `KIND_WEIGHT` | 71 | trailer 1.0, issue 0.55 | Live events ignore this — pinned |
| `KIND_HALF_LIFE` | 81 | trailer 48h, issue 96h | The arguable number: hours until worth half |
| `PIN_SCORE` | 89 | 1e6 | Live events sort first by construction, not a special case |
| `MAX_AGE_HOURS` | 92 | 336 (14d) | Hard cutoff regardless of score |
| `MIN_CHARACTERS` | 97 | 1 | Trailers need catalogue cast with art; issues exempt |
| `KIND_CAP` | 115 | issue: 3 | **Volume gate.** Without it, 20 Wednesday comics take the whole rail |
| `MIN_NEWS_EVENTS` | 128 | 1 | No rail at all if only comics qualify |

### Freshness label — `src/lib/home/freshness.ts`

| Constant | Line | Now | Notes |
| --- | --- | --- | --- |
| `STALE_AFTER_HOURS` | 49 | 168 (7d) | Past this the label is **null** — header shows nothing |
| `PULSE_WITHIN_HOURS` | 51 | 48 | Dot stops animating here, before the label disappears |

### Auto-hero — `src/lib/db/trending.ts`

| Constant | Line | Now | Notes |
| --- | --- | --- | --- |
| `TRAILER_HERO_MAX_AGE_HOURS` | 361 | 72 | Inside this, a trailer beats the random popularity pick |

---

## 3. File map

| File | Job |
| --- | --- |
| `src/lib/events/detect.ts` | Pure event detection. **Mirrored** — see §4 |
| `src/lib/home/pulse.ts` | Ranking, decay, relevance, caps, badges, subtitles, day counter |
| `src/lib/home/freshness.ts` | The header's freshness claim + shared `relativeAgeLabel` |
| `src/lib/tmdb/mapVideos.ts` | TMDB video parsing. **Mirrored** — see §4 |
| `src/lib/db/pulse.ts` · `videos.ts` · `events.ts` | Readers. All degrade to `[]` on error |
| `src/lib/query/exploreQueries.ts` | Wires it together: `ranked` (header + hero) vs `pulse` (rail) |
| `src/components/home/PulseRail.tsx` | Native rail — poster cards + the live-event card |
| `src/components/web/home/PulseRail.tsx` | Web rail, same structure, larger |
| `src/components/{home,web/home}/RightNowBand.tsx` | Mounts the rail, derives `topMover` |
| `supabase/functions/sync-watched-events` | Polls Wikipedia, writes verdicts. Cron `7,37 * * * *` |
| `supabase/functions/sync-title-videos` | Daily `/videos` sweep. Cron `40 6 * * *` |
| `supabase/functions/_shared/videos.ts` | Shared by the sweep and `enrich-tmdb-batch` |

**Migrations** (all applied except the last):
`20260726150000_watched_events` · `…210000_title_videos` · `…220000_pulse_candidates` ·
`…230000_pulse_event_window` ← **not yet applied**

---

## 4. The one footgun: mirrored logic

Deno can't import from `src/`, so two files exist twice. **Change both together.**

| TypeScript original (tested) | Deno mirror |
| --- | --- |
| `src/lib/events/detect.ts` | inlined in `supabase/functions/sync-watched-events/index.ts` |
| `src/lib/tmdb/mapVideos.ts` | `supabase/functions/_shared/videos.ts` |

The tests only cover the originals. A mirror that drifts fails silently in
production and passes CI. This is the repo's existing convention (`enrich-tmdb-batch`
already mirrors `src/lib/tmdb/mapFilm.ts`), not something invented here.

---

## 5. Verify before pushing

```sh
yarn typecheck      # must be clean
yarn test:ci        # 140 suites; 134 of the tests are this feature's
yarn lint           # 0 errors; ~79 warnings is the pre-existing ratchet
yarn format:check   # the pre-push hook runs this — it globs ts/tsx/js/json only
```

Feature test coverage: `pulse` 45 · `detect` 23 · `mapVideos` 21 · `freshness` 17 ·
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
  RLS on with *no policies*. Reads go through security-definer RPCs; sync functions
  write with the service role. Don't add a client-side `.from()` against them.
- **`admin_set_watched_event_approval` can't be driven from the Supabase MCP** — it
  checks `auth.uid()`, which is null for the service role. Fine from a signed-in
  admin client; script the equivalent `update` instead.
- **Testing `get_explore_bundle` by hand needs the current `BROWSE_PODS` slugs**
  (`src/components/home/CategoryPodGrid.tsx`). A stale list misses the cache, falls
  through to live-compute, and 500s on the 3s anon timeout. That's the documented
  fallback, not an outage.

---

## 7. Known issues, best next levers

1. **The catalogue is historical.** Only 9 of 2,507 TMDB titles released in the
   last year; exactly one has a future release date. `sync-title-videos` re-checks
   the same ~9 rows nightly. **Ingesting upcoming titles (TMDB `/discover` on a
   forward window) is the highest-value work left** — without it the trailer lane
   is a couple of cards, not a stream.
2. **Trending Movers pollution.** `get_trending_heroes_wiki` gates only on
   `pageviews_week >= 1000`, so Greek mythology dominates (Charybdis, Orestes,
   Pasiphae…). This leaks into the live card's "Moving fastest" line. A publisher
   or fame filter fixes both surfaces at once, and unblocks putting character
   *faces* on the live card.
3. **`get_pulse_candidates` isn't in `get_explore_bundle`.** One extra round trip.
   Folding it in needs the current `compute_explore_bundle` body, which has changed
   several times — do it with DB access, don't reconstruct it blind.
4. **Steps 5–6 of the design are untouched:** takeover skin + approve gate, and
   event push (`send-daily-push` already runs a VAPID pipeline — cap volume hard).
5. **Only 1 of 14 surging heroes has an `avatar_url`.** Any face-stack UI must use
   `portrait_url` instead.
