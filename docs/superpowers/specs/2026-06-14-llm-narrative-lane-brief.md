# Lane 2 — LLM Narrative Enrichment (Kickoff Brief)

**Date:** 2026-06-14
**Status:** Brief — needs its own brainstorming → spec → plan cycle.
**Part of:** `2026-06-14-enrichment-roadmap.md`

> Open this brief in a fresh tab, run the **brainstorming** skill to resolve the
> open questions below, write a full design spec, then plan.

## Goal

Add an AI-generated narrative layer on top of the structured data already in the
DB — the cheapest lane to ship (no new external API) and high "wow" factor. The app
already generates AI content (`stats_source = 'ai'`, the `verdicts` table), so this
extends an established pattern.

## Candidate outputs

- **"Did you know"** facts per hero (short, punchy, sourced from the hero's own
  summary/origin/relationships to reduce hallucination).
- **Power explainers** — plain-language descriptions of entries in `heroes.powers`.
- **Themed tags** — e.g. "tragic backstory", "anti-hero", "cosmic", for discovery
  and filtering.
- **Era summaries** — a paragraph tying a hero to a comics era (there is already a
  `get-era-timeline` RPC to build on).
- **Matchup / comparison narratives** — extends the existing `verdicts` idea.

## Likely data model

A `hero_facts` (or `hero_narrative`) side-table keyed by `hero_id` + a `kind`
column (`did_you_know` | `power_explainer` | `tag` | `era_summary`), with
`content`, `model`, `generated_at`, and a public-read RLS policy. Tags might warrant
their own normalized `hero_tags` table for filtering. **Do not** stuff these onto
`heroes` columns — they are 1-to-many.

## Pipeline

Mirror `generate-hero-stats` / `generate-verdict`: a new edge function that
generates on a popularity-ordered drain, gated by a status column, logged to
`enrichment_runs` + `api_usage`. Reuse the existing Gemini/LLM spend tracking
(`gemini-spend` function).

## Open questions for brainstorming

1. Which outputs ship first? (Tags + "did you know" are likely the highest
   value-to-cost.)
2. Grounding strategy — feed the model only the hero's existing DB fields to
   constrain hallucination? Accept/flag/review workflow for accuracy?
3. Which model? (Default to the latest capable Claude model unless cost dictates
   otherwise; align with whatever the existing AI lanes use.)
4. Are tags free-text or a curated controlled vocabulary (better for filtering)?
5. Regeneration policy when underlying hero data changes.

## Collision notes

Renders via a new section component in `[id].tsx` (one placement line). Tags may
also surface on Search/Discover — coordinate with those screens. Shares the AI
spend budget with other AI features.
