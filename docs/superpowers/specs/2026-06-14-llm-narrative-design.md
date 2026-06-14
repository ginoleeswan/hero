# Lane 2 — LLM Narrative Enrichment (Design Spec)

**Date:** 2026-06-14
**Status:** Approved design — ready for implementation plan.
**Brief:** `2026-06-14-llm-narrative-lane-brief.md`
**Roadmap:** `2026-06-14-enrichment-roadmap.md`
**Project ref:** `rpvgqfaeiowisdubgxkg`

## 1. Goal

Add an AI-generated narrative layer on top of the structured hero data already in
the DB: short "Did you know" facts, plain-language power explainers, an era
summary, and themed tags. High "wow" factor, no new external API.

## 2. Approach — generation happens in-session, not via an edge function

This is the load-bearing departure from the kickoff brief. **The brief assumed a
new Deno edge function calling the Anthropic API on a pg_cron drain. That is NOT
what we are building.** Instead:

- **Generation is performed by Claude in this Claude Code session** (model set to
  Sonnet), reading each hero's grounding fields and emitting structured JSON.
- **No** new edge function, **no** `ANTHROPIC_API_KEY` secret, **no** Anthropic
  SDK, **no** pg_cron schedule, **no** Claude rows in `api_usage` (there is no API
  spend to track).
- **Writes** go directly to the new tables via the **Supabase MCP**
  (`execute_sql`) as each slice is generated. Schema changes still go through
  version-controlled migration files applied via the MCP.
- The work is **resumable across sessions** purely via the `heroes.narrative_status`
  gate — this preserves the *semantics* of the `enrich-comicvine-batch` drain
  (popularity-ordered, status-gated, resumable) with Claude-in-session as the
  worker instead of cron + API.

### Scope

**Pilot: ~10–20 heroes**, ordered by `issue_count` desc (the most-visited
heroes). The schema and UI are built for the whole catalog; only the pilot set is
generated now. Remaining heroes stay `narrative_status = 'pending'` and can be
filled in later sessions.

## 3. Data model

One new migration: `supabase/migrations/<YYYYMMDDHHMMSS>_create_hero_narrative.sql`.
Applied via `mcp__supabase__apply_migration`; regenerate
`src/types/database.generated.ts` afterward (never hand-edit).

### 3.1 `heroes.narrative_status` (the gate)

```sql
alter table public.heroes
  add column narrative_status text not null default 'pending'
    check (narrative_status in ('pending','done','failed','stale'));
create index if not exists heroes_narrative_status_idx
  on public.heroes (narrative_status, issue_count desc nulls last);
```

Mirrors the existing `comicvine_status` / `ai_stats_status` gating pattern. The
drain query selects `pending` (and optionally `stale`) ordered by `issue_count`
desc — i.e. popularity order (per the popularity-ordering memory).

### 3.2 `hero_narrative_facts` (text outputs)

One row per text output. `did_you_know` is multi-row (ordered by `position`);
`power_explainer` is one row per explained power (`subject` = power name);
`era_summary` is a single row.

```sql
create table public.hero_narrative_facts (
  id           bigint generated always as identity primary key,
  hero_id      text not null references public.heroes(id) on delete cascade,
  kind         text not null check (kind in ('did_you_know','power_explainer','era_summary')),
  content      text not null,
  subject      text,            -- power name for power_explainer; null otherwise
  position     int,             -- orders the did_you_know list; null otherwise
  source_model text not null,   -- e.g. 'claude-sonnet-4-6 (claude-code session)'
  needs_review boolean not null default false,
  generated_at timestamptz not null default now()
);
create index hero_narrative_facts_hero_id_kind_idx on public.hero_narrative_facts (hero_id, kind);
```

Regeneration overwrites a hero's rows (delete-then-insert within
`(hero_id)` — see §6). No uniqueness constraint is enforced beyond the PK; the
write path is responsible for clearing prior rows before reinserting.

### 3.3 `hero_tag_vocab` (controlled vocabulary)

Source of truth for allowed tags. Seeded in the migration; queryable so the
Search/Discover facet UI can render labels.

```sql
create table public.hero_tag_vocab (
  slug        text primary key,
  label       text not null,        -- display label, e.g. 'Anti-hero'
  description text not null,         -- guidance for generation / tooltip
  category    text not null         -- grouping: archetype | source | scope | tone | role
);
```

### 3.4 `hero_tags` (normalized, filterable)

