# Lore Content Angles — Design

**Date:** 2026-07-09
**Status:** Approved (user), pre-implementation
**Extends:** the ad-safe content factory (`scripts/social/ads/`, spec
`2026-07-08-ad-safe-content-factory-design.md`).

## Problem / goal

The factory's four angles (matchup / ranking / guess / fact) are competent but
neutral — and the `fact` pool is thin (6 computed stat-superlatives that repeat
by month 2). Meanwhile the Mythique DB holds a **relationship graph and
narrative lore no competitor has**: 1,529 punchy `did_you_know` facts on famous
characters, 5,267 famous enemy pairs, and 235 famous *family* links — including
the most-argued family conflicts in fiction (Luke/Vader, Thor/Loki,
Magneto/Scarlet Witch, Green Goblin/Harry Osborn, Professor X/Juggernaut).

This project turns that graph into content: it **deepens the `fact` angle** with
real narrative lore and **adds a `lore` angle** (family feud · rivalry lore ·
most-connected) — the differentiated, inherently-arguable content the neutral
data angles can't produce.

## Non-negotiable: viral intent (acceptance criteria)

"Interesting, engaging, viral" is a build requirement, judged per template:

- **A hook that provokes, not informs.** Family feud leads with the *tension*
  ("Same blood. Opposite sides.") before the names — curiosity gap first.
- **A payoff/reveal beat.** Every lore reel withholds then reveals (the
  relation, the year, the number) — the rewatch/comment trigger.
- **Argument bait in the CTA.** "Did you know?" is replaced with stance +
  provocation ("Nature or nurture? 👇", "The saddest rivalry in comics —
  agree?").
- **Real, self-contained copy.** Facts come from `hero_narrative_facts` (already
  written as punchy standalone lore), never truncated mid-sentence.
- Meets the existing reel quality bar (safe zones, beat grid, mascot, 2×
  supersample, Flame-Regular, silhouettes) — this project *reuses* that shell,
  it does not re-solve it.

## Non-negotiable: ad-safety

Unchanged and inherited: names + text + our own data-graphics only, **no
portraits**; `assertNoPortrait` gates every asset; disclaimer baked in. Lore
content is strictly safer than matchups (no character imagery of any kind).

## Data (verified coverage)

All via `sb.rest()` against existing tables (batch scripts use the service-role
key, so heavy reads are fine):

- **Facts** — `hero_narrative_facts(hero_id, kind, content, subject,
  needs_review)`. Use `kind='did_you_know'` (lead, 1,529 famous) plus
  `era_summary`/`power_explainer` for variety; `needs_review=false` only. Join
  `heroes` for `name` + `fame_score` gate.
- **Family** — `hero_relatives(hero_id, name, relation, related_hero_id)`.
  `relation` enum: `parent|child|sibling|aunt_uncle|other`. The gold subset:
  rows where `related_hero_id` is a famous hero AND an `hero_relationships`
  `kind='enemy'` edge exists between the two (235 famous, iconic).
- **Rivalry** — `hero_relationships(hero_id, related_id, kind)` where
  `kind='enemy'` and both endpoints `fame_score>=30` (5,267). `heroes.first_appearance`
  supplies "enemies since [year]" when both have it (best-effort; omit the year
  when absent).
- **Most-connected** — degree count over `hero_relationships` grouped by
  `hero_id`, top famous heroes, split by `kind` (allies/enemies/teammates).

## New angle: `lore`

`plan.mjs` gains a fifth angle `lore`, with three sub-kinds chosen by the data
selector (not a new plan dimension — the entry's `data.sub` carries it):

| Sub-kind | Hook → reveal | Pool |
| --- | --- | --- |
| **family** *(lead)* | "Same blood. Opposite sides." → two silhouettes → relation + conflict | 235 famous family-enemy links |
| **rivalry** | "The rivalry that never ends." → two names → "enemies since [year]" | 5,267 famous enemy pairs |
| **connected** | "The most connected character in fiction." → name → allies/enemies/teams counts | degree leaderboard |

`family` is weighted highest (it's the differentiator); `rivalry`/`connected`
fill the rest. The selector returns whichever it can stock, in that priority.

## Architecture / files

| File | Change |
| --- | --- |
| `scripts/social/ads/data.mjs` (modify) | `fact` pool → real `hero_narrative_facts` (typed `{ headline, detail, source:'lore' }`); new `fetchLore(sb, rand, opts) → { family[], rivalry[], connected[] }` folded into `fetchPools`'s return as `lore` |
| `scripts/social/ads/plan.mjs` (modify) | register `lore` angle; MAKERS.lore builds title/caption per sub-kind (stance CTAs); rebalance ANGLES/mix so lore gets a fair share; MUSIC_KIND.lore |
| `scripts/social/ads/render-carousel.mjs` (modify) | `SLIDES.lore` — family (bloodline slide → conflict slide → CTA), rivalry, connected |
| `scripts/social/ads/render-reel.mjs` (modify) | `SCENES.lore` — the "two names, one bloodline" reel (silhouettes persist, relation reveal under bloom); rivalry + connected variants; reuse the existing shell/safe-zones/beat-grid |
| Tests | `data.test.mjs` — lore selectors return names+text only (no portrait fields), family pairs are genuinely both-famous; `plan.test.mjs` — lore angle appears in the mix, stance CTAs present, no intra-batch repeat |

## Fact-angle deepening (detail)

`fetchPools`' `facts` becomes: query `hero_narrative_facts` joined to `heroes`
(`fame_score>=25`, `needs_review=false`), shuffle (seeded), take N. Shape stays
`{ headline, detail, stat? }` so the existing fact renderers are untouched:
`headline` = a punchy lead derived from the fact (first sentence / subject),
`detail` = the fact body, `stat` = null (facts without a number skip the big
odometer, showing the fact card instead — the renderer already branches on
`statNum`). The 6 computed superlatives are kept as a *fallback* only if the
lore query returns too few (thin-catalog safety).

## Copy direction (viral)

- Family: hook "Same blood. Opposite sides." · reveal "[A] is [B]'s
  [relation]." · CTA "Nature or nurture? 👇"
- Rivalry: hook "Some fights never end." · reveal "[A] vs [B] — enemies since
  [year]." · CTA "The best rivalry in comics? Fight about it 👇"
- Connected: hook "The most connected character in fiction." · reveal "[N]
  allies · [N] enemies · [N] teams." · CTA "Explore the whole web — mythique.app"
- Facts: lead with the surprise, not "did you know" every time (rotate: "Wait,
  what?", "Most people don't know…", the bare claim).

## Testing

- Pure/selector logic unit-tested (`yarn test:social`): lore selectors, safety
  (no image fields in any lore payload), stance-CTA presence, determinism.
- Renderers verified by rendering one of each new template and eyeballing
  against the viral + safe-zone bar (the established frame-extraction method);
  the family reel gets the closest look (it's the hero template).
- Full `yarn test:ci` + `tsc` stay green (no app-surface change).

## Constraints / invariants

- Reuse the reel/carousel shell, safe zones, beat grid, silhouettes, mascot,
  2× supersample — do not fork or re-solve them.
- Names + text only; `assertNoPortrait` before every asset.
- Batch scripts keep using the service-role key; lore queries are read-only.
- `--resume`, incremental manifest, publish contract, Publish-tab filters all
  keep working (the `lore` angle flows through `kind`/`angle` like any other;
  add a "Lore" filter chip + `angle` value).
