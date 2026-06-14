# LLM Narrative Enrichment (Pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-generated narrative layer (did-you-know facts, power explainers, era summary, themed tags) for a pilot set of ~10–20 top heroes, generated in-session by Claude and stored in normalized side-tables, surfaced on the character pages and as Search/Discover filters.

**Architecture:** New `hero_facts` + `hero_tags` + `hero_tag_vocab` tables (public-read RLS) gated by `heroes.narrative_status`. Generation is performed by Claude in this Claude Code session (model Sonnet) reading each hero's stored fields and writing rows via the Supabase MCP — no edge function, no Anthropic API, no cron. A `NarrativeSection` component renders the content on the native and web character pages; the controlled-vocab tags become a filter facet on Search/Discover.

**Tech Stack:** Expo SDK 56 / React Native, expo-router, Supabase (PostgREST + RLS), TypeScript, jest-expo + @testing-library/react-native. Schema via `supabase/migrations/` applied through the Supabase MCP.

**Spec:** `docs/superpowers/specs/2026-06-14-llm-narrative-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260614210000_create_hero_narrative.sql` | Schema: `heroes.narrative_status`, `hero_facts`, `hero_tags`, `hero_tag_vocab`; public-read RLS; vocab seed |
| `src/types/database.generated.ts` | Regenerated after migration (never hand-edited) |
| `src/types/index.ts` | Derive `HeroFact`, `HeroTag`, `HeroTagVocab` from generated types |
| `src/lib/db/heroFacts.ts` | Narrative queries + the pure `buildNarrative` mapper; tag-vocab + tag-filter helpers |
| `__tests__/lib/db/heroFacts.test.ts` | Unit tests for `buildNarrative` |
| `src/lib/db/categoryFilters.ts` | Add `tags` facet to the filter round-trip + active chips |
| `__tests__/lib/db/categoryFilters.test.ts` | Extend with `tags` round-trip tests |
| `src/lib/db/heroes.ts` | Apply tag filter in `getCategoryPage`; add `getTagFacetOptions` |
| `__tests__/lib/db/heroes.tagFilter.test.ts` | Test the tag-join filter is applied |
| `src/components/character/NarrativeSection.tsx` | Native render of facts/explainers/era + tag chips |
| `src/components/character/NarrativeSection.web.tsx` | Web render (same data, web styling) |
| `app/character/[id].tsx` | One import + section registration + render line |
| `app/character/[id].web.tsx` | One import + render line |
| `src/components/search/FilterChips.tsx` | Render selected tag chips (uses vocab labels) |

---

## Task 1: Migration — schema, RLS, vocab seed

**Files:**
- Create: `supabase/migrations/20260614210000_create_hero_narrative.sql`
- Modify (regenerate, do not hand-edit): `src/types/database.generated.ts`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260614210000_create_hero_narrative.sql`:

```sql
-- Lane 2: LLM narrative enrichment (pilot).
-- Side-tables for AI-generated narrative, gated by heroes.narrative_status.
-- Public-read RLS; writes happen via the service role (Supabase MCP).

-- 1. Status gate on heroes (mirrors comicvine_status / ai_stats_status).
alter table public.heroes
  add column if not exists narrative_status text not null default 'pending'
    check (narrative_status in ('pending','done','failed','stale'));

create index if not exists heroes_narrative_status_idx
  on public.heroes (narrative_status, issue_count desc nulls last);

-- 2. Controlled tag vocabulary (source of truth for allowed tags).
create table if not exists public.hero_tag_vocab (
  slug        text primary key,
  label       text not null,
  description text not null,
  category    text not null
);

-- 3. Text outputs (did_you_know rows ordered by position; one power_explainer
--    row per power with subject=power name; one era_summary row).
create table if not exists public.hero_facts (
  id           bigint generated always as identity primary key,
  hero_id      uuid not null references public.heroes(id) on delete cascade,
  kind         text not null check (kind in ('did_you_know','power_explainer','era_summary')),
  content      text not null,
  subject      text,
  position     int,
  source_model text not null,
  needs_review boolean not null default false,
  generated_at timestamptz not null default now()
);
create index if not exists hero_facts_hero_id_kind_idx on public.hero_facts (hero_id, kind);

-- 4. Normalized, filterable tags.
create table if not exists public.hero_tags (
  hero_id uuid not null references public.heroes(id) on delete cascade,
  tag     text not null references public.hero_tag_vocab(slug),
  primary key (hero_id, tag)
);
create index if not exists hero_tags_tag_idx on public.hero_tags (tag);

-- 5. Public-read RLS on all three new tables (anon reads return 0 rows without this).
alter table public.hero_tag_vocab enable row level security;
alter table public.hero_facts     enable row level security;
alter table public.hero_tags      enable row level security;

create policy "hero_tag_vocab_public_read" on public.hero_tag_vocab for select using (true);
create policy "hero_facts_public_read"     on public.hero_facts     for select using (true);
create policy "hero_tags_public_read"      on public.hero_tags      for select using (true);

