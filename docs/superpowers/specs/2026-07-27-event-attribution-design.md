# Event attribution — why a character is surging

**Date:** 2026-07-27
**Status:** Design. Nothing built.
**Depends on:** the surge lane (`get_pulse_candidates` v3, `surge_started_at`) —
shipped 2026-07-27, see `2026-07-26-pulse-tuning-guide.md`.
**Blocks:** `2026-07-27-pulse-reach-design.md` (a post needs a sentence, not a
metric), and the copy on every surge surface.

---

## 1. The problem is that the app can measure but not explain

The Pulse rail now says **"He-Man · 11.0× reads"**. That is accurate, and it is
not interesting. What a reader wants is **"Masters of the Universe is surging —
the trailer landed two days ago."**

Every downstream surface has the same gap. A push notification, a social post, an
SEO page and a card subtitle all need a _sentence_, and the only raw material any
of them currently has is a multiplier.

This is not a copywriting problem. The app does not know the reason, and until it
does, no amount of phrasing will produce one.

## 2. It knows the reason — it just never joins the two halves

The unusual thing about this database, after the last few days of work, is that it
holds **both sides of a causal pair**:

- what the industry published, timestamped — `title_videos.published_at`,
  `comic_issues.store_date`, `watched_events.live_from`
- what audiences then read, timestamped — `heroes.views_daily`, reduced to a
  breakout date by `surge_started_at`

Measured 2026-07-27, joining the two by hand:

| Surge group             | Breakout   | Nearest preceding cause                         | Lag        |
| ----------------------- | ---------- | ----------------------------------------------- | ---------- |
| Marvel, 10 characters   | 2026-07-20 | **Avengers: Doomsday** trailer, 07-20           | **0 days** |
| Mattel, 11 characters   | 2026-07-22 | **Masters of the Universe** teaser, 07-20       | 2 days     |
| DC Comics, 2 characters | 2026-07-23 | **Clayface** trailer 07-22 · **Lanterns** 07-23 | 0–1 days   |

Doctor Doom's pageview curve breaks on exactly the day the Doomsday trailer
published. Nothing told the detector that; it inferred the date from attention
alone and the trailer date came from TMDB. They agree because they are the same
event seen from two sides.

## 3. The naive join does not work, and it is worth knowing why

The first attempt matched a surge to any cause within ±3 days whose cast shared
the surging group's `publisher`. During SDCC week that produced:

```
DC Comics surge 07-23  ->  Resident Evil trailer   (07-23)
DC Comics surge 07-23  ->  Look Back trailer       (07-23)
DC Comics surge 07-23  ->  LEGO ONE PIECE trailer  (07-20)
```

Two failure modes, both instructive:

1. **Publisher is too coarse.** A title's cast spans publishers, so a
   `publisher LIKE` test against an aggregated cast string matches almost
   anything. It has to be **character-level**: the surging character must appear
   in the candidate title's cast via `hero_media_appearances`.
2. **A symmetric window has no direction.** `abs(lag) <= 3` happily attributes a
   surge to a trailer that dropped _after_ it. A cause must **precede** its
   effect.

Add a third from the same data: in a busy week many causes qualify, so the join
must pick **one** — nearest preceding, tie-broken by magnitude — rather than
returning all of them.

## 4. Design

### 4.1 `attribute_surge(p_hero_id text, p_breakout date)`

A SQL function returning at most one row: `cause_kind`, `cause_id`, `cause_label`,
`cause_date`, `lag_days`, `confidence`.

Candidate causes, each already a first-class dated row:

| `cause_kind` | Source                      | Link to the character                                        |
| ------------ | --------------------------- | ------------------------------------------------------------ |
| `trailer`    | `title_videos.published_at` | `hero_media_appearances`                                     |
| `issue`      | `comic_issues.store_date`   | `comic_issue_appearances` (now verified — see the cast work) |
| `live_event` | `watched_events.live_from`  | none; a convention lifts everything                          |

Selection rules:

- `cause_date <= p_breakout` — causes precede effects.
- `p_breakout - cause_date <= LAG_MAX_DAYS` (start at 4; the measured lags are
  0, 1 and 2).
- For `trailer` and `issue`, the hero must be in the cast. No exceptions —
  publisher proximity is not evidence.
- `live_event` only qualifies when the breakout falls **inside** the event window,
  and only as a fallback when nothing character-linked is found. A convention is
  a plausible explanation for everything at once, which is exactly what makes it
  a weak one.
- Order: smallest `lag_days` first, then cause magnitude (a `Trailer` outranks a
  `Teaser`; a higher `max_fame` issue outranks a lower one).

### 4.2 Confidence, and language that matches it

`confidence` is `high` when a character-linked cause sits within 2 days, `low`
when it is a `live_event` fallback or a 3–4 day lag.

**The copy must never claim causation the join cannot prove.** Temporal phrasing
only:

- high → "Two days after the Masters of the Universe trailer"
- low → "During San Diego Comic-Con"
- none → say nothing extra. The card keeps "11.0× reads".

This is not pedantry. Two things happening in sequence is what was measured;
"because" is an inference, and the app has been careful elsewhere to fail toward
the honest state rather than a confident lie.

### 4.3 Where it runs

Selection in SQL, phrasing in TypeScript — the existing split. `get_pulse_candidates`
gains `cause_kind`, `cause_label`, `cause_date` on surge rows; `src/lib/home/pulse.ts`
composes the sentence in `subtitleFor`, where it is unit-testable and every other
piece of Pulse copy already lives.

Adding columns means **`drop function` first** — `create or replace` cannot widen
a `RETURNS TABLE` (42P13), and the drop takes the grants with it.

## 5. What this unlocks

Ordered by how much they need it:

- **Social posts** (`2026-07-27-pulse-reach-design.md`) — a post needs a claim. "Doom
  is up 10×" is a stat; "Doom is up 10× since the Doomsday trailer" is a story.
- **Push** — the notification body is exactly this sentence.
- **Event archive pages** — "what SDCC did to the catalogue" is a table of
  attributed surges.
- **The live card** — "Moving fastest" gains a reason, and the empty middle of the
  card gains something honest to hold.

## 6. Non-goals

- **Causal proof.** This is nearest-preceding-plausible-cause, not inference. The
  language must stay temporal.
- **Multi-cause.** A surge gets one attribution. Two reasons on a card is a
  paragraph, and the second is always weaker than the first.
- **Backfill of history.** Attribution runs on live candidates. Historical surges
  have no stored `views_daily` beyond 14 days and cannot be re-derived.

## 7. Open questions

- `LAG_MAX_DAYS` is set from three observations. NYCC in October is the next
  natural sample.
- Does a **comic** ever win an attribution in practice? A new issue rarely moves
  pageviews the way a trailer does; if it never wins, drop the kind rather than
  carry a lane that never fires.
- Should a title's **release** (not its trailer) be a cause? `titles.release_date`
  is dated and now populated for 59 upcoming titles, but a release is a scheduled
  event rather than a publication — probably a separate kind with a wider lag.

## 8. Tests

Against the measured week, inlined as fixtures (no helper files under
`__tests__` — jest treats every `.ts` there as a suite):

- Doom + breakout 07-20 → the Doomsday trailer, lag 0, high.
- He-Man + breakout 07-22 → the MOTU teaser, lag 2, high.
- A cause dated _after_ the breakout is never selected.
- A same-publisher title the character is **not** in is never selected — the
  regression that produced `DC surge -> Resident Evil`.
- `live_event` only wins when nothing character-linked qualifies.
- No candidate → null, and `subtitleFor` falls back to the bare multiple.
