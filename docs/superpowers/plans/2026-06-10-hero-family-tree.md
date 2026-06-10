# Hero Family Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a generational family tree on the character page, backed by a normalized `hero_relatives` table that is parsed/classified/linked once upstream by a backfill job.

**Architecture:** The messy `heroes.relatives` free-text string is parsed and classified by pure TS modules in `src/lib/family/` (jest-tested). A Supabase edge function (`backfill-family`) reuses that logic to populate a normalized `hero_relatives` table, resolving each relative's name/alias to a `related_hero_id`. The character page reads enriched rows via `getHeroFamily`, groups them with the pure `buildTiers`, and renders them with platform-specific `FamilyTree` components — linked relatives become tappable mini hero cards.

**Tech Stack:** Expo Router 4, React Native, Supabase (Postgres + edge functions/Deno), TypeScript, jest-expo, yarn.

**Spec:** `docs/superpowers/specs/2026-06-10-hero-family-tree-design.md`

**Working branch:** `master` (this repo commits directly to master — no feature branches).

---

## File Structure

**Create:**
- `src/lib/family/types.ts` — shared types (`RelationKind`, `ParsedRelative`, `Classification`, `FamilyMember`, `FamilyTier`, `FamilyModel`).
- `src/lib/family/classifyRole.ts` — `classifyRole(role)` → `{ relation, tier, modifiers, status }`.
- `src/lib/family/parseRelatives.ts` — `parseRelatives(raw)` → `ParsedRelative[]`.
- `src/lib/family/buildTiers.ts` — `buildTiers(members)` → `FamilyModel` (tiers + asides + footnotes).
- `src/lib/family/rowToMember.ts` — `rowToMember(row)` maps a joined PostgREST row → `FamilyMember`.
- `supabase/functions/_shared/family.ts` — Deno-compatible copy of parse+classify (no external imports).
- `supabase/functions/backfill-family/index.ts` — resumable batch backfill.
- `supabase/migrations/<ts>_create_hero_relatives.sql` — enum + table + indexes + RLS.
- `src/components/family/FamilyTree.web.tsx` — web/desktop renderer.
- `src/components/family/FamilyTree.tsx` — native renderer.
- Tests: `__tests__/lib/family/{classifyRole,parseRelatives,buildTiers,rowToMember,parity}.test.ts`.

**Modify:**
- `src/lib/db/heroes.ts` — add `getHeroFamily(heroId)`.
- `app/character/[id].web.tsx` — fetch family, render `<FamilyTree>` in `mainCol`, remove the Quick-Facts "Relatives" `InfoRow`, add skeleton.
- `app/character/[id].tsx` — fetch family, render native `<FamilyTree>`, remove `RelativesList`.
- `src/types/database.generated.ts` — regenerated after migration (never hand-edited).

---

## Task 1: Create the `hero_relatives` table

**Files:**
- Create migration via Supabase MCP (`mcp__supabase__apply_migration`), name `create_hero_relatives`.
- Regenerate: `src/types/database.generated.ts`.

- [ ] **Step 1: Apply the migration**

Call `mcp__supabase__apply_migration` with name `create_hero_relatives` and this SQL:

```sql
create type relation_kind as enum (
  'parent','child','sibling','spouse','grandparent','grandchild',
  'aunt_uncle','niece_nephew','cousin','in_law','ancestor','clone','other'
);

create table hero_relatives (
  id              uuid primary key default gen_random_uuid(),
  hero_id         text not null references heroes(id) on delete cascade, -- heroes.id is text
  name            text not null,
  alias           text,
  role            text not null,
  relation        relation_kind not null,
  tier            smallint not null,
  modifiers       text[] not null default '{}',
  status          text,
  related_hero_id text references heroes(id) on delete set null,
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

create index hero_relatives_hero_id_idx on hero_relatives (hero_id);
create index hero_relatives_related_hero_id_idx on hero_relatives (related_hero_id);

alter table hero_relatives enable row level security;
create policy "hero_relatives public read"
  on hero_relatives for select using (true);
```

- [ ] **Step 2: Verify the table exists**

Call `mcp__supabase__list_tables` (schema `public`). Expected: `hero_relatives` present with the columns above.

- [ ] **Step 3: Regenerate types**

Call `mcp__supabase__generate_typescript_types` and overwrite `src/types/database.generated.ts` with the result.

- [ ] **Step 4: Typecheck**

Run: `yarn tsc --noEmit`
Expected: passes (no references to the new table yet, so this just confirms the generated file is valid).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations src/types/database.generated.ts
git commit -m "feat(family): add hero_relatives table"
```

---

## Task 2: Shared family types

**Files:**
- Create: `src/lib/family/types.ts`

- [ ] **Step 1: Write the types**

```ts
// src/lib/family/types.ts
export type RelationKind =
  | 'parent' | 'child' | 'sibling' | 'spouse'
  | 'grandparent' | 'grandchild' | 'aunt_uncle' | 'niece_nephew'
  | 'cousin' | 'in_law' | 'ancestor' | 'clone' | 'other';

