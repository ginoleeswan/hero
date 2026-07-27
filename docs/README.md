# Docs — how to find things

> The map of Mythique's documentation: what exists, which docs are load-bearing
> truth vs. historical record, and where to look first for any given question.
> If you are an agent (or a human returning after a month), start here.

## The three layers

Documentation in this repo is deliberately layered. Trust flows downward:

1. **`CLAUDE.md`** (repo root) — the operating manual: conventions, commands,
   the directory map, and hard rules (package manager, DB access patterns,
   style). Short on purpose. Always current.
2. **`docs/`** (this tree, excluding `superpowers/`) — **evergreen references.**
   Each describes a feature domain or architecture area *as shipped*, with code
   pointers, the tables/RPCs involved, and the traps. These are maintained: when
   behaviour changes, the matching doc changes in the same PR.
3. **`docs/superpowers/`** — **historical snapshots.** ~170 dated design specs
   (`specs/`) and implementation plans (`plans/`) from the feature work that
   built the app. They are the *why* and the *decision record*, not the current
   truth. **Status lines inside them go stale** ("not yet scheduled" features
   may be shipped; "implementing" designs may be superseded). They are excluded
   from `rg`/Grep via `.ignore` — read them by explicit path, and only after
   the evergreen doc has pointed you at one.

The order of operations for understanding any feature: **CLAUDE.md map → the
evergreen doc below → the hook/lib code it points at → (only if you need
history) the linked spec.**

## Evergreen docs by domain

### Features (`docs/features/`)

| Doc | Covers | Read when you touch… |
| --- | --- | --- |
| [`explore-feed-and-pulse.md`](features/explore-feed-and-pulse.md) | The home feed, `get_explore_bundle`, the four freshness engines, The Pulse, live events, campaigns, browse covers | Explore rows, `useExploreData`, `src/lib/home/`, `/event` pages |
| [`arena-and-matchups.md`](features/arena-and-matchups.md) | Matchup voting (v2 + voterKey), vote seeds, takes, team battles, battle builder, AI verdicts, the Versus hub | `/versus`, `/compare/*`, `useMatchupVote`, `useVersusHub`, takes |
| [`dailies-and-streaks.md`](features/dailies-and-streaks.md) | The three daily surfaces, Guess-the-Hero, the daily debate, server streak calendar, local/anon streaks | `/play`, `daily_debate`, `user_daily_completions`, `useDailyStreak` |
| [`search.md`](features/search.md) | The `search_heroes` RPC (trigram, fame-primary ranking), unified five-section search, top result, filters, history | `/search`, `useUnifiedSearch`, `useHeroSearch`, search ranking |
| [`character-page.md`](features/character-page.md) | The flagship detail page's section anatomy, curtain scroll, contribute/report affordances, biography + social-web satellites | `app/character/`, `useHeroDetail`, `/biography`, `/social-web` |
| [`profile-and-gamification.md`](features/profile-and-gamification.md) | Profile data flow, taste profile, badges, fan tiers, onboarding checklist, favourites, contributions, supporter tier, donation nudge | `/profile`, `useProfileData`, `src/lib/profile/`, contributions |
| [`sharing-and-og.md`](features/sharing-and-og.md) | Share images, the `api/` crawler surface (OG cards, share-meta, bot pages), attribution, analytics events, the social content factory | `api/`, `vercel.json`, share buttons, `scripts/social/` |
| [`auth-and-identity.md`](features/auth-and-identity.md) | AuthGate, returnTo, the two identity tiers (device voterKey vs account), anon-RPC + grants-not-RLS permission patterns, admin gating | `(auth)/`, `useAuth`, RLS/grants, any new RPC |
| [`notifications-and-push.md`](features/notifications-and-push.md) | Web push (the only channel), VAPID gating, streak-at-risk nudges, known gaps (no native push, no email) | `src/lib/push.ts`, `send-daily-push`, settings toggles |
| [`platform-and-motion.md`](features/platform-and-motion.md) | The `.tsx`/`.web.tsx` split, constant-ink web chrome, motion/View-Transitions system, skeleton/loading conventions, haptics | Any screen pair, `src/lib/motion.ts`, chrome/loading UX |
| [`admin-command-center.md`](features/admin-command-center.md) | `/admin/health` domains, gating, metric-caching patterns, known placeholders and gaps | `app/admin/`, `src/components/admin/` |

### Architecture (`docs/architecture/`)

| Doc | Covers |
| --- | --- |
| [`data-pipelines.md`](architecture/data-pipelines.md) | How the DB gets its data: seed/drain/derive, the 6 drains, source-of-truth per field. **Read before touching any enrichment cron/edge function.** |
| [`family-trees-and-houses.md`](architecture/family-trees-and-houses.md) | The kinship graph, the two-id-space trap, house pages, the relation console. **Read before touching `hero_relatives`, `get_house`, or `FamilyCanvas`.** |

### Product, brand & marketing

| Doc | Covers |
| --- | --- |
| [`ROADMAP.md`](ROADMAP.md) | Living snapshot of shipped / in-flight / themes. GitHub issues are the actionable truth; this is the map. |
| [`brand/design-language.md`](brand/design-language.md) | The "Two Worlds" brand system: motifs, tokens, type rules — for social/marketing assets (`scripts/social/`). |
| [`marketing/utm-attribution.md`](marketing/utm-attribution.md) | Link-tagging convention + first-touch attribution pipeline. |
| [`tiktok-integration.md`](tiktok-integration.md) | TikTok analytics/comment-triage integration state and API realities. |
| [`profiles-and-contributions.md`](profiles-and-contributions.md) | **Historical proposal** (kept for the vision + decision record). The as-shipped state lives in [`features/profile-and-gamification.md`](features/profile-and-gamification.md). |
| [`parked-explore-modules.md`](parked-explore-modules.md) | Built-but-unmounted Explore modules and why they're kept. |

## Conventions for writing docs

- **One evergreen doc per feature domain**, in `docs/features/` (cross-cutting
  systems go in `docs/architecture/`). Narrative prose, a mental-model section,
  explicit traps, tables for enumerables, backticked code pointers. 80–180
  lines — long enough to orient, short enough to actually read.
- **Update the doc in the PR that changes the behaviour.** A doc that can
  drift silently is worse than no doc; this rule is what keeps layer 2
  trustworthy. CI backs it up two ways: `yarn docs:links`
  (`scripts/docs/check-doc-links.mjs`, blocking) fails when a doc points at a
  file that no longer exists, and the non-blocking "Docs Freshness" job warns
  on PRs that change behaviour-bearing code without touching any doc.
- **Specs and plans are immutable history.** New feature work gets a new dated
  file under `docs/superpowers/specs|plans/`. When an evergreen doc supersedes
  a spec, add a one-line banner to the spec pointing forward (see the top of
  `architecture/family-trees-and-houses.md` for the pattern).
- **Don't duplicate** — link. The worst failure mode is two docs describing the
  same system slightly differently.
- Every feature doc ends with a **History** section linking its specs by
  explicit path, so the decision record stays one hop away.
