# Lane 4 — Richer Relationships (Kickoff Brief)

**Date:** 2026-06-14
**Status:** Brief — needs its own brainstorming → spec → plan cycle.
**Part of:** `2026-06-14-enrichment-roadmap.md`

> Open this brief in a fresh tab, run the **brainstorming** skill to resolve the
> open questions below, write a full design spec, then plan.

## Goal

Extend the existing relationship graph beyond enemy/ally/teammate to capture richer
connection types — mentor, love interest, alter-ego, etc. — making the
relationship-driven UI (rivalries, family, related strips) deeper. This lane mostly
reuses infrastructure that already exists.

## What already exists (build on, don't rebuild)

- `hero_relationships` (11,884 rows): `(hero_id, related_id, kind, source, rank,
  cross_universe)`. The graph table and its RPCs
  (`get_related_heroes`, `get_top_rivalries`, `get_family_opponents`,
  `get_most_feared`) are already in place.
- `hero_relatives` (1,763 rows): typed family tree with a `relation_kind` enum.
- Established ordering rule: related lists order by `issue_count`/`rank`, never
  alphabetical.

So this lane is largely about **adding new `kind` values + an extraction pipeline**,
not new tables.

## Candidate new relationship kinds

`mentor` / `protege`, `love_interest`, `alter_ego` / `identity`, `rival`
(distinct from enemy), `successor` (legacy mantle), `creator_of` / `created_by`
(in-universe), `team_leader`.

## Likely approach

These kinds aren't cleanly available from any API, so extraction is **LLM +
ComicVine**: feed the model a hero's CV description/relationships/summary and have
it propose typed edges with a confidence score. Insert into `hero_relationships`
with `source = 'ai'` (the `source` column already supports provenance) and a
direction convention for asymmetric kinds (mentor→protege).

## Open questions for brainstorming

1. Which kinds first? (Love-interest and mentor are high-recognition.)
2. Directionality model for asymmetric kinds — store one directed edge + derive the
   inverse, or store both?
3. Confidence threshold + dedup against existing edges; avoid contradicting curated
   data.
4. Which UI surfaces consume the new kinds (new strips on `[id].tsx`? a
   relationships screen?) and how the family tree (`hero_relatives`) stays distinct
   from `alter_ego`/`successor` kinds.
5. Whether `rank` for new kinds reuses the issue_count ordering rule.

## Collision notes

Writes to the existing `hero_relationships` table (additive rows, low risk) and may
add a `kind` check-constraint migration — coordinate the allowed-kinds list so two
lanes don't fight the constraint. Renders via a new section component in
`[id].tsx`. Shares AI spend budget with Lane 2.