export type RelativeStatus = 'deceased' | 'estranged' | 'formerly' | 'alleged' | null;

/** One entry extracted from the raw `relatives` string, before classification. */
export interface ParsedRelative {
  name: string;
  alias: string | null;
  role: string;        // raw role text inside parens, '' if none
  position: number;    // source order
}

/** Result of classifying a role string. */
export interface Classification {
  relation: RelationKind;
  tier: number;        // +2..-2, or 9 for clone/aside
  modifiers: string[]; // adoptive | step | foster | half
  status: RelativeStatus;
}

/** Enriched row returned by getHeroFamily (after the heroes join). */
export interface FamilyMember {
  id: string;
  name: string;
  alias: string | null;
  role: string;
  relation: RelationKind;
  tier: number;
  modifiers: string[];
  status: RelativeStatus;
  position: number;
  heroId: string | null;       // related_hero_id, if it resolved to a page
  heroImage: string | null;    // portrait for linked nodes
  heroPower: number | null;    // power badge for linked nodes
  heroAlignment: string | null;
}

export interface FamilyTier {
  tier: number;
  label: string;
  members: FamilyMember[];
}

export interface FamilyModel {
  tiers: FamilyTier[];        // ordered 2 → -2; empty tiers omitted
  asides: FamilyMember[];     // clones / variants
  footnotes: FamilyMember[];  // non-family entries (girlfriend, fiancé…)
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/family/types.ts
git commit -m "feat(family): add shared family types"
```

---

## Task 3: `classifyRole` (TDD)

**Files:**
- Create: `src/lib/family/classifyRole.ts`
- Test: `__tests__/lib/family/classifyRole.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/family/classifyRole.test.ts
import { classifyRole } from '../../../src/lib/family/classifyRole';

describe('classifyRole', () => {
  it('maps parents to tier +1', () => {
    expect(classifyRole('father')).toMatchObject({ relation: 'parent', tier: 1 });
    expect(classifyRole('mother')).toMatchObject({ relation: 'parent', tier: 1 });
  });

  it('captures adoptive/step/foster/half modifiers', () => {
    expect(classifyRole('adoptive father')).toMatchObject({ relation: 'parent', modifiers: ['adoptive'] });
    expect(classifyRole('foster daughter')).toMatchObject({ relation: 'child', modifiers: ['foster'] });
    expect(classifyRole('half-brother')).toMatchObject({ relation: 'sibling', modifiers: ['half'] });
  });

  it('does not confuse grandfather with father', () => {
    expect(classifyRole('grandfather')).toMatchObject({ relation: 'grandparent', tier: 2 });
    expect(classifyRole('paternal grandfather')).toMatchObject({ relation: 'grandparent', tier: 2 });
  });

  it('does not confuse grandson with son', () => {
    expect(classifyRole('grandson')).toMatchObject({ relation: 'grandchild', tier: -2 });
  });

  it('routes great-grandparents and ancestors to tier +2 ancestor', () => {
    expect(classifyRole('great-grandfather')).toMatchObject({ relation: 'ancestor', tier: 2 });
    expect(classifyRole('ancestor')).toMatchObject({ relation: 'ancestor', tier: 2 });
  });

  it('routes in-laws before parents/siblings', () => {
    expect(classifyRole('mother-in-law')).toMatchObject({ relation: 'in_law', tier: 0 });
    expect(classifyRole('sister-in-law')).toMatchObject({ relation: 'in_law', tier: 0 });
  });

  it('handles spouse with ex → formerly status', () => {
    expect(classifyRole('wife')).toMatchObject({ relation: 'spouse', tier: 0, status: null });
    expect(classifyRole('ex-wife')).toMatchObject({ relation: 'spouse', status: 'formerly' });
  });

  it('detects deceased status without changing tier', () => {
    expect(classifyRole('father, deceased')).toMatchObject({ relation: 'parent', tier: 1, status: 'deceased' });
  });

  it('routes clones to the aside tier 9', () => {
    expect(classifyRole('clone')).toMatchObject({ relation: 'clone', tier: 9 });
    expect(classifyRole('partial clone')).toMatchObject({ relation: 'clone', tier: 9 });
  });

  it('falls back to other/tier 0 for unknown roles', () => {
    expect(classifyRole('fiancée')).toMatchObject({ relation: 'other', tier: 0 });
    expect(classifyRole('')).toMatchObject({ relation: 'other', tier: 0 });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `yarn jest classifyRole`
Expected: FAIL — `Cannot find module '.../classifyRole'`.

- [ ] **Step 3: Implement `classifyRole`**

```ts
// src/lib/family/classifyRole.ts
import type { Classification, RelationKind, RelativeStatus } from './types';

const STATUS_PATTERNS: [RegExp, NonNullable<RelativeStatus>][] = [
  [/deceased|\bdead\b/, 'deceased'],
  [/estranged/, 'estranged'],
  [/\bex[- ]|former|divorced/, 'formerly'],
  [/alleged|presum|reported|possibl/, 'alleged'],
];

const MODIFIER_PATTERNS: [RegExp, string][] = [
  [/adoptive|adopted/, 'adoptive'],
  [/step[- ]?/, 'step'],
  [/foster/, 'foster'],
  [/half[- ]/, 'half'],
];

// First match wins — order is significant (specific before general).
const RELATION_RULES: [RegExp, RelationKind, number][] = [
  [/great[- ]?grand|ancestor|descendant/, 'ancestor', 2],
  [/grandparent|grandfather|grandmother|grandad|grandma/, 'grandparent', 2],
  [/grandchild|grandson|granddaughter/, 'grandchild', -2],
  [/in[- ]law/, 'in_law', 0],
  [/father|mother|\bparent|\bmom\b|\bdad\b/, 'parent', 1],
  [/aunt|uncle/, 'aunt_uncle', 1],
  [/wife|husband|spouse|widow/, 'spouse', 0],
  [/brother|sister|sibling/, 'sibling', 0],
  [/cousin/, 'cousin', 0],
  [/niece|nephew/, 'niece_nephew', -1],
  [/\bson\b|daughter|child/, 'child', -1],
  [/clone|duplicate|genetic|alternate|counterpart/, 'clone', 9],
];

export function classifyRole(role: string): Classification {
  const r = role.toLowerCase();
  const modifiers = MODIFIER_PATTERNS.filter(([re]) => re.test(r)).map(([, m]) => m);
  const statusHit = STATUS_PATTERNS.find(([re]) => re.test(r));
  const status: RelativeStatus = statusHit ? statusHit[1] : null;
  for (const [re, relation, tier] of RELATION_RULES) {
    if (re.test(r)) return { relation, tier, modifiers, status };
  }
  return { relation: 'other', tier: 0, modifiers, status };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `yarn jest classifyRole`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/family/classifyRole.ts __tests__/lib/family/classifyRole.test.ts
git commit -m "feat(family): classifyRole role→tier classifier"
```

---

## Task 4: `parseRelatives` (TDD)

**Files:**
- Create: `src/lib/family/parseRelatives.ts`
- Test: `__tests__/lib/family/parseRelatives.test.ts`

- [ ] **Step 1: Write the failing test** (fixtures are real DB samples)

```ts
// __tests__/lib/family/parseRelatives.test.ts
import { parseRelatives } from '../../../src/lib/family/parseRelatives';

describe('parseRelatives', () => {
  it('returns [] for empty/sentinel input', () => {
    expect(parseRelatives(null)).toEqual([]);
    expect(parseRelatives('')).toEqual([]);
    expect(parseRelatives('-')).toEqual([]);
  });

  it('parses simple name (role) entries', () => {
    const out = parseRelatives('Matt McGinnis (brother)');
    expect(out).toEqual([{ name: 'Matt McGinnis', alias: null, role: 'brother', position: 0 }]);
  });

  it('treats the last comma-segment as role and the rest as alias', () => {
    const out = parseRelatives('Supergirl (Kara Zor-El, cousin)');
    expect(out[0]).toMatchObject({ name: 'Supergirl', alias: 'Kara Zor-El', role: 'cousin' });
  });

  it('keeps status inside the role segment', () => {
    const out = parseRelatives('Warren McGinnis (father, deceased)');
    expect(out[0]).toMatchObject({ name: 'Warren McGinnis', role: 'deceased', alias: 'father' });
  });

  it('does not split on commas inside parentheses', () => {
    const out = parseRelatives('Jor-El (father, deceased), Lara (mother, deceased)');
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.name)).toEqual(['Jor-El', 'Lara']);
  });

  it('splits on semicolons too', () => {
    const out = parseRelatives('Jarvis Pennyworth (father, deceased); Bruce Wayne (Batman, legal ward)');
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ name: 'Bruce Wayne', alias: 'Batman', role: 'legal ward' });
  });

  it('handles missing space before the paren', () => {
    const out = parseRelatives('Mary Parker(mother, deceased)');
    expect(out[0]).toMatchObject({ name: 'Mary Parker', role: 'deceased' });
  });

  it('handles a bare name with no parentheses', () => {
    const out = parseRelatives('King Snake (father), Unknown Person');
    expect(out[1]).toMatchObject({ name: 'Unknown Person', alias: null, role: '' });
  });

  it('does not crash on a large ancestor list', () => {
    const raw = Array.from({ length: 30 }, (_, i) => `Forebear${i} (ancestor)`).join(', ');
    expect(parseRelatives(raw)).toHaveLength(30);
  });

  it('assigns increasing positions', () => {
    const out = parseRelatives('A (son), B (daughter)');
    expect(out.map((m) => m.position)).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `yarn jest parseRelatives`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `parseRelatives`**

```ts
// src/lib/family/parseRelatives.ts
import type { ParsedRelative } from './types';

const JUNK = new Set(['', '-', 'null', 'n/a', 'none', 'unknown']);

/** Split on top-level commas/semicolons, ignoring delimiters inside parentheses. */
function splitTopLevel(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of raw) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function parseRelatives(raw: string | null | undefined): ParsedRelative[] {
  if (!raw) return [];
  const result: ParsedRelative[] = [];
  let position = 0;
  for (const entry of splitTopLevel(raw)) {
    const trimmed = entry.trim();
    if (JUNK.has(trimmed.toLowerCase())) continue;

    const open = trimmed.indexOf('(');
    let name = trimmed;
    let alias: string | null = null;
    let role = '';

    if (open !== -1) {
      name = trimmed.slice(0, open).trim();
      const close = trimmed.lastIndexOf(')');
      const inner = (close > open ? trimmed.slice(open + 1, close) : trimmed.slice(open + 1)).trim();
      const parts = inner.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1) {
        role = parts[0];
      } else if (parts.length > 1) {
        role = parts[parts.length - 1];
        alias = parts.slice(0, -1).join(', ');
      }
    }

    if (name === '' || JUNK.has(name.toLowerCase())) continue;
    result.push({ name, alias, role, position: position++ });
  }
  return result;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `yarn jest parseRelatives`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/family/parseRelatives.ts __tests__/lib/family/parseRelatives.test.ts
git commit -m "feat(family): parseRelatives free-text parser"
```

---

## Task 5: `buildTiers` (TDD)

**Files:**
- Create: `src/lib/family/buildTiers.ts`
- Test: `__tests__/lib/family/buildTiers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/family/buildTiers.test.ts
import { buildTiers } from '../../../src/lib/family/buildTiers';
import type { FamilyMember } from '../../../src/lib/family/types';

function member(p: Partial<FamilyMember>): FamilyMember {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'X', alias: null, role: 'role', relation: 'other', tier: 0,
    modifiers: [], status: null, position: 0,
    heroId: null, heroImage: null, heroPower: null, heroAlignment: null,
    ...p,
  };
}

describe('buildTiers', () => {
  it('orders tiers from +2 down to -2 and omits empty tiers', () => {
    const model = buildTiers([
      member({ relation: 'child', tier: -1 }),
      member({ relation: 'grandparent', tier: 2 }),
      member({ relation: 'parent', tier: 1 }),
    ]);
    expect(model.tiers.map((t) => t.tier)).toEqual([2, 1, -1]);
  });

  it('moves clones into asides, not tiers', () => {
    const model = buildTiers([member({ relation: 'clone', tier: 9 })]);
    expect(model.tiers).toHaveLength(0);
    expect(model.asides).toHaveLength(1);
  });

  it('moves non-family others into footnotes', () => {
    const model = buildTiers([member({ relation: 'other', role: 'fiancée', tier: 0 })]);
    expect(model.footnotes).toHaveLength(1);
    expect(model.tiers).toHaveLength(0);
  });

  it('keeps generic others in their tier', () => {
    const model = buildTiers([member({ relation: 'other', role: 'legal ward', tier: 0 })]);
    expect(model.tiers).toHaveLength(1);
    expect(model.footnotes).toHaveLength(0);
  });

  it('sorts members within a tier by position', () => {
    const model = buildTiers([
      member({ relation: 'parent', tier: 1, position: 2, name: 'B' }),
      member({ relation: 'parent', tier: 1, position: 0, name: 'A' }),
    ]);
    expect(model.tiers[0].members.map((m) => m.name)).toEqual(['A', 'B']);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `yarn jest buildTiers`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `buildTiers`**

```ts
// src/lib/family/buildTiers.ts
import type { FamilyMember, FamilyModel, FamilyTier } from './types';

const TIER_LABELS: Record<number, string> = {
  2: 'Grandparents · Ancestors',
  1: 'Parents · Aunts & Uncles',
  0: 'Same generation',
  [-1]: 'Children',
  [-2]: 'Grandchildren',
};

const NONFAMILY = /girlfriend|boyfriend|fianc|partner|lover|paramour/i;

export function buildTiers(members: FamilyMember[]): FamilyModel {
  const asides: FamilyMember[] = [];
  const footnotes: FamilyMember[] = [];
  const byTier = new Map<number, FamilyMember[]>();

  for (const m of members) {
    if (m.tier === 9 || m.relation === 'clone') {
      asides.push(m);
    } else if (m.relation === 'other' && NONFAMILY.test(m.role)) {
      footnotes.push(m);
    } else {
      const list = byTier.get(m.tier) ?? [];
      list.push(m);
      byTier.set(m.tier, list);
    }
  }

  const tiers: FamilyTier[] = [];
  for (const t of [2, 1, 0, -1, -2]) {
    const list = byTier.get(t);
    if (list && list.length) {
      list.sort((a, b) => a.position - b.position);
      tiers.push({ tier: t, label: TIER_LABELS[t], members: list });
    }
  }

  return { tiers, asides, footnotes };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `yarn jest buildTiers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/family/buildTiers.ts __tests__/lib/family/buildTiers.test.ts
git commit -m "feat(family): buildTiers groups members into tiers"
```

---

## Task 6: `rowToMember` mapper (TDD)

**Files:**
- Create: `src/lib/family/rowToMember.ts`
- Test: `__tests__/lib/family/rowToMember.test.ts`

This isolates the PostgREST-row → `FamilyMember` mapping so it can be tested without the network.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/family/rowToMember.test.ts
import { rowToMember, type FamilyRow } from '../../../src/lib/family/rowToMember';

const base: FamilyRow = {
  id: 'r1', name: 'Supergirl', alias: 'Kara Zor-El', role: 'cousin',
  relation: 'cousin', tier: 0, modifiers: [], status: null, position: 3,
  related: { id: 'h9', image_md_url: 'md.jpg', image_url: 'full.jpg', power: 68, alignment: 'good' },
};

describe('rowToMember', () => {
  it('flattens a linked row, preferring image_md_url', () => {
    expect(rowToMember(base)).toMatchObject({
      id: 'r1', name: 'Supergirl', heroId: 'h9', heroImage: 'md.jpg', heroPower: 68, heroAlignment: 'good',
    });
  });

  it('falls back to image_url when md is missing', () => {
    const m = rowToMember({ ...base, related: { ...base.related!, image_md_url: null } });
    expect(m.heroImage).toBe('full.jpg');
  });

  it('nulls all linked fields when there is no related hero', () => {
    const m = rowToMember({ ...base, related: null });
    expect(m).toMatchObject({ heroId: null, heroImage: null, heroPower: null, heroAlignment: null });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `yarn jest rowToMember`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rowToMember`**

```ts
// src/lib/family/rowToMember.ts
import type { FamilyMember, RelationKind, RelativeStatus } from './types';

export interface FamilyRow {
  id: string;
  name: string;
  alias: string | null;
  role: string;
  relation: RelationKind;
  tier: number;
  modifiers: string[] | null;
  status: RelativeStatus;
  position: number;
  related: {
    id: string;
    image_md_url: string | null;
    image_url: string | null;
    power: number | null;
    alignment: string | null;
  } | null;
}

export function rowToMember(row: FamilyRow): FamilyMember {
  return {
    id: row.id,
    name: row.name,
    alias: row.alias,
    role: row.role,
    relation: row.relation,
    tier: row.tier,
    modifiers: row.modifiers ?? [],
    status: row.status,
    position: row.position,
    heroId: row.related?.id ?? null,
    heroImage: row.related ? row.related.image_md_url ?? row.related.image_url ?? null : null,
    heroPower: row.related?.power ?? null,
    heroAlignment: row.related?.alignment ?? null,
  };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `yarn jest rowToMember`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/family/rowToMember.ts __tests__/lib/family/rowToMember.test.ts
git commit -m "feat(family): rowToMember PostgREST row mapper"
```

---

## Task 7: `getHeroFamily` query

**Files:**
- Modify: `src/lib/db/heroes.ts`

- [ ] **Step 1: Add the query function**

Append to `src/lib/db/heroes.ts` (it already imports `supabase`):

```ts
import { rowToMember, type FamilyRow } from '../family/rowToMember';
import type { FamilyMember } from '../family/types';

/**
 * Family members for a hero, ordered top generation → bottom, then source order.
 * Linked relatives (those with their own page) come back enriched with the
 * related hero's portrait, power, and alignment via the FK embed.
 */
export async function getHeroFamily(heroId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('hero_relatives')
    .select(
      'id, name, alias, role, relation, tier, modifiers, status, position, ' +
        'related:related_hero_id ( id, image_md_url, image_url, power, alignment )',
    )
    .eq('hero_id', heroId)
    .order('tier', { ascending: false })
    .order('position', { ascending: true });

  if (error) {
    console.error('getHeroFamily failed', error);
    return [];
  }
  return (data ?? []).map((row) => rowToMember(row as unknown as FamilyRow));
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/heroes.ts
git commit -m "feat(family): getHeroFamily enriched query"
```

---

## Task 8: Shared Deno copy of parse+classify (with parity test)

**Files:**
- Create: `supabase/functions/_shared/family.ts`
- Test: `__tests__/lib/family/parity.test.ts`

The edge function (Deno) cannot reliably import from `src/`, so it gets a self-contained copy. A jest parity test runs both implementations over the same fixtures to catch drift.

- [ ] **Step 1: Create the Deno copy**

`supabase/functions/_shared/family.ts` — paste the **exact bodies** of `RelationKind`/`Classification`/`ParsedRelative` types (from Task 2), `classifyRole` (Task 3), and `parseRelatives` (Task 4) into one file with no external imports. Re-export `parseRelatives`, `classifyRole`, and the types. (No `serve`, no Supabase import — pure logic only.)

- [ ] **Step 2: Write the parity test**

```ts
// __tests__/lib/family/parity.test.ts
import { parseRelatives as srcParse } from '../../../src/lib/family/parseRelatives';
import { classifyRole as srcClassify } from '../../../src/lib/family/classifyRole';
import {
  parseRelatives as shParse,
  classifyRole as shClassify,
} from '../../../supabase/functions/_shared/family';

const FIXTURES = [
  'Bruce Wayne (biological father), Warren McGinnis (father, deceased), Mary McGinnis (mother), Matt McGinnis (brother)',
  'Lois Lane (wife), Jor-El (father, deceased), Supergirl (Kara Zor-El, cousin), Superboy (Kon-El/Conner Kent, partial clone)',
  'Jarvis Pennyworth (father, deceased); Bruce Wayne (Batman, legal ward)',
  'King Snake (father)',
  'Duela Dent (Daughter), Gilda Dent (Wife), Poison Ivy (Fiancée)',
];

describe('src vs _shared parity', () => {
  it.each(FIXTURES)('parseRelatives matches for: %s', (raw) => {
    expect(shParse(raw)).toEqual(srcParse(raw));
  });

  it.each(['father', 'adoptive mother', 'grandson', 'ex-wife', 'partial clone', 'fiancée'])(
    'classifyRole matches for: %s',
    (role) => {
      expect(shClassify(role)).toEqual(srcClassify(role));
    },
  );
});
```

- [ ] **Step 3: Run the parity test, verify it passes**

Run: `yarn jest parity`
Expected: PASS. (If it fails, the copy drifted — fix `_shared/family.ts` to match `src/`.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/family.ts __tests__/lib/family/parity.test.ts
git commit -m "feat(family): shared Deno parse/classify copy + parity test"
```

---

## Task 9: `backfill-family` edge function

**Files:**
- Create: `supabase/functions/backfill-family/index.ts`

Model after `supabase/functions/backfill-enemies/index.ts` (same CORS/json/sleep helpers, same chunked roster resolution, same resumable batch shape).

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/backfill-family/index.ts
// Resumable batch backfill for the `hero_relatives` table.
// Parses heroes.relatives → classifies tier/relation → resolves each member's
// name/alias against our roster → writes normalized rows (delete+insert per hero).
//
// Modes (POST body):
//   {}                 → only heroes with NO hero_relatives rows yet (additive)
//   { refresh: true }  → rebuild regardless
//   { limit }          → batch size (1–100, default 60)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseRelatives, classifyRole } from '../_shared/family.ts';

type SB = ReturnType<typeof createClient>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

// Resolve candidate names → { lowercased name → hero id } via chunked .in() lookups.
async function resolveRoster(supabase: SB, candidates: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(candidates.filter(Boolean)));
  for (let i = 0; i < unique.length; i += 140) {
    const { data } = await supabase
      .from('heroes')
      .select('id, name')
      .in('name', unique.slice(i, i + 140));
    for (const h of (data ?? []) as { id: string; name: string }[]) {
      map.set(h.name.toLowerCase(), h.id);
    }
  }
  return map;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: number; refresh?: boolean };
    const limit = Math.min(Math.max(Number(body.limit) || 60, 1), 100);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Candidate heroes: have a relatives string, popularity-ordered.
    const { data: heroData, error } = await supabase
      .from('heroes')
      .select('id, name, relatives')
      .not('relatives', 'is', null)
      .neq('relatives', '')
      .neq('relatives', '-')
      .order('issue_count', { ascending: false, nullsFirst: false })
      .limit(body.refresh ? limit : 500);
    if (error) return json({ error: error.message }, 500);

    let heroes = (heroData ?? []) as { id: string; name: string; relatives: string }[];

    // Additive mode: skip heroes that already have rows.
    if (!body.refresh) {
      const ids = heroes.map((h) => h.id);
      const done = new Set<string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase
          .from('hero_relatives')
          .select('hero_id')
          .in('hero_id', ids.slice(i, i + 200));
        for (const r of (data ?? []) as { hero_id: string }[]) done.add(r.hero_id);
      }
      heroes = heroes.filter((h) => !done.has(h.id)).slice(0, limit);
    }

    let updated = 0;
    let rowsWritten = 0;

    for (const h of heroes) {
      const parsed = parseRelatives(h.relatives);
      if (parsed.length === 0) {
        await supabase.from('hero_relatives').delete().eq('hero_id', h.id);
        continue;
      }
      const roster = await resolveRoster(
        supabase,
        parsed.flatMap((p) => [p.name, ...(p.alias ? [p.alias] : [])]),
      );
      const rows = parsed.map((p) => {
        const c = classifyRole(p.role);
        const linked =
          roster.get(p.name.toLowerCase()) ??
          (p.alias ? roster.get(p.alias.toLowerCase()) : undefined) ??
          null;
        return {
          hero_id: h.id,
          name: p.name,
          alias: p.alias,
          role: p.role,
          relation: c.relation,
          tier: c.tier,
          modifiers: c.modifiers,
          status: c.status,
          related_hero_id: linked,
          position: p.position,
        };
      });
      await supabase.from('hero_relatives').delete().eq('hero_id', h.id);
      const { error: insErr } = await supabase.from('hero_relatives').insert(rows);
      if (insErr) return json({ error: insErr.message, hero: h.name }, 500);
      updated++;
      rowsWritten += rows.length;
    }

    return json({ updated, rowsWritten, remaining: heroes.length === limit });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 2: Deploy the function**

Call `mcp__supabase__deploy_edge_function` with name `backfill-family` and the two files
(`supabase/functions/backfill-family/index.ts` and `supabase/functions/_shared/family.ts`).
Expected: deploy succeeds; `mcp__supabase__list_edge_functions` shows `backfill-family`.

- [ ] **Step 3: Dry-run on the most popular heroes**

Invoke the function once with `{ "limit": 5, "refresh": true }` (via the project's standard
function-invoke path / curl with the anon key). Then verify with `mcp__supabase__execute_sql`:

```sql
select h.name, count(*) as members, count(hr.related_hero_id) as linked
from heroes h join hero_relatives hr on hr.hero_id = h.id
group by h.name order by members desc limit 5;
```
Expected: rows for Superman/Batman/etc. with sensible member counts and some `linked > 0`.

- [ ] **Step 4: Spot-check classification quality**

```sql
select name, role, relation, tier, status, related_hero_id is not null as linked
from hero_relatives
where hero_id = (select id from heroes where name = 'Superman')
order by tier desc, position;
```
Expected: Jor-El/Lara → parent/+1/deceased; Supergirl → cousin/0/linked; Superboy → clone/9.
If any look wrong, fix `_shared/family.ts` (+ mirror in `src/`, re-run parity test), redeploy, re-run.

- [ ] **Step 5: Full backfill in batches**

Invoke `{}` (additive) repeatedly until the response reports `updated: 0`. Each call processes
up to 60 new heroes.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/backfill-family
git commit -m "feat(family): backfill-family edge function"
```

---

## Task 10: Web `FamilyTree` component + page wiring

**Files:**
- Create: `src/components/family/FamilyTree.web.tsx`
- Modify: `app/character/[id].web.tsx`

Per CLAUDE.md, screen rendering is not unit-tested — this task is verified by typecheck + the dev server.

- [ ] **Step 1: Build the web component**

Create `src/components/family/FamilyTree.web.tsx`. It accepts `{ heroName: string; members: FamilyMember[] }`, calls `buildTiers`, and renders the approved design: a card titled `FAMILY` with a count line, tiers stacked top→bottom with a connecting spine, the hero anchor injected at tier 0 with the spouse tied beside it, linked nodes as tappable portrait cards (`expo-router` `Link`/`router.push('/character/' + heroId)`), plain nodes as text (deceased dimmed + ✝), large tiers collapsed behind a "+N more" toggle (local `useState`), clones rendered as a small "Variants" aside, and `footnotes` as a quiet line. Use `StyleSheet.create`, `COLORS` from `src/constants/colors.ts`, and the fonts/aesthetic from the approved mockup (`.superpowers/brainstorm/.../card.html` as the visual reference). Match the existing card styles in `app/character/[id].web.tsx` (`styles.card`, `cardTitle`, `cardDivider`). Render `null` when `members.length === 0`.

  Spouse extraction: from the tier-0 members, pull the first `relation === 'spouse'`; render it beside the hero anchor with an orange connector; render the remaining tier-0 members (siblings, cousins, others) in the row below the anchor.

- [ ] **Step 2: Fetch family on the page**

In `app/character/[id].web.tsx`, near the existing `getHeroById(id)` effect (around line 188),
add state and a fetch:

```tsx
import { getHeroById, getHeroFamily, heroRowToCharacterData } from '../../src/lib/db/heroes';
import type { FamilyMember } from '../../src/lib/family/types';
import { FamilyTree } from '../../src/components/family/FamilyTree.web';

const [family, setFamily] = useState<FamilyMember[]>([]);
// inside the effect that loads the hero by id:
getHeroFamily(id).then(setFamily).catch(() => setFamily([]));
```

- [ ] **Step 3: Render the card in the main column**

In the `mainCol` block, after `<WebAbilitiesCard … />` (around line 677–682), add:

```tsx
<FamilyTree heroName={stats.name} members={family} />
```

- [ ] **Step 4: Remove the Quick Facts "Relatives" row**

Delete the line at `app/character/[id].web.tsx:935`:

```tsx
<InfoRow label="Relatives" value={stats.connections.relatives} />
```

(and the equivalent mobile-web one near line 1278, so the family data lives only in the new card).

- [ ] **Step 5: Typecheck**

Run: `yarn tsc --noEmit`
Expected: passes.

- [ ] **Step 6: Visual verification**

Run the web app (`yarn start`, open web) and load `/character/644` (Superman) and `/character/566` (Aquaman, the 30+ ancestors case). Confirm: tiers render top→bottom, spouse tied beside the anchor, linked relatives show portraits and navigate on tap, Aquaman's ancestors collapse behind "+N more", and the old Quick Facts "Relatives" row is gone.

- [ ] **Step 7: Commit**

```bash
git add src/components/family/FamilyTree.web.tsx 'app/character/[id].web.tsx'
git commit -m "feat(family): web family tree card on character page"
```

---

## Task 11: Native `FamilyTree` component + dossier wiring

**Files:**
- Create: `src/components/family/FamilyTree.tsx`
- Modify: `app/character/[id].tsx`

- [ ] **Step 1: Build the native component**

Create `src/components/family/FamilyTree.tsx` with the same `{ heroName, members }` props and
the same `buildTiers` model. Native layout: tiers stacked vertically; each tier label + a row of
nodes that **horizontally scrolls** (`ScrollView horizontal`) when it overflows, so wide tiers
work on phones. Linked nodes use `expo-router` `router.push('/character/' + heroId)` and show
the portrait via `expo-image`; plain nodes are text; deceased dimmed + ✝; "+N more" expands a
tier; clones in a "Variants" aside; footnotes as a quiet line. `StyleSheet.create`, `COLORS`,
project fonts. Render `null` when empty.

- [ ] **Step 2: Fetch family on the native screen**

In `app/character/[id].tsx`, where the hero data is loaded, add:

```tsx
import { getHeroFamily } from '../../src/lib/db/heroes';
import type { FamilyMember } from '../../src/lib/family/types';
import { FamilyTree } from '../../src/components/family/FamilyTree';

const [family, setFamily] = useState<FamilyMember[]>([]);
// in the load effect:
getHeroFamily(id).then(setFamily).catch(() => setFamily([]));
```

- [ ] **Step 3: Render and remove the old list**

Render `<FamilyTree heroName={data.stats.name} members={family} />` in the screen body (a sensible
spot is right after the dossier/connections section). Then remove the `RelativesList` usage at
`app/character/[id].tsx:389` and delete the now-unused `RelativesList` component
(`app/character/[id].tsx:200-222`) and any `connections.relatives` reference left dangling in the
`hasConnections` checks (keep `hasConnections` correct for the remaining fields).

- [ ] **Step 4: Typecheck**

Run: `yarn tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/family/FamilyTree.tsx 'app/character/[id].tsx'
git commit -m "feat(family): native family tree on character screen"
```

---

## Task 12: Family card skeleton (web)

**Files:**
- Modify: `app/character/[id].web.tsx` (the `CharacterSkeleton` component, ~line 1375+)

- [ ] **Step 1: Add a skeleton block matching the Family card**

In `CharacterSkeleton`, after the abilities skeleton card (around the `abilitiesCard` definition,
~line 1421), add a `familyCard` skeleton: a card with a title bar, divider, and 2–3 tier rows of
pill/avatar placeholders (reuse the existing `SkeletonBlock` + `sk.card` + `divider` patterns).
Insert it into the `mainCol` render list right after `{abilitiesCard}` so the skeleton→content
swap is seamless. Keep it concise — a couple of rows of `SkeletonBlock` chips is enough.

- [ ] **Step 2: Typecheck + visual check**

Run: `yarn tsc --noEmit` (expected: passes). Reload a character page and confirm the loading
state shows a Family-shaped placeholder where the card lands.

- [ ] **Step 3: Commit**

```bash
git add 'app/character/[id].web.tsx'
git commit -m "feat(family): family card skeleton"
```

---

## Task 13: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `yarn test:ci`
Expected: all pass (new `__tests__/lib/family/*` included).

- [ ] **Step 2: Typecheck the project**

Run: `yarn tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Data sanity in the DB**

```sql
select
  (select count(*) from hero_relatives) as total_rows,
  (select count(distinct hero_id) from hero_relatives) as heroes_covered,
  (select count(*) from hero_relatives where related_hero_id is not null) as linked_rows,
  (select count(*) from hero_relatives where relation = 'other') as unclassified;
```
Expected: thousands of rows, many heroes covered, a meaningful `linked_rows` count, and `other`
a small fraction of the total (sanity on the classifier).

- [ ] **Step 4: Manual spot-check across edge cases**

Load Superman (rich), Aquaman (overflow), Deadpool (semicolons), Two-Face (non-family footnote),
and a hero with no relatives (card hidden). Confirm each renders correctly on web and native.

---

## Self-Review Notes

- **Spec coverage:** schema (Task 1), parser/classifier in `src/` + Deno copy (Tasks 2–4, 8),
  `getHeroFamily` enrichment join (Tasks 6–7), backfill (Task 9), tier model (Task 5), web +
  native cards with linking/overflow/footnotes (Tasks 10–11), skeleton (Task 12), testing
  (Tasks 3–8, 13). All spec sections map to a task.
- **Open items from spec §10** are resolved here: columns confirmed (`image_md_url`/`image_url`,
  `power`, `alignment`); FK embed chosen over RPC (Task 7); Deno-copy + parity test chosen over
  cross-boundary import (Task 8).
- **Type consistency:** `FamilyMember`/`FamilyRow`/`Classification`/`ParsedRelative`/`FamilyModel`
  are defined once (Tasks 2, 6) and reused verbatim downstream.
```