-- 6. Seed the controlled vocabulary (~35 slugs across 5 categories).
insert into public.hero_tag_vocab (slug, label, description, category) values
  ('anti-hero',        'Anti-hero',        'Protagonist who lacks conventional heroic morals.', 'archetype'),
  ('reformed-villain', 'Reformed villain', 'Former antagonist now aligned with heroes.',         'archetype'),
  ('legacy-hero',      'Legacy hero',      'Inherits a mantle/identity from a predecessor.',     'archetype'),
  ('vigilante',        'Vigilante',        'Operates outside the law to fight crime.',           'archetype'),
  ('mentor',           'Mentor',           'Trains or guides other heroes.',                     'archetype'),
  ('sidekick',         'Sidekick',         'Partner/apprentice to a lead hero.',                 'archetype'),
  ('mastermind',       'Mastermind',       'Defined by strategic/intellectual planning.',        'archetype'),
  ('monster-hunter',   'Monster hunter',   'Specializes in hunting supernatural threats.',       'archetype'),
  ('mutant',           'Mutant',           'Powers from being born a genetic mutant.',           'source'),
  ('mutate',           'Mutate',           'Powers from accidental mutation/exposure.',          'source'),
  ('cosmic-powered',   'Cosmic-powered',   'Powers from a cosmic/universal source.',             'source'),
  ('tech-based',       'Tech-based',       'Relies on technology/equipment for abilities.',      'source'),
  ('magic-user',       'Magic user',       'Wields magic or the mystic arts.',                   'source'),
  ('super-soldier',    'Super-soldier',    'Enhanced via a deliberate program/serum.',           'source'),
  ('alien',            'Alien',            'Non-human extraterrestrial in origin.',              'source'),
  ('mythological',     'Mythological',     'Derived from gods/myth/legend.',                     'source'),
  ('street-level',     'Street-level',     'Operates at a grounded, local scale.',               'scope'),
  ('cosmic',           'Cosmic',           'Operates at a universal/cosmic scale.',              'scope'),
  ('reality-warper',   'Reality-warper',   'Can alter reality itself.',                          'scope'),
  ('powerhouse',       'Powerhouse',       'Defined by raw strength/durability.',                'scope'),
  ('gadgeteer',        'Gadgeteer',        'Relies on invented gadgets and gear.',               'scope'),
  ('tragic-backstory', 'Tragic backstory', 'Origin rooted in loss or tragedy.',                  'tone'),
  ('morally-grey',     'Morally grey',     'Ambiguous morality.',                                'tone'),
  ('brooding',         'Brooding',         'Dark, serious tone.',                                 'tone'),
  ('comic-relief',     'Comic relief',     'Primarily humorous in tone.',                        'tone'),
  ('wholesome',        'Wholesome',        'Earnest, optimistic tone.',                          'tone'),
  ('noir',             'Noir',             'Hardboiled/noir atmosphere.',                        'tone'),
  ('team-leader',      'Team leader',      'Leads a super-team.',                                'role'),
  ('lone-wolf',        'Lone wolf',        'Works alone by preference.',                         'role'),
  ('government-agent',  'Government agent', 'Works for a government/agency.',                     'role'),
  ('outlaw',           'Outlaw',           'Wanted by/at odds with authorities.',                'role'),
  ('shapeshifter',     'Shapeshifter',     'Can change physical form.',                          'role'),
  ('speedster',        'Speedster',        'Superhuman speed is the defining power.',            'role'),
  ('telepath',         'Telepath',         'Telepathic/psychic abilities.',                      'role'),
  ('immortal',         'Immortal',         'Does not age / cannot die conventionally.',          'role')
on conflict (slug) do nothing;
```

- [ ] **Step 2: Apply the migration via the Supabase MCP**

Use `mcp__supabase__apply_migration` with name `create_hero_narrative` and the SQL above (project ref `rpvgqfaeiowisdubgxkg`).
Expected: success, no error.

- [ ] **Step 3: Verify tables, RLS, and seed**

Run via `mcp__supabase__execute_sql`:
```sql
select count(*) as vocab_count from public.hero_tag_vocab;
select column_name from information_schema.columns
  where table_name = 'heroes' and column_name = 'narrative_status';
```
Expected: `vocab_count = 35`; one row for `narrative_status`.

- [ ] **Step 4: Check advisors (RLS/security)**

Run `mcp__supabase__get_advisors` with type `security`.
Expected: no new ERROR-level advisory for `hero_facts`, `hero_tags`, or `hero_tag_vocab` (public-read policies exist).

- [ ] **Step 5: Regenerate generated types**

Run `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.generated.ts` with the result.
Expected: file now contains `hero_facts`, `hero_tags`, `hero_tag_vocab`, and `narrative_status` on `heroes`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260614210000_create_hero_narrative.sql src/types/database.generated.ts
git commit -m "feat(db): add hero narrative side-tables + tag vocab (Lane 2)"
```

---

## Task 2: Derive app types

**Files:**
- Modify: `src/types/index.ts` (after line 7, the existing DB type derivations)

- [ ] **Step 1: Add derived types**

