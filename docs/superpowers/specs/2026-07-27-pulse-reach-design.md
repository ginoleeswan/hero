# Reach — turning the Pulse into distribution

**Date:** 2026-07-27
**Status:** Design. Nothing built.
**Depends on:** `2026-07-27-event-attribution-design.md` — both surfaces here need
a sentence, and attribution is what produces one.
**Sibling:** `2026-07-27-pulse-return-design.md` (retention). **Do this one first**
— see §1.

---

## 1. Why this is the priority

The app is content-rich and audience-poor. The measured state is one user and one
vote against ~50,500 characters, a live event detector, a slate of 59 upcoming
titles, verified comic casts and a working freshness engine.

That asymmetry decides the order of everything. Retention features need people to
retain; the Pulse currently reaches almost nobody. **More detection does not help.
Reach does.**

Two surfaces, one push-out and one pull-in:

- **Social** — take today's event to where people already are.
- **Event archive pages** — be the page that answers a timely search, permanently.

Both consume the same feed and both need attribution to say anything worth
reading.

---

## 2. Social — the Pulse as a trigger for a factory that already exists

### 2.1 What is already built

Social Studio ships a content factory: `yarn social` as the hub, `batch-month` for
bulk composition, a `safe-assert` ad-safety gate, and `publish-posts`. See
`2026-07-07-social-studio-design.md` and `2026-07-08-ad-safe-content-factory-design.md`.

What it lacks is a reason to fire **today**. It composes on a schedule, from a
catalogue that is the same on Tuesday as it was in March.

### 2.2 The change

The Pulse is that trigger. A ranked feed of dated events, each with a cast, art,
an accent and (with attribution) a claim, is precisely the input a post needs.

```
event  ->  attribution  ->  composed claim  ->  safe-assert  ->  queued post
```

Post shapes, mapped to the kinds that already exist:

| Kind         | Shape                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `trailer`    | The drop, plus the catalogue characters in it — the app's actual differentiator over a news account |
| `surge`      | "X is up 10× since the trailer" — the stat nobody else has                                          |
| `live_event` | A convention's daily digest: what dropped, what moved                                               |
| `issue`      | Deliberately excluded. A weekly shipment is not news; see `KIND_CAP`                                |

### 2.3 Rules

- **`safe-assert` is mandatory and non-negotiable.** No path may publish around it.
- **Cap hard.** At most one automated post per day, and none at all on a day with
  no `trailer`, `surge` or `live_event` — the same `MIN_NEWS_EVENTS` logic the rail
  uses. Posting the weekly comic shipment because nothing else happened is how an
  account teaches people to ignore it.
- **Queue, do not auto-publish**, at least initially. The factory already supports
  a review step; a wrong claim published automatically is much more expensive than
  a slow one.
- Every post links to the character or title page it is about. Reach is only
  useful if it lands somewhere.

### 2.4 Open questions

- Which platforms first? `platform_credentials` and `pull-social-stats` exist;
  TikTok and IG have working OAuth. Reach per unit of effort probably differs a
  lot between them and that is measurable rather than guessable.
- Does a surge post need art beyond the character portrait? Only 1 of 14 surging
  heroes has an `avatar_url`; `portrait_url` is the reliable field.

---

## 3. Event archive pages

### 3.1 The idea

`/event/sdcc-2026` — a permanent page for a convention, assembled from data the
app already has:

- the inferred window and how it was detected (the two-signal story is genuinely
  interesting and nobody else publishes it)
- the trailers that dropped inside it, from `title_videos`
- the characters that surged, and — via attribution — _which_ drop moved them
- the comics that shipped that week

### 3.2 Why it is worth more than a rail

A rail is empty by Monday. This page is still good a year later, and it accretes:
every event the detector watches eventually has one.

It also answers **timely queries** — "is comic con on", "sdcc 2026 announcements",
"what was announced at comic con" — which are exactly the searches a fandom
encyclopedia should win and currently does not compete for. The bot-page pipeline
(`api/share-meta`, `api/bot-page.ts`) is live and measured, so the mechanism for
serving a crawler-friendly page already exists.

### 3.3 Shape

- Route `/event/[slug]`, with a native/web pair per the repo convention (both files
  must exist or expo-router throws).
- Data via one RPC, `get_event_dossier(slug)`, mirroring how `/house/[slug]` and
  `/issue/[id]` are fed.
- Historical events render from stored state; `watched_events.views_daily` keeps the
  attention curve that justified the window, which is the illustration.
- Only **approved** events get a page. The approval gate exists precisely so a
  false positive cannot mint a public artefact.

### 3.4 Non-goals

- **Panel-level detail.** Ruled out in the original design: it exists only on the
  event's own site, has no API, and scraping it is fragile and ToS-dubious.
- **Editorial write-ups.** The page is assembled from facts. If it needs prose to
  be worth reading, it is not ready.

---

## 4. Sequencing

1. Attribution (its own spec) — neither surface reads well without it.
2. Social composer + queue, behind `safe-assert`, one post a day maximum.
3. `/event/[slug]`, starting with SDCC 2026, which has real data end to end.

Steps 2 and 3 are independent and can be done in either order. Step 3 compounds
(pages accumulate); step 2 is faster to measure.

## 5. How we would know it worked

- Social: reach and click-through per post, already collected by
  `pull-social-stats`. The honest bar is whether an automated post outperforms a
  hand-written one — if it does not, the factory is noise.
- Event pages: impressions on timely queries in Search Console, and whether the
  page still draws traffic a month after the event. If it does not, it is a rail
  with extra steps.