```sql
create table public.hero_tags (
  hero_id text not null references public.heroes(id) on delete cascade,
  tag     text not null references public.hero_tag_vocab(slug),
  primary key (hero_id, tag)
);
create index hero_tags_tag_idx on public.hero_tags (tag);
```

### 3.5 RLS — public read on all three new tables

New tables get RLS auto-enabled; without an explicit public-read policy anon
reads return 0 rows silently (per the new-table-RLS memory). Add to each of
`hero_narrative_facts`, `hero_tags`, `hero_tag_vocab`:

```sql
alter table public.<t> enable row level security;
create policy "<t>_public_read" on public.<t> for select using (true);
```

No insert/update policies — writes are performed via the service role through the
Supabase MCP.

## 4. Controlled tag vocabulary (initial seed)

~35 slugs across five categories. Generation must choose only from these. Final
list (tunable during implementation):

| Category | Slugs |
| --- | --- |
| archetype | `anti-hero`, `reformed-villain`, `legacy-hero`, `vigilante`, `mentor`, `sidekick`, `mastermind`, `monster-hunter` |
| source | `mutant`, `cosmic-powered`, `tech-based`, `magic-user`, `super-soldier`, `alien`, `mythological`, `mutate` |
| scope | `street-level`, `cosmic`, `reality-warper`, `powerhouse`, `gadgeteer` |
| tone | `tragic-backstory`, `morally-grey`, `brooding`, `comic-relief`, `wholesome`, `noir` |
| role/power | `team-leader`, `lone-wolf`, `government-agent`, `outlaw`, `shapeshifter`, `speedster`, `telepath`, `immortal` |

Target 2–5 tags per hero. A tag is emitted only when the hero's grounding
clearly supports it.

## 5. Grounding contract

**Strict DB-only grounding** — generate solely from the hero's stored fields. No
outside/training knowledge. If a field needed for an output is missing, omit that
output rather than invent it. This is the defensible posture for an encyclopedia
and protects against confidently-wrong facts on obscure heroes.

### Fields fed per hero

`name`, `alignment`, `publisher`, `summary`, `origin`, `description` (HTML
stripped, ~800 chars — same treatment as `generate-hero-stats`), `powers` (capped
~20), `enemies` / `friends` / `teams` (names, capped), `first_issue_data`
(`coverDate` → year, `seriesName`), `issue_count`.

### Era derivation

`era_summary` grounds on the first-appearance **year** (from
`first_issue_data.coverDate`) + `publisher`, mapped to the standard comics eras
(Golden / Silver / Bronze / Modern), consistent with the existing
`getEraTimeline` bucketing. If no first-appearance year exists, omit the era
summary.

### Output JSON shape (per hero)

```json
{
  "did_you_know": ["2–4 short, grounded facts"],
  "power_explainers": { "Flight": "plain-language description", "Telepathy": "…" },
  "era_summary": "one short paragraph tying the hero to its comics era",
  "tags": ["anti-hero", "street-level"]
}
```

`power_explainers` keys are a subset of the hero's `powers`. Each output may be
empty/absent when grounding is insufficient.

## 6. Accuracy posture & regeneration

### Accuracy (accept/flag/review)

The pilot is small (~10–20 heroes) and generated in-session, so: **human review
before go-live.** Generated rows are written, the output is eyeballed, and
`narrative_status` is flipped to `done` once it looks right. The `needs_review`
boolean on `hero_narrative_facts` flags any individual fact that warrants a second look.
No heavier workflow (no per-fact confidence model, no review queue).

### Regeneration policy

**Manual re-queue via status.** When a hero's underlying data changes, set
`narrative_status` back to `pending` (or `stale`) — directly via SQL or through
the existing admin re-enrich mechanism (`admin_reenrich_hero`) — and the hero is
regenerated in a future in-session pass. Regeneration **deletes the hero's
existing `hero_narrative_facts` + `hero_tags` rows and reinserts**. `generated_at` and
`source_model` are recorded for reasoning about staleness. No automatic
drift/fingerprint detection in this pilot.

## 7. UI

### 7.1 Character page — `NarrativeSection`