In `src/types/index.ts`, directly below `export type UserProfile = Tables<'user_profiles'>;`, add:

```ts
export type HeroFact = Tables<'hero_facts'>;
export type HeroTag = Tables<'hero_tags'>;
export type HeroTagVocab = Tables<'hero_tag_vocab'>;
```

- [ ] **Step 2: Verify types compile**

Run: `yarn tsc --noEmit`
Expected: no errors referencing `hero_facts` / `hero_tags` / `hero_tag_vocab`.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): derive hero narrative table types"
```

---

## Task 3: `heroFacts.ts` query module + pure mapper (TDD)

**Files:**
- Create: `src/lib/db/heroFacts.ts`
- Test: `__tests__/lib/db/heroFacts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/heroFacts.test.ts`:

```ts
import { buildNarrative } from '../../../src/lib/db/heroFacts';

describe('buildNarrative', () => {
  it('orders did_you_know by position and maps explainers/era/tags', () => {
    const facts = [
      { kind: 'did_you_know', content: 'Second', subject: null, position: 1 },
      { kind: 'did_you_know', content: 'First', subject: null, position: 0 },
      { kind: 'power_explainer', content: 'Lets them fly.', subject: 'Flight', position: null },
      { kind: 'era_summary', content: 'A Bronze Age icon.', subject: null, position: null },
    ];
    const tags = [{ tag: 'anti-hero', hero_tag_vocab: { label: 'Anti-hero' } }];

    const n = buildNarrative(facts, tags);

    expect(n.didYouKnow).toEqual(['First', 'Second']);
    expect(n.powerExplainers).toEqual([{ power: 'Flight', text: 'Lets them fly.' }]);
    expect(n.eraSummary).toBe('A Bronze Age icon.');
    expect(n.tags).toEqual([{ slug: 'anti-hero', label: 'Anti-hero' }]);
    expect(n.isEmpty).toBe(false);
  });

  it('drops power explainers with no subject and reports empty', () => {
    const n = buildNarrative(
      [{ kind: 'power_explainer', content: 'orphan', subject: null, position: null }],
      [],
    );
    expect(n.powerExplainers).toEqual([]);
    expect(n.eraSummary).toBeNull();
    expect(n.isEmpty).toBe(true);
  });

  it('falls back to slug when a tag has no vocab label', () => {
    const n = buildNarrative([], [{ tag: 'mutant', hero_tag_vocab: null }]);
    expect(n.tags).toEqual([{ slug: 'mutant', label: 'mutant' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/db/heroFacts.test.ts`
Expected: FAIL — cannot find module `heroFacts` / `buildNarrative` is not exported.

- [ ] **Step 3: Implement the module**

Create `src/lib/db/heroFacts.ts`:

```ts
import { supabase } from '../supabase';
import type { HeroTagVocab } from '../../types';

export interface PowerExplainer {
  power: string;
  text: string;
}

export interface HeroTagChip {
  slug: string;
  label: string;
}

export interface HeroNarrative {
  didYouKnow: string[];
  powerExplainers: PowerExplainer[];
  eraSummary: string | null;
  tags: HeroTagChip[];
  isEmpty: boolean;
}

interface FactRow {
  kind: string;
  content: string;
  subject: string | null;
  position: number | null;
}

interface TagJoinRow {
  tag: string;
  hero_tag_vocab: { label: string } | null;
}

const emptyNarrative = (): HeroNarrative => ({
  didYouKnow: [],
  powerExplainers: [],
  eraSummary: null,
  tags: [],
  isEmpty: true,
});

/** Pure: fold raw hero_facts + hero_tags rows into the render-ready shape. */
export function buildNarrative(facts: FactRow[], tags: TagJoinRow[]): HeroNarrative {
  const didYouKnow = facts
    .filter((f) => f.kind === 'did_you_know')
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((f) => f.content);

  const powerExplainers = facts
    .filter((f) => f.kind === 'power_explainer')
    .map((f) => ({ power: f.subject ?? '', text: f.content }))
    .filter((p) => p.power.length > 0);

  const eraSummary = facts.find((f) => f.kind === 'era_summary')?.content ?? null;

  const tagChips: HeroTagChip[] = tags.map((t) => ({
    slug: t.tag,
    label: t.hero_tag_vocab?.label ?? t.tag,
  }));

  const isEmpty =
    didYouKnow.length === 0 &&
    powerExplainers.length === 0 &&
    eraSummary === null &&
    tagChips.length === 0;

  return { didYouKnow, powerExplainers, eraSummary, tags: tagChips, isEmpty };
}

/** Fetch the narrative for one hero. Returns empty shape when none exists. */
export async function getHeroNarrative(heroId: string): Promise<HeroNarrative> {
  if (!heroId) return emptyNarrative();

  const [factsRes, tagsRes] = await Promise.all([
    supabase
      .from('hero_facts')
      .select('kind, content, subject, position')
      .eq('hero_id', heroId),
    supabase
      .from('hero_tags')
      .select('tag, hero_tag_vocab(label)')
      .eq('hero_id', heroId),
  ]);

  if (factsRes.error) throw new Error(factsRes.error.message);
  if (tagsRes.error) throw new Error(tagsRes.error.message);

  return buildNarrative(
    (factsRes.data ?? []) as FactRow[],
    (tagsRes.data ?? []) as unknown as TagJoinRow[],
  );
}

/** Vocab options (slug + label) for the Search/Discover tag facet. */
export async function getTagVocab(): Promise<Pick<HeroTagVocab, 'slug' | 'label' | 'category'>[]> {
  const { data, error } = await supabase
    .from('hero_tag_vocab')
    .select('slug, label, category')
    .order('category')
    .order('label');
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/db/heroFacts.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/heroFacts.ts __tests__/lib/db/heroFacts.test.ts
git commit -m "feat(db): heroFacts query module + buildNarrative mapper"
```

---

## Task 4: Tag facet in `categoryFilters.ts` (TDD)

**Files:**
- Modify: `src/lib/db/categoryFilters.ts`
- Test: `__tests__/lib/db/categoryFilters.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `__tests__/lib/db/categoryFilters.test.ts` (inside the existing top-level `describe`, or add a new `describe`):

```ts
import {
  DEFAULT_FILTERS,
  filtersToParams,
  paramsToFilters,
} from '../../../src/lib/db/categoryFilters';

describe('tags facet round-trip', () => {
  it('defaults to an empty tag list', () => {
    expect(DEFAULT_FILTERS.tags).toEqual([]);
  });

  it('serializes selected tags to a csv param', () => {
    const p = filtersToParams('popular', { ...DEFAULT_FILTERS, tags: ['anti-hero', 'cosmic'] });
    expect(p.tags).toBe('anti-hero,cosmic');
  });

  it('omits the tags param when none selected', () => {
    const p = filtersToParams('popular', { ...DEFAULT_FILTERS, tags: [] });
    expect(p.tags).toBeUndefined();
  });

  it('parses a csv tags param back to an array', () => {
    const f = paramsToFilters('popular', { tags: 'anti-hero,cosmic' });
    expect(f.tags).toEqual(['anti-hero', 'cosmic']);
  });

  it('parses missing tags param to an empty array', () => {
    const f = paramsToFilters('popular', {});
    expect(f.tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/db/categoryFilters.test.ts`
Expected: FAIL — `DEFAULT_FILTERS.tags` is undefined; `p.tags` not set.

- [ ] **Step 3: Implement the facet**

Edit `src/lib/db/categoryFilters.ts`:

In the `CategoryFilters` interface, add after `hasStats: boolean;`:
```ts
  tags: string[];
```

In `DEFAULT_FILTERS`, add after `hasStats: false,`:
```ts
  tags: [],
```

In the `FilterParams` type, add `tags?: string;` to the `Partial<{ ... }>` block.

In `filtersToParams`, add before `return p;`:
```ts
  if (f.tags.length) p.tags = f.tags.join(',');
```

In `paramsToFilters`, add `tags` to the returned object:
```ts
    tags: p.tags ? p.tags.split(',').filter(Boolean) : [],
```

Extend the `ActiveChip` interface to carry the specific tag value:
```ts
export interface ActiveChip {
  key: FacetKey | 'search' | 'tags';
  label: string;
  value?: string;
}
```

In `activeFilterList`, add before `return chips;`:
```ts
  for (const slug of f.tags) {
    chips.push({ key: 'tags', label: TAG_LABELS[slug] ?? slug, value: slug });
  }
```

And add a `TAG_LABELS` map near the existing `LABELS` const (slugs → display labels, mirroring the vocab seed):
```ts
const TAG_LABELS: Record<string, string> = {
  'anti-hero': 'Anti-hero',
  'reformed-villain': 'Reformed villain',
  'legacy-hero': 'Legacy hero',
  vigilante: 'Vigilante',
  mentor: 'Mentor',
  sidekick: 'Sidekick',
  mastermind: 'Mastermind',
  'monster-hunter': 'Monster hunter',
  mutant: 'Mutant',
  mutate: 'Mutate',
  'cosmic-powered': 'Cosmic-powered',
  'tech-based': 'Tech-based',
  'magic-user': 'Magic user',
  'super-soldier': 'Super-soldier',
  alien: 'Alien',
  mythological: 'Mythological',
  'street-level': 'Street-level',
  cosmic: 'Cosmic',
  'reality-warper': 'Reality-warper',
  powerhouse: 'Powerhouse',
  gadgeteer: 'Gadgeteer',
  'tragic-backstory': 'Tragic backstory',
  'morally-grey': 'Morally grey',
  brooding: 'Brooding',
  'comic-relief': 'Comic relief',
  wholesome: 'Wholesome',
  noir: 'Noir',
  'team-leader': 'Team leader',
  'lone-wolf': 'Lone wolf',
  'government-agent': 'Government agent',
  outlaw: 'Outlaw',
  shapeshifter: 'Shapeshifter',
  speedster: 'Speedster',
  telepath: 'Telepath',
  immortal: 'Immortal',
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/db/categoryFilters.test.ts`
Expected: PASS (existing tests + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/categoryFilters.ts __tests__/lib/db/categoryFilters.test.ts
git commit -m "feat(filters): add tags facet to category filter round-trip"
```

---

## Task 5: Apply tag filter in `getCategoryPage` (TDD)

The category list query gains a tag filter via a PostgREST inner join on `hero_tags`. Facet *counts* for tags are out of scope (the `category_facet_counts` RPC is unchanged); tag options come from `getTagVocab` (Task 3).

**Files:**
- Modify: `src/lib/db/heroes.ts` (`getCategoryPage`, lines ~607–698)
- Test: `__tests__/lib/db/heroes.tagFilter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/db/heroes.tagFilter.test.ts`:

```ts
import { getCategoryPage } from '../../../src/lib/db/heroes';
import { DEFAULT_FILTERS } from '../../../src/lib/db/categoryFilters';

// Chain mock that records calls and resolves the range() terminal.
// eslint-disable-next-line prefer-const
let mockResult: { data: unknown[]; error: unknown; count: number } = {
  data: [],
  error: null,
  count: 0,
};

jest.mock('../../../src/lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'or', 'ilike', 'not', 'gte', 'order'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.range = jest.fn().mockImplementation(() => Promise.resolve(mockResult));
  const mockFrom = jest.fn().mockReturnValue(chain);
  return { supabase: { from: mockFrom }, __chain: chain, __mockFrom: mockFrom };
});

const { __chain: chain } = jest.requireMock('../../../src/lib/supabase');

describe('getCategoryPage tag filter', () => {
  beforeEach(() => {
    mockResult = { data: [], error: null, count: 0 };
    Object.values(chain).forEach((fn) => (fn as jest.Mock).mockClear?.());
  });

  it('does not add a hero_tags filter when no tags selected', async () => {
    await getCategoryPage('popular', { ...DEFAULT_FILTERS, page: 0 });
    const selectArg = (chain.select as jest.Mock).mock.calls[0][0] as string;
    expect(selectArg).not.toContain('hero_tags');
  });

  it('inner-joins hero_tags and filters by each selected tag', async () => {
    await getCategoryPage('popular', { ...DEFAULT_FILTERS, tags: ['anti-hero'], page: 0 });
    const selectArg = (chain.select as jest.Mock).mock.calls[0][0] as string;
    expect(selectArg).toContain('hero_tags!inner');
    expect(chain.eq).toHaveBeenCalledWith('hero_tags.tag', 'anti-hero');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn jest __tests__/lib/db/heroes.tagFilter.test.ts`
Expected: FAIL — select does not contain `hero_tags!inner`; `eq('hero_tags.tag', …)` not called.

- [ ] **Step 3: Implement the filter**

In `src/lib/db/heroes.ts` `getCategoryPage`:

Destructure `tags` from `options` (add `tags,` to the existing destructure block around line 621).

Change the select to conditionally inner-join when tags are present. Replace the `let q: any = supabase.from('heroes').select(...)` block (lines ~626–628) with:

```ts
  const hasTagFilter = tags.length > 0;
  const selectCols = hasTagFilter
    ? `${CATEGORY_LIST_COLUMNS}, hero_tags!inner(tag)`
    : CATEGORY_LIST_COLUMNS;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('heroes')
    .select(selectCols, withCount ? { count: 'exact' } : undefined);
```

Then, immediately after the "Has-powerstats facet" block (after line ~684, before the Search block), add:

```ts
  // Tag facet — inner join on hero_tags; AND-match each selected tag.
  for (const tag of tags) {
    q = q.eq('hero_tags.tag', tag);
  }
```

> Note: multiple `.eq('hero_tags.tag', …)` on a single inner join is an OR within the join in PostgREST; for the pilot (typically one tag selected) this is correct. Multi-tag AND semantics are out of scope and noted in the spec's caveats.

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn jest __tests__/lib/db/heroes.tagFilter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full db suite for regressions**

Run: `yarn jest __tests__/lib/db/`
Expected: all PASS (existing category-page tests unaffected — `tags` defaults to `[]`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/heroes.ts __tests__/lib/db/heroes.tagFilter.test.ts
git commit -m "feat(db): filter category page by hero tags"
```

---

## Task 6: `NarrativeSection` native component

**Files:**
- Create: `src/components/character/NarrativeSection.tsx`

Reference for styling conventions: `src/components/AbilitiesSection.tsx` (fonts, COLORS, StyleSheet). Use `FlameSans-Regular`/`Nunito_*` for UI text and `Flame-Regular` for any display heading — **never `Flame-Bold`**. Base canvas `COLORS.beige` (`#f5ebdc`).

- [ ] **Step 1: Implement the component**

Create `src/components/character/NarrativeSection.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import type { HeroNarrative } from '../../lib/db/heroFacts';

interface Props {
  narrative: HeroNarrative | null;
}

export function NarrativeSection({ narrative }: Props) {
  if (!narrative || narrative.isEmpty) return null;

  const { didYouKnow, powerExplainers, eraSummary, tags } = narrative;

  return (
    <View style={styles.container}>
      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((t) => (
            <View key={t.slug} style={styles.tagChip}>
              <Text style={styles.tagText}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}

      {didYouKnow.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.heading}>Did you know</Text>
          {didYouKnow.map((fact, i) => (
            <View key={i} style={styles.factRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.factText}>{fact}</Text>
            </View>
          ))}
        </View>
      )}

      {powerExplainers.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.heading}>Powers explained</Text>
          {powerExplainers.map((p) => (
            <View key={p.power} style={styles.explainer}>
              <Text style={styles.explainerName}>{p.power}</Text>
              <Text style={styles.explainerText}>{p.text}</Text>
            </View>
          ))}
        </View>
      )}

      {eraSummary && (
        <View style={styles.block}>
          <Text style={styles.heading}>Era</Text>
          <Text style={styles.eraText}>{eraSummary}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.ink },
  block: { gap: 10 },
  heading: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.ink },
  factRow: { flexDirection: 'row', gap: 8 },
  bullet: { fontFamily: 'FlameSans-Regular', fontSize: 15, color: COLORS.ink },
  factText: { flex: 1, fontFamily: 'FlameSans-Regular', fontSize: 15, lineHeight: 22, color: COLORS.ink },
  explainer: { gap: 2 },
  explainerName: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.ink },
  explainerText: { fontFamily: 'FlameSans-Regular', fontSize: 15, lineHeight: 22, color: COLORS.ink },
  eraText: { fontFamily: 'FlameSans-Regular', fontSize: 15, lineHeight: 22, color: COLORS.ink },
});
```

- [ ] **Step 2: Verify it compiles and confirm `COLORS.ink` exists**

Run: `grep -n "ink" src/constants/colors.ts`
If `ink` is not a key, substitute the closest dark-text color key present in `COLORS` (e.g. the primary text color) throughout the component.
Run: `yarn tsc --noEmit`
Expected: no errors in `NarrativeSection.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/character/NarrativeSection.tsx
git commit -m "feat(character): NarrativeSection native component"
```

---

## Task 7: Place `NarrativeSection` on the native character page

**Files:**
- Modify: `app/character/[id].tsx`

The screen tracks rendered sections in `presentSections` (lines ~635–671) for quick-nav, fetches per-section data with hooks/getters, and renders sections inside the scroll sheet. Add a narrative section following the existing `AbilitiesSection` pattern.

- [ ] **Step 1: Add the import**

Near the other component imports (around line 59, `import { AbilitiesSection } …`):
```ts
import { NarrativeSection } from '../../src/components/character/NarrativeSection';
import { getHeroNarrative, type HeroNarrative } from '../../src/lib/db/heroFacts';
```

- [ ] **Step 2: Add state + fetch**

Near the other `useState` hooks in the component body, add:
```ts
const [narrative, setNarrative] = useState<HeroNarrative | null>(null);
```
Add a fetch effect alongside the existing `getHeroFamily` effect (around line 673):
```ts
useEffect(() => {
  setNarrative(null);
  if (!id) return;
  let active = true;
  getHeroNarrative(id)
    .then((n) => { if (active) setNarrative(n); })
    .catch(() => { if (active) setNarrative(null); });
  return () => { active = false; };
}, [id]);
```

- [ ] **Step 3: Register the section in `presentSections`**

In the `presentSections` useMemo (lines ~635–658), add after the `abilities` push:
```ts
if (narrative && !narrative.isEmpty) s.push({ key: 'narrative', label: 'Lore' });
```
Add `narrative` to that useMemo's dependency array (lines ~659–670).

- [ ] **Step 4: Render the section**

In the scroll body where sections render (search for the `abilities` section render block, which uses the local `Section` wrapper at line ~179), add a sibling immediately after it:
```tsx
{narrative && !narrative.isEmpty && (
  <Section title="Lore">
    <NarrativeSection narrative={narrative} />
  </Section>
)}
```
If the section render uses an `onLayout` registration keyed by section name (matching `presentSections` keys), register this block under the key `'narrative'` exactly as the neighbouring sections do.

- [ ] **Step 5: Verify types compile**

Run: `yarn tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Verify in-app (native)**

Run: `yarn start` and open a hero that will be in the pilot set on iOS/Android (or Expo Go). After Task 10's data exists, confirm the "Lore" section renders facts/explainers/era + tags, and that heroes without narrative show no Lore section.
Expected: section renders for piloted heroes only.

- [ ] **Step 7: Commit**

```bash
git add app/character/[id].tsx
git commit -m "feat(character): render NarrativeSection on native character page"
```

---

## Task 8: `NarrativeSection.web` + placement on the web character page

**Files:**
- Create: `src/components/character/NarrativeSection.web.tsx`
- Modify: `app/character/[id].web.tsx`

- [ ] **Step 1: Inspect the web page's section pattern**

Run: `grep -nE "Section|getHero|useState|import .*Section" 'app/character/[id].web.tsx' | head -40`
Note how an existing section (e.g. abilities/summary) is imported, fetched, and rendered on the web page, and mirror that pattern below.

- [ ] **Step 2: Implement the web component**

Create `src/components/character/NarrativeSection.web.tsx` using the same `HeroNarrative` prop and the same content structure as the native component, styled to match the surrounding web character sections (follow the nearest existing web section component for layout/spacing; reuse `COLORS`; never `Flame-Bold`). Keep the `if (!narrative || narrative.isEmpty) return null;` guard.

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import type { HeroNarrative } from '../../lib/db/heroFacts';

interface Props {
  narrative: HeroNarrative | null;
}

export function NarrativeSection({ narrative }: Props) {
  if (!narrative || narrative.isEmpty) return null;
  const { didYouKnow, powerExplainers, eraSummary, tags } = narrative;
  return (
    <View style={styles.container}>
      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((t) => (
            <View key={t.slug} style={styles.tagChip}>
              <Text style={styles.tagText}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}
      {didYouKnow.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.heading}>Did you know</Text>
          {didYouKnow.map((fact, i) => (
            <Text key={i} style={styles.factText}>• {fact}</Text>
          ))}
        </View>
      )}
      {powerExplainers.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.heading}>Powers explained</Text>
          {powerExplainers.map((p) => (
            <View key={p.power} style={styles.explainer}>
              <Text style={styles.explainerName}>{p.power}</Text>
              <Text style={styles.explainerText}>{p.text}</Text>
            </View>
          ))}
        </View>
      )}
      {eraSummary && (
        <View style={styles.block}>
          <Text style={styles.heading}>Era</Text>
          <Text style={styles.eraText}>{eraSummary}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  tagText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.ink },
  block: { gap: 10 },
  heading: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.ink },
  factText: { fontFamily: 'FlameSans-Regular', fontSize: 16, lineHeight: 24, color: COLORS.ink },
  explainer: { gap: 2 },
  explainerName: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.ink },
  explainerText: { fontFamily: 'FlameSans-Regular', fontSize: 16, lineHeight: 24, color: COLORS.ink },
  eraText: { fontFamily: 'FlameSans-Regular', fontSize: 16, lineHeight: 24, color: COLORS.ink },
});
```

(Apply the same `COLORS.ink` fallback check as Task 6 Step 2 if needed.)

- [ ] **Step 3: Wire it into the web page**

In `app/character/[id].web.tsx`: add the import (`import { NarrativeSection } from '../../src/components/character/NarrativeSection.web';` and the `getHeroNarrative`/`HeroNarrative` import), add `narrative` state + the same fetch effect as Task 7 Step 2, and render `<NarrativeSection narrative={narrative} />` in the appropriate section slot following the web page's existing section pattern from Step 1.

- [ ] **Step 4: Verify types compile**

Run: `yarn tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Verify in-app (web)**

Run: `yarn start --web`, open a piloted hero (after Task 10).
Expected: narrative renders on the web character page; absent for non-piloted heroes.

- [ ] **Step 6: Commit**

```bash
git add src/components/character/NarrativeSection.web.tsx 'app/character/[id].web.tsx'
git commit -m "feat(character): NarrativeSection on web character page"
```

---

## Task 9: Surface tag filter on Search/Discover

Wire the `tags` facet (Task 4) and `getTagVocab` (Task 3) into the search/discover filter UI so users can select controlled-vocab tags. Selecting a tag updates the `tags` filter, which `getCategoryPage` (Task 5) already applies.

**Files:**
- Modify: the search/category filter UI that consumes `visibleFacets` / `activeFilterList` (start at `src/components/search/FilterChips.tsx`; trace its consumers in `app/(tabs)/search/` and `app/(tabs)/explore*.tsx`)

- [ ] **Step 1: Locate the filter UI integration points**

Run:
```bash
grep -rn "activeFilterList\|visibleFacets\|filtersToParams\|CategoryFilters" app src/components | grep -v __tests__
```
Identify (a) where active filter chips are rendered (uses `activeFilterList`) and (b) where facet controls let the user pick values.

- [ ] **Step 2: Render selected tag chips as removable**

Where `activeFilterList(slug, filters)` chips are rendered, ensure a chip with `key === 'tags'` removes only its own `value` from `filters.tags` (not the whole facet). Example handler:
```ts
function removeChip(chip: ActiveChip) {
  if (chip.key === 'tags' && chip.value) {
    update({ ...filters, tags: filters.tags.filter((t) => t !== chip.value) });
    return;
  }
  // ...existing per-facet reset logic
}
```

- [ ] **Step 3: Add a tag picker control**

In the facet control surface, load options via `getTagVocab()` (cache in component state) and render them grouped by `category`. Selecting a tag toggles its slug in `filters.tags`:
```ts
function toggleTag(slug: string) {
  update({
    ...filters,
    tags: filters.tags.includes(slug)
      ? filters.tags.filter((t) => t !== slug)
      : [...filters.tags, slug],
  });
}
```
Render selected state and reuse the existing chip styling from `FilterChips.tsx`.

- [ ] **Step 4: Verify the round-trip end to end**

Run: `yarn start --web`, open Search/Discover, select a tag present in the pilot set (after Task 10).
Expected: the URL/query `tags=` param updates, the list narrows to piloted heroes carrying that tag, and the active chip removes cleanly. With ~10–20 tagged heroes the result set is intentionally small (documented caveat).

- [ ] **Step 5: Run the full test suite**

Run: `yarn test:ci`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(search): controlled-vocab tag filter on Search/Discover"
```

---

## Task 10: Generate the pilot narrative data (in-session)

This is the manual generation step — performed by Claude in this session, not by code. No commit (generated rows live in the DB, not the repo).

- [ ] **Step 1: Select the pilot set**

Run via `mcp__supabase__execute_sql`:
```sql
select id, name, alignment, publisher, summary, origin, description,
       powers, enemies, friends, teams, first_issue_data, issue_count
from public.heroes
where narrative_status = 'pending'
order by issue_count desc nulls last
limit 15;
```
This returns the top ~15 heroes by popularity with all grounding fields.

- [ ] **Step 2: Generate per-hero structured output (strict DB-only grounding)**

For each hero, from ONLY the returned fields, produce:
```json
{
  "did_you_know": ["2–4 short grounded facts"],
  "power_explainers": { "<power from powers[]>": "plain-language description" },
  "era_summary": "one short paragraph; ground era on first_issue_data.coverDate year + publisher (Golden/Silver/Bronze/Modern)",
  "tags": ["<slugs from hero_tag_vocab only>"]
}
```
Rules: never invent beyond the provided fields; omit any output whose grounding is absent (e.g. no `first_issue_data` → no `era_summary`); choose 2–5 tags strictly from the vocab; `power_explainers` keys must come from the hero's `powers`.

- [ ] **Step 3: Write rows via MCP (per hero)**

For each hero `:hero_id` with `:model = 'claude-sonnet-4-6 (claude-code session)'`, run via `mcp__supabase__execute_sql` (clear-then-insert so it is also the regeneration path):
```sql
delete from public.hero_facts where hero_id = :hero_id;
delete from public.hero_tags  where hero_id = :hero_id;

insert into public.hero_facts (hero_id, kind, content, subject, position, source_model) values
  (:hero_id, 'did_you_know', :fact0, null, 0, :model),
  (:hero_id, 'did_you_know', :fact1, null, 1, :model),
  (:hero_id, 'power_explainer', :explainerText, :powerName, null, :model),
  (:hero_id, 'era_summary', :eraText, null, null, :model);

insert into public.hero_tags (hero_id, tag) values
  (:hero_id, :tag0), (:hero_id, :tag1)
on conflict do nothing;
```
(Include only the rows that exist for that hero; escape text safely.)

- [ ] **Step 4: Human review gate**

Present the generated content for the pilot heroes to the user for review. Mark any questionable fact with `needs_review = true`:
```sql
update public.hero_facts set needs_review = true where id = :fact_id;
```
Wait for user sign-off before Step 5.

- [ ] **Step 5: Flip status to done**

After sign-off, for each reviewed hero:
```sql
update public.heroes set narrative_status = 'done' where id = :hero_id;
```
Verify:
```sql
select narrative_status, count(*) from public.heroes group by narrative_status;
```
Expected: ~15 heroes now `done`.

---

## Task 11: Final verification

- [ ] **Step 1: Lint, types, tests**

Run:
```bash
yarn tsc --noEmit
yarn test:ci
```
Expected: no type errors; all tests green.

- [ ] **Step 2: Manual smoke (native + web)**

Open a piloted hero and a non-piloted hero on both native and web. Confirm the Lore section appears only for piloted heroes, tags render as chips, and the Search/Discover tag filter narrows results.

- [ ] **Step 3: Final commit (if any uncommitted changes remain)**

```bash
git add -A
git commit -m "chore: Lane 2 narrative pilot — final verification"
```

---

## Self-Review Notes

- **Spec §3 (data model):** Task 1 (all tables, RLS, gate, index, vocab seed).
- **Spec §4 (vocab):** Task 1 Step 1 seed (35 slugs) + Task 4 `TAG_LABELS`.
- **Spec §5 (grounding):** Task 10 Steps 1–2 (DB-only fields, output shape, era derivation).
- **Spec §6 (accuracy/regen):** Task 10 Step 4 review + `needs_review`; Step 3 clear-then-insert is the regeneration path; manual re-queue via `narrative_status`.
- **Spec §7.1/7.2 (character UI + db module):** Tasks 3, 6, 7, 8.
- **Spec §7.3 (Search/Discover):** Tasks 4, 5, 9 (facet-count RPC intentionally untouched; tag counts out of scope per the sparse-pilot caveat).
- **Spec §9 (conventions):** migrations via MCP + type regen (Task 1); db-module-only access (Task 3); no `any` beyond the existing eslint-disabled query builder; `StyleSheet.create`; never Flame-Bold.
- **Type consistency:** `HeroNarrative`/`buildNarrative`/`getHeroNarrative`/`getTagVocab` (Task 3) are reused verbatim in Tasks 6–9; `CategoryFilters.tags: string[]` (Task 4) is consumed by Task 5 and Task 9.
