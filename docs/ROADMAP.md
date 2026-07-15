# Mythique roadmap

A living snapshot of what's shipped, what's tracked, and where things are headed.
Issues are the source of truth for anything actionable — this file is the map.
Last meaningful update: 2026-07-15.

---

## Recently shipped

**Reliability + growth hardening batch** (mid-July 2026, PRs #89/#91/#92/#94/#95):

- **Bug-hunt fixes** (#89) — multi-tag browse filter timing out / erroring the
  grid; search chars (`,` `(` `)`) 400-ing the grid; two timezone divergences;
  nav dead-ends on shared deep-links.
- **Auth returnTo** (#91) — signing in returns you to the page + action you came
  from (was always dumping you on /explore), email and web OAuth alike.
- **Sentry crash reporting + native ErrorBoundary** (#92) — production errors
  now surface (native had a silent white-screen gap); errors-only to protect the
  bundle; fail-soft source maps. _Owner: set the Sentry DSN + auth token._
- **ComicVine collision gate** (#94, closes #65) — a publisher-plausibility gate
  stops cross-franchise same-name corruption; one shared matcher (no more
  drift-twins); 83 historical suspects flagged `needs_review`. Admin queue to
  resolve them tracked in [#93](https://github.com/ginoleeswan/hero/issues/93).
- **Web push — daily-debate re-engagement** (#95) — opt-in notification for
  today's matchup (web, signed-in, personalized for favourite-holders). _Owner:
  generate + set VAPID keys._

Earlier July items in `main`:

- **Mobile-web chrome system** — the "constant-ink" rule: canvas always ink, every
  page opens and closes on ink (`PageEndCap`), transient auto-hiding top bar,
  unified search field, seamless iOS-toolbar behaviour. See
  [`project_constant_ink_chrome`](../CLAUDE.md) principles.
- **Character page — the "award pass"** — editorial pull-quote, the Legend
  timeline, choreographed Power Profile cascade (count-up + bar sweeps), vitals
  count-up, "In Print" compression, per-character accent theming, and the
  curtain scroll (portrait pins while the sheet rises over it).
- **Landing performance** — three.js code-split out of the entry bundle
  (−911 KB), font-gated atomic reveal, edge-to-edge loaders, the "live crossfire"
  Today's Debate section.
- **The RLS planner-shackle fix** — the biggest perf win in the project's
  history: catalog tables had RLS with `USING (true)` that crippled query plans
  for real users. Browse/slug pages went **7.2 s → ~130 ms**. Plus trigram
  indexes, prefetch-on-touch, and warm caching. (See
  [`rls-planner-shackle`](../CLAUDE.md) — always benchmark as the `anon` role.)
- **Admin command center** — metric caching (5-min cron + live fallback:
  `catalog_health` 270 ms → 2 ms), Instagram sync fixed (missing CORS),
  emoji-free, tab/section persisted to the URL, per-post skip persistence.
- **Repo-wide mobile-web audits** — resilience (no dead screens on network
  failure), edge-to-edge rails, touch feedback on every card, the "hero" →
  "characters" copy pass, viewport-overflow and input-zoom fixes.

---

## In flight / tracked

### 🎬 TikTok integration — [Epic #84](https://github.com/ginoleeswan/hero/issues/84) · _milestone: TikTok integration_
Bring TikTok into Insights: comment triage, post analytics, viral gaps.
**Reality:** no reply-to-comments API exists → comments are triage + deep-link only.

| Step | Issue | State |
| --- | --- | --- |
| Register + connect the app (the unlock) | [#80](https://github.com/ginoleeswan/hero/issues/80) | 🔴 blocked on owner (~1–2 wk approval) |
| Phase 1 analytics — live-API test pass | [#81](https://github.com/ginoleeswan/hero/issues/81) | ⚪ ready after #80 (scaffolding shipped in #79) |
| Phase 2 — comment triage inbox | [#82](https://github.com/ginoleeswan/hero/issues/82) | ⚪ needs a comment-read source decision |
| Phase 3 — viral-gap explorer | [#83](https://github.com/ginoleeswan/hero/issues/83) | ⚪ research spike |

> **Next action:** [#80](https://github.com/ginoleeswan/hero/issues/80) — register the TikTok app; the approval clock is the long pole.

### 📱 Mobile-web polish — _milestone: Mobile-web polish_
Deferred load-time pop-in fixes from the audits (all low/medium, cosmetic):
- Explore signed-in personalized rows pop in — [#85](https://github.com/ginoleeswan/hero/issues/85)
- Team masthead mounts late — [#86](https://github.com/ginoleeswan/hero/issues/86)
- Biography header has no skeleton — [#87](https://github.com/ginoleeswan/hero/issues/87)

### 🐛 Data quality
- ✅ ComicVine cross-franchise collision — root cause fixed (#94, closed #65).
  Follow-up: admin review queue to resolve the 83 flagged rows —
  [#93](https://github.com/ginoleeswan/hero/issues/93)

### 🔔 Owner setup (unblocks shipped-but-dormant features)

- Sentry (crash reporting, #92) — set the DSN + auth token.
- Web push (daily-matchup notifications, #95) — generate + set VAPID keys.

---

## Themes (direction, not commitments)

- **Growth loop** — the social pipeline (generate → post → learn) is the active
  frontier: analytics in, comment engagement, content-gap discovery. TikTok is
  the current push; the same shape generalises to any platform.
- **Perf discipline** — the RLS lesson stands: measure as `anon`, cache
  glanceable metrics (never actionable queues), prefer index-friendly queries.
  New catalog tables get the grants-not-RLS pattern.
- **Mobile-web is the product surface** — the constant-ink chrome + edge-to-edge
  + award-level detail bar applies to every new screen, not just the ones
  already polished.

---

_How to use this: skim "In flight" for what's active, open the linked issue for
the actual checklist. Milestones on GitHub group the same work. When a theme
becomes concrete, it graduates into issues + a milestone._