A new self-contained component (e.g. `src/components/character/NarrativeSection.tsx`,
plus a `.web.tsx` sibling if the project's web components live separately)
rendering, when present:

- **Did you know** — the `did_you_know` facts (ordered).
- **Power explainers** — `power_explainer` rows, keyed to the hero's powers.
- **Era** — the `era_summary` paragraph.
- **Tags** — `hero_tags` as chips.

Added with a **single placement line** in each of
[app/character/[id].tsx](app/character/[id].tsx) and
[app/character/[id].web.tsx](app/character/[id].web.tsx) (both exist and both need
it). All logic stays in the component; the screen just imports and places it. The
section renders nothing when the hero has no narrative rows.

### 7.2 Data access — `src/lib/db/heroFacts.ts`

New query module (screens never import `supabase` directly). Provides:

- `getHeroNarrative(heroId)` → `{ didYouKnow: string[], powerExplainers: {power, text}[], eraSummary: string | null, tags: TagChip[] }`.
- `getHeroTags(heroId)` and a tag-filtered hero query for §7.3.

Reads only `narrative_status = 'done'` heroes' rows (don't surface partially
generated/unreviewed content).

### 7.3 Search / Discover — tag filtering

Wire the controlled-vocab tags into the **existing** category-filter system:

- Add a `tags` facet to [src/lib/db/categoryFilters.ts](src/lib/db/categoryFilters.ts)
  (`visibleFacets` / `filtersToParams` / `paramsToFilters` / `activeFilterList`).
- Add a tag-filtered hero query (join `hero_tags`) used by the category/search
  page ([src/lib/db/heroes.ts](src/lib/db/heroes.ts) `getCategoryPage` /
  `getCategoryFacetCounts` neighbourhood).
- Render via the existing [src/components/search/FilterChips.tsx](src/components/search/FilterChips.tsx)
  and the search palette.

**Caveat:** with only ~10–20 heroes tagged in the pilot, the tag filter is sparse
— it surfaces piloted heroes only, and becomes more useful as coverage grows.
This is acceptable; the plumbing is built once and benefits from later coverage.
This surface is the "coordinate with Search/Discover" item flagged in the brief
and roadmap; treat its wiring as the higher-risk integration in the plan.

## 8. Collision notes (per roadmap)

- `src/types/database.generated.ts` — regenerate via
  `mcp__supabase__generate_typescript_types` after the migration; resolve any
  conflict by re-running, not hand-merging.
- `app/character/[id].tsx` and `[id].web.tsx` — one import + one placement line
  each. Merge the placement lines last.
- Search/Discover filter plumbing (`categoryFilters.ts`, `heroes.ts`,
  `FilterChips.tsx`) — shared with the discovery surface; coordinate.
- No new `supabase/functions/` directory (no edge function). No `app.config.ts`
  changes (no API key). No cron schedule.

## 9. Conventions (CLAUDE.md)

- yarn only; Expo SDK 56 / RN.
- Schema changes as new files in `supabase/migrations/`, applied via the Supabase
  MCP; regenerate `database.generated.ts` after each.
- Screens never import `supabase` — only `src/lib/db/*` modules.
- TypeScript, no `any` (`unknown` for caught errors); functional components;
  `StyleSheet.create` (no inline styles except `StyleSheet.absoluteFill`).
- Fonts: never Flame-Bold — use Flame-Regular (display) / FlameSans-Regular (UI) /
  Nunito_* (UI text). Base canvas `#f5ebdc` (`COLORS.beige`).
- Commit directly to master (project convention).

## 10. Out of scope (this pilot)

- Whole-catalog generation (schema supports it; only ~10–20 generated now).
- Matchup/comparison narratives (the `verdicts` extension idea) — separate.
- Automatic staleness/fingerprint detection.
- Any Anthropic API / edge function / cron integration.
- Per-fact confidence scoring or a review queue.

## 11. Acceptance criteria

1. Migration creates `heroes.narrative_status`, `hero_narrative_facts`, `hero_tags`,
   `hero_tag_vocab` with public-read RLS; vocab seeded; types regenerated.
2. ~10–20 top-`issue_count` heroes have grounded `hero_narrative_facts` + `hero_tags`,
   reviewed, with `narrative_status = 'done'`.
3. `NarrativeSection` renders facts/explainers/era + tag chips on both the native
   and web character pages; renders nothing for heroes without narrative.
4. Controlled-vocab tags are filterable on Search/Discover (sparse but functional).
5. A hero can be re-queued (`narrative_status` → `pending`/`stale`) and
   regenerated, overwriting its prior rows.
6. No `any`; lint/types pass; `yarn test:ci` green.
