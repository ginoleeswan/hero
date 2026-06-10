# Family Tree Kinship Graph + Connector Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the family tree with a deterministic inter-relative kinship graph (so grandparents nest under the correct parent) and a real SVG connector tree (trunk + branch bars + forks) with avatar-bearing nodes.

**Architecture:** Two derived columns (`tree_parent_id`, `branch_side`) are added to `hero_relatives` and filled by a pure `resolveKinship` resolver inside the existing `backfill-family` job. A pure `buildFamilyGraph` turns the enriched rows into an ordered tier/parent-link model; a pure `connectorPaths` turns measured node positions into SVG polylines; the web/native `FamilyTree` components measure nodes and draw a `react-native-svg` overlay. Hard logic stays pure and jest-tested; platform files stay thin.

**Tech Stack:** Expo Router 4, React Native (+ react-native-web), TypeScript, Supabase (Postgres + Deno edge functions), `react-native-svg` 15.15.4 (already installed), jest-expo, yarn.

**Spec:** `docs/superpowers/specs/2026-06-10-family-tree-kinship-graph-design.md`

**Working branch:** `master` (this repo commits directly to master — no feature branches).

**Baseline note:** `yarn tsc --noEmit` has a PRE-EXISTING noisy baseline (errors about `splash` in app.config.ts and `StyleSheet.absoluteFillObject`). These are NOT yours. Your bar: introduce no NEW errors referencing your files. Check with `yarn tsc --noEmit 2>&1 | grep -E '<your-file>'`.

---

## File Structure

**Create:**
- `src/lib/family/resolveKinship.ts` — pure resolver: nodes → `{ treeParentId, branchSide }` per node.
- `src/lib/family/buildFamilyGraph.ts` — pure layout model (replaces `buildTiers.ts`).
- `src/lib/family/connectorPaths.ts` — pure geometry: measured boxes + graph → SVG polylines.
- `src/components/family/FamilyNode.web.tsx` / `FamilyNode.tsx` — the avatar node (linked/plain/hero), optional split (may inline).
- Tests: `__tests__/lib/family/{resolveKinship,buildFamilyGraph,connectorPaths}.test.ts`.

**Modify:**
- `src/lib/family/types.ts` — add `treeParentId`/`branchSide` to `FamilyMember`; add `BranchSide`, graph-model types.
- `src/lib/family/rowToMember.ts` — map the two new columns.
- `src/lib/db/heroes.ts` — `getHeroFamily` selects the two new columns.
- `supabase/functions/_shared/family.ts` — add the `resolveKinship` copy.
- `supabase/functions/backfill-family/index.ts` — generate row ids, call resolver, write new columns.
- `src/components/family/FamilyTree.web.tsx` / `FamilyTree.tsx` — rewrite to measure nodes + draw connector overlay.
- `app/character/[id].web.tsx` — family card skeleton tweak (optional, Task 10).
- `src/types/database.generated.ts` — regenerated after migration.

**Delete:**
- `src/lib/family/buildTiers.ts` + `__tests__/lib/family/buildTiers.test.ts` (superseded by `buildFamilyGraph`).

---

## Task 1: DB migration — kinship columns

**Files:** migration via Supabase MCP; regenerate `src/types/database.generated.ts`.

- [ ] **Step 1: Apply the migration**

Call `mcp__supabase__apply_migration`, name `hero_relatives_kinship_columns`:

```sql
alter table hero_relatives
  add column tree_parent_id uuid references hero_relatives(id) on delete set null,
  add column branch_side text;
create index hero_relatives_tree_parent_id_idx on hero_relatives (tree_parent_id);
```

- [ ] **Step 2: Verify**

Call `mcp__supabase__list_tables` (schema `public`). Expected: `hero_relatives` now has `tree_parent_id` (uuid, nullable) and `branch_side` (text, nullable).

- [ ] **Step 3: Regenerate types**

Call `mcp__supabase__generate_typescript_types`; overwrite `src/types/database.generated.ts` with the result.

- [ ] **Step 4: Save the migration file + commit**

Write the same SQL to `supabase/migrations/20260610140000_hero_relatives_kinship_columns.sql`, then:

```bash
git add supabase/migrations/20260610140000_hero_relatives_kinship_columns.sql src/types/database.generated.ts
git commit -m "feat(family): add kinship columns to hero_relatives"
```

---

## Task 2: resolveKinship (pure, TDD)

**Files:**
- Create: `src/lib/family/resolveKinship.ts`
- Test: `__tests__/lib/family/resolveKinship.test.ts`

The resolver works on lightweight nodes (the backfill supplies real ids; tests supply synthetic ones). It returns a map of node id → attachment. **Resolve only when unambiguous.**

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/family/resolveKinship.test.ts
import { resolveKinship, type KinNode } from '../../../src/lib/family/resolveKinship';

const n = (p: Partial<KinNode> & { id: string; relation: KinNode['relation'] }): KinNode => ({
  role: '', modifiers: [], ...p,
});

describe('resolveKinship', () => {
  it('attaches a paternal grandparent to the single father', () => {
    const nodes = [
      n({ id: 'f', relation: 'parent', role: 'father' }),
      n({ id: 'm', relation: 'parent', role: 'mother' }),
      n({ id: 'gf', relation: 'grandparent', role: 'paternal grandfather' }),
    ];
    const r = resolveKinship(nodes);
    expect(r.get('gf')).toEqual({ treeParentId: 'f', branchSide: 'paternal' });
  });

  it('attaches a maternal grandparent to the single mother', () => {
    const nodes = [
      n({ id: 'm', relation: 'parent', role: 'mother' }),
      n({ id: 'gm', relation: 'grandparent', role: 'maternal grandmother' }),
    ];
    expect(resolveKinship(nodes).get('gm')).toEqual({ treeParentId: 'm', branchSide: 'maternal' });
  });

  it('leaves a side-less grandparent unattached', () => {
    const nodes = [
      n({ id: 'f', relation: 'parent', role: 'father' }),
      n({ id: 'm', relation: 'parent', role: 'mother' }),
      n({ id: 'g', relation: 'grandparent', role: 'grandfather' }),
    ];
    expect(resolveKinship(nodes).get('g')).toEqual({ treeParentId: null, branchSide: null });
  });

  it('does not attach a paternal grandparent when there are two fathers', () => {
    const nodes = [
      n({ id: 'f1', relation: 'parent', role: 'father' }),
      n({ id: 'f2', relation: 'parent', role: 'adoptive father', modifiers: ['adoptive'] }),
      n({ id: 'gf', relation: 'grandparent', role: 'paternal grandfather' }),
    ];
    expect(resolveKinship(nodes).get('gf')).toEqual({ treeParentId: null, branchSide: 'paternal' });
  });

  it('attaches a cousin to the single aunt/uncle', () => {
    const nodes = [
      n({ id: 'u', relation: 'aunt_uncle', role: 'uncle' }),
      n({ id: 'c', relation: 'cousin', role: 'cousin' }),
    ];
    expect(resolveKinship(nodes).get('c')).toEqual({ treeParentId: 'u', branchSide: null });
  });

  it('attaches an in-law to the single spouse', () => {
    const nodes = [
      n({ id: 's', relation: 'spouse', role: 'wife' }),
      n({ id: 'il', relation: 'in_law', role: 'father-in-law' }),
    ];
    expect(resolveKinship(nodes).get('il')).toEqual({ treeParentId: 's', branchSide: 'spouse' });
  });

  it('attaches a grandchild to the single child', () => {
    const nodes = [
      n({ id: 'ch', relation: 'child', role: 'son' }),
      n({ id: 'gc', relation: 'grandchild', role: 'grandson' }),
    ];
    expect(resolveKinship(nodes).get('gc')).toEqual({ treeParentId: 'ch', branchSide: null });
  });

  it('tags parents with a branch side but no parent link', () => {
    const nodes = [n({ id: 'f', relation: 'parent', role: 'father' })];
    expect(resolveKinship(nodes).get('f')).toEqual({ treeParentId: null, branchSide: 'paternal' });
  });

  it('leaves plain same-generation members unattached', () => {
    const nodes = [n({ id: 'b', relation: 'sibling', role: 'brother' })];
    expect(resolveKinship(nodes).get('b')).toEqual({ treeParentId: null, branchSide: null });
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `yarn jest resolveKinship`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/family/resolveKinship.ts
import type { FamilyRelation } from './types';

export type BranchSide = 'paternal' | 'maternal' | 'spouse' | null;

export interface KinNode {
  id: string;
  relation: FamilyRelation;
  role: string;        // lowercased-compatible; paternal/maternal/father/mother hints
  modifiers: string[];
}

export interface KinAttachment {
  treeParentId: string | null;
  branchSide: BranchSide;
}

const isFather = (r: string) => /\bfather\b|\bdad\b/.test(r) && !/in[- ]law/.test(r);
const isMother = (r: string) => /\bmother\b|\bmom\b/.test(r) && !/in[- ]law/.test(r);

/** The one node matching a predicate, or null if zero or more than one. */
function uniqueBy(nodes: KinNode[], pred: (n: KinNode) => boolean): KinNode | null {
  const hits = nodes.filter(pred);
  return hits.length === 1 ? hits[0] : null;
}

export function resolveKinship(nodes: KinNode[]): Map<string, KinAttachment> {
  const out = new Map<string, KinAttachment>();
  const father = uniqueBy(nodes, (x) => x.relation === 'parent' && isFather(x.role.toLowerCase()));
  const mother = uniqueBy(nodes, (x) => x.relation === 'parent' && isMother(x.role.toLowerCase()));
  const spouse = uniqueBy(nodes, (x) => x.relation === 'spouse');
  const auntUncle = uniqueBy(nodes, (x) => x.relation === 'aunt_uncle');
  const sibling = uniqueBy(nodes, (x) => x.relation === 'sibling');
  const child = uniqueBy(nodes, (x) => x.relation === 'child');

  for (const node of nodes) {
    const r = node.role.toLowerCase();
    const paternal = /paternal/.test(r);
    const maternal = /maternal/.test(r);
    let treeParentId: string | null = null;
    let branchSide: BranchSide = null;

    switch (node.relation) {
      case 'grandparent':
      case 'ancestor': {
        if (paternal) {
          branchSide = 'paternal';
          if (father) treeParentId = father.id;
        } else if (maternal) {
          branchSide = 'maternal';
          if (mother) treeParentId = mother.id;
        }
        break;
      }
      case 'grandchild': {
        if (child) treeParentId = child.id;
        break;
      }
      case 'cousin': {
        if (auntUncle) treeParentId = auntUncle.id;
        break;
      }
      case 'niece_nephew': {
        if (sibling) treeParentId = sibling.id;
        break;
      }
      case 'in_law': {
        branchSide = 'spouse';
        if (spouse) treeParentId = spouse.id;
        break;
      }
      case 'parent': {
        if (isFather(r)) branchSide = 'paternal';
        else if (isMother(r)) branchSide = 'maternal';
        break;
      }
      default:
        break;
    }
    out.set(node.id, { treeParentId, branchSide });
  }
  return out;
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `yarn jest resolveKinship`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/family/resolveKinship.ts __tests__/lib/family/resolveKinship.test.ts
git commit -m "feat(family): resolveKinship deterministic attachment resolver"
```

---

## Task 3: types + rowToMember + getHeroFamily

**Files:**
- Modify: `src/lib/family/types.ts`, `src/lib/family/rowToMember.ts`, `src/lib/db/heroes.ts`
- Test: `__tests__/lib/family/rowToMember.test.ts` (extend)

- [ ] **Step 1: Add fields to `FamilyMember` (types.ts)**

In `src/lib/family/types.ts`, import/define `BranchSide` and add two fields to `FamilyMember`:

```ts
import type { BranchSide } from './resolveKinship';

// …inside FamilyMember, after heroAlignment:
  treeParentId: string | null;
  branchSide: BranchSide;
```

- [ ] **Step 2: Extend the rowToMember test**

In `__tests__/lib/family/rowToMember.test.ts`, extend the `base` fixture and assertions:

```ts
// add to the `base` object:
  tree_parent_id: 'p1',
  branch_side: 'paternal',
// add a new test:
it('maps the kinship columns', () => {
  expect(rowToMember(base)).toMatchObject({ treeParentId: 'p1', branchSide: 'paternal' });
});
it('defaults kinship columns to null', () => {
  const m = rowToMember({ ...base, tree_parent_id: null, branch_side: null });
  expect(m).toMatchObject({ treeParentId: null, branchSide: null });
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `yarn jest rowToMember`
Expected: FAIL — `tree_parent_id` not on `FamilyRow` / fields missing.

- [ ] **Step 4: Update `FamilyRow` + `rowToMember`**

In `src/lib/family/rowToMember.ts`, add to `FamilyRow`:

```ts
  tree_parent_id: string | null;
  branch_side: import('./resolveKinship').BranchSide;
```

and to the returned object in `rowToMember`:

```ts
    treeParentId: row.tree_parent_id,
    branchSide: row.branch_side,
```

- [ ] **Step 5: Update `getHeroFamily` select (heroes.ts)**

In `src/lib/db/heroes.ts`, add `tree_parent_id, branch_side` to the `.select(...)` column list (before the `related:` embed):

```ts
    .select(
      'id, name, alias, role, relation, tier, modifiers, status, position, ' +
        'tree_parent_id, branch_side, ' +
        'related:related_hero_id ( id, image_md_url, image_url, power, alignment )',
    )
```

- [ ] **Step 6: Run tests + typecheck**

Run: `yarn jest rowToMember` → PASS.
Run: `yarn tsc --noEmit 2>&1 | grep -E 'src/lib/family|lib/db/heroes'` → empty.

- [ ] **Step 7: Commit**

```bash
git add src/lib/family/types.ts src/lib/family/rowToMember.ts src/lib/db/heroes.ts __tests__/lib/family/rowToMember.test.ts
git commit -m "feat(family): thread kinship columns through types and query"
```

---

## Task 4: buildFamilyGraph (pure, TDD) — replaces buildTiers

**Files:**
- Create: `src/lib/family/buildFamilyGraph.ts`
- Test: `__tests__/lib/family/buildFamilyGraph.test.ts`
- Delete: `src/lib/family/buildTiers.ts`, `__tests__/lib/family/buildTiers.test.ts`

- [ ] **Step 1: Add graph-model types to types.ts**

```ts
// in src/lib/family/types.ts
export type ConnTarget = { kind: 'hero' } | { kind: 'parent'; id: string };

export interface GraphNode {
  member: FamilyMember;
  connectTo: ConnTarget;
}

export interface GraphTier {
  tier: number;
  label: string;
  nodes: GraphNode[];
  collapsedByDefault: boolean;
}

export interface FamilyGraph {
  tiers: GraphTier[];        // ordered 2 → -2; empty omitted
  asides: FamilyMember[];    // clones
  footnotes: FamilyMember[]; // non-family
  spouse: FamilyMember | null;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// __tests__/lib/family/buildFamilyGraph.test.ts
import { buildFamilyGraph } from '../../../src/lib/family/buildFamilyGraph';
import type { FamilyMember } from '../../../src/lib/family/types';

function m(p: Partial<FamilyMember> & { id: string }): FamilyMember {
  return {
    name: 'X', alias: null, role: 'role', relation: 'other', tier: 0,
    modifiers: [], status: null, position: 0,
    heroId: null, heroImage: null, heroPower: null, heroAlignment: null,
    treeParentId: null, branchSide: null,
    ...p,
  };
}

describe('buildFamilyGraph', () => {
  it('orders tiers +2..-2 and omits empties', () => {
    const g = buildFamilyGraph([
      m({ id: 'c', relation: 'child', tier: -1 }),
      m({ id: 'gp', relation: 'grandparent', tier: 2 }),
      m({ id: 'p', relation: 'parent', tier: 1 }),
    ]);
    expect(g.tiers.map((t) => t.tier)).toEqual([2, 1, -1]);
  });

  it('annotates a resolved node as connecting to its parent, others to hero', () => {
    const g = buildFamilyGraph([
      m({ id: 'f', relation: 'parent', tier: 1 }),
      m({ id: 'gf', relation: 'grandparent', tier: 2, treeParentId: 'f' }),
    ]);
    const gf = g.tiers.find((t) => t.tier === 2)!.nodes[0];
    const f = g.tiers.find((t) => t.tier === 1)!.nodes[0];
    expect(gf.connectTo).toEqual({ kind: 'parent', id: 'f' });
    expect(f.connectTo).toEqual({ kind: 'hero' });
  });

  it('falls back to hero when treeParentId is not present in the set', () => {
    const g = buildFamilyGraph([m({ id: 'gf', relation: 'grandparent', tier: 2, treeParentId: 'missing' })]);
    expect(g.tiers[0].nodes[0].connectTo).toEqual({ kind: 'hero' });
  });

  it('groups resolved children adjacent to their parent column', () => {
    const g = buildFamilyGraph([
      m({ id: 'f', relation: 'parent', tier: 1, position: 0 }),
      m({ id: 'mo', relation: 'parent', tier: 1, position: 1 }),
      m({ id: 'pgf', relation: 'grandparent', tier: 2, treeParentId: 'f', position: 5 }),
      m({ id: 'mgf', relation: 'grandparent', tier: 2, treeParentId: 'mo', position: 6 }),
    ]);
    // ancestors ordered to follow their parents' order (father's parent first)
    expect(g.tiers.find((t) => t.tier === 2)!.nodes.map((x) => x.member.id)).toEqual(['pgf', 'mgf']);
  });

  it('extracts the spouse and flags ancestors + big tiers as collapsed', () => {
    const big = Array.from({ length: 7 }, (_, i) => m({ id: `a${i}`, relation: 'ancestor', tier: 2, position: i }));
    const g = buildFamilyGraph([
      ...big,
      m({ id: 'sp', relation: 'spouse', tier: 0 }),
    ]);
    expect(g.spouse?.id).toBe('sp');
    expect(g.tiers.find((t) => t.tier === 2)!.collapsedByDefault).toBe(true);
  });

  it('routes clones to asides and non-family to footnotes', () => {
    const g = buildFamilyGraph([
      m({ id: 'cl', relation: 'clone', tier: 9 }),
      m({ id: 'gf', relation: 'other', role: 'girlfriend', tier: 0 }),
    ]);
    expect(g.asides.map((x) => x.id)).toEqual(['cl']);
    expect(g.footnotes.map((x) => x.id)).toEqual(['gf']);
  });
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `yarn jest buildFamilyGraph`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// src/lib/family/buildFamilyGraph.ts
import type { ConnTarget, FamilyGraph, FamilyMember, GraphNode, GraphTier } from './types';

const TIER_LABELS: Record<number, string> = {
  2: 'Grandparents · Ancestors',
  1: 'Parents · Aunts & Uncles',
  0: 'Same generation',
  [-1]: 'Children',
  [-2]: 'Grandchildren',
};

const NONFAMILY = /girlfriend|boyfriend|fianc|lover|paramour/i;
const COLLAPSE_AFTER = 6;

export function buildFamilyGraph(members: FamilyMember[]): FamilyGraph {
  const present = new Set(members.map((x) => x.id));
  const asides: FamilyMember[] = [];
  const footnotes: FamilyMember[] = [];
  const byTier = new Map<number, FamilyMember[]>();

  for (const x of members) {
    if (x.tier === 9 || x.relation === 'clone') asides.push(x);
    else if (x.relation === 'other' && NONFAMILY.test(x.role)) footnotes.push(x);
    else {
      const list = byTier.get(x.tier) ?? [];
      list.push(x);
      byTier.set(x.tier, list);
    }
  }

  const spouse = (byTier.get(0) ?? []).find((x) => x.relation === 'spouse') ?? null;

  // Order index of each member within its own tier (by source position) — used to
  // cluster a tier's resolved children next to their parent's column.
  const orderInTier = new Map<string, number>();
  for (const [, list] of byTier) {
    [...list].sort((a, b) => a.position - b.position).forEach((x, i) => orderInTier.set(x.id, i));
  }

  const connFor = (x: FamilyMember): ConnTarget =>
    x.treeParentId && present.has(x.treeParentId) ? { kind: 'parent', id: x.treeParentId } : { kind: 'hero' };

  const sortKey = (x: FamilyMember): [number, number] => {
    if (x.treeParentId && orderInTier.has(x.treeParentId)) return [orderInTier.get(x.treeParentId)!, x.position];
    return [orderInTier.get(x.id) ?? x.position, x.position];
  };

  const tiers: GraphTier[] = [];
  for (const t of [2, 1, 0, -1, -2]) {
    const list = byTier.get(t);
    if (!list || list.length === 0) continue;
    const nodes: GraphNode[] = [...list]
      .sort((a, b) => {
        const ka = sortKey(a);
        const kb = sortKey(b);
        return ka[0] - kb[0] || ka[1] - kb[1];
      })
      .map((member) => ({ member, connectTo: connFor(member) }));
    tiers.push({
      tier: t,
      label: TIER_LABELS[t],
      nodes,
      collapsedByDefault: t === 2 || nodes.length > COLLAPSE_AFTER,
    });
  }

  return { tiers, asides, footnotes, spouse };
}
```

- [ ] **Step 5: Run, verify it passes**

Run: `yarn jest buildFamilyGraph`
Expected: PASS.

- [ ] **Step 6: Delete the superseded buildTiers**

```bash
git rm src/lib/family/buildTiers.ts __tests__/lib/family/buildTiers.test.ts
```

(Its only consumers are the `FamilyTree` files, rewritten in Tasks 8–9. If `yarn jest family` flags a stale import before then, that is expected until those tasks land — proceed.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/family/buildFamilyGraph.ts __tests__/lib/family/buildFamilyGraph.test.ts src/lib/family/types.ts
git commit -m "feat(family): buildFamilyGraph layout model with parent links"
```

---

## Task 5: connectorPaths (pure, TDD)

**Files:**
- Create: `src/lib/family/connectorPaths.ts`
- Test: `__tests__/lib/family/connectorPaths.test.ts`

Pure geometry: given each node's measured box (center-x, top, bottom in one coordinate space), the hero box, and the graph's connection targets, return elbow polylines. The renderer turns each polyline into an SVG `<Polyline>`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/family/connectorPaths.test.ts
import { connectorPaths, type NodeBox } from '../../../src/lib/family/connectorPaths';

const box = (cx: number, top: number, bottom: number): NodeBox => ({ cx, top, bottom });

describe('connectorPaths', () => {
  const hero = box(100, 200, 240);

  it('connects an above-hero node to the hero with a 4-point elbow', () => {
    const paths = connectorPaths({
      hero,
      boxes: { p: box(60, 120, 160) },
      links: [{ id: 'p', target: { kind: 'hero' } }],
    });
    // node bottom (60,160) → midY → hero top (100,200); midY = (160+200)/2 = 180
    expect(paths).toEqual([
      { points: [[60, 160], [60, 180], [100, 180], [100, 200]] },
    ]);
  });

  it('connects a below-hero node upward to the hero', () => {
    const paths = connectorPaths({
      hero,
      boxes: { c: box(140, 300, 340) },
      links: [{ id: 'c', target: { kind: 'hero' } }],
    });
    // node top (140,300) → midY=(240+300)/2=270 → hero bottom (100,240)
    expect(paths).toEqual([
      { points: [[140, 300], [140, 270], [100, 270], [100, 240]] },
    ]);
  });

  it('connects a node to a specific parent box (fork)', () => {
    const paths = connectorPaths({
      hero,
      boxes: { f: box(60, 120, 160), gf: box(40, 40, 80) },
      links: [{ id: 'gf', target: { kind: 'parent', id: 'f' } }],
    });
    // gf is above f: gf bottom (40,80) → midY=(80+120)/2=100 → f top (60,120)
    expect(paths).toEqual([
      { points: [[40, 80], [40, 100], [60, 100], [60, 120]] },
    ]);
  });

  it('skips a link whose box has not been measured yet', () => {
    expect(connectorPaths({ hero, boxes: {}, links: [{ id: 'x', target: { kind: 'hero' } }] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `yarn jest connectorPaths`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/family/connectorPaths.ts
export interface NodeBox {
  cx: number;    // center x in container coords
  top: number;   // top edge y
  bottom: number; // bottom edge y
}

export type ConnTarget = { kind: 'hero' } | { kind: 'parent'; id: string };

export interface ConnLink {
  id: string;            // the outer node's id (must be in boxes)
  target: ConnTarget;    // hero, or a specific parent id (must be in boxes)
}

export interface ConnInput {
  hero: NodeBox;
  boxes: Record<string, NodeBox>;
  links: ConnLink[];
}

export interface Polyline {
  points: [number, number][];
}

/** A 4-point orthogonal elbow between an outer node and a target box. */
function elbow(node: NodeBox, target: NodeBox): Polyline {
  // node above target → connect node.bottom up to target.top; else node.top down to target.bottom.
  const nodeAbove = node.bottom <= target.top;
  if (nodeAbove) {
    const midY = (node.bottom + target.top) / 2;
    return { points: [[node.cx, node.bottom], [node.cx, midY], [target.cx, midY], [target.cx, target.top]] };
  }
  const midY = (target.bottom + node.top) / 2;
  return { points: [[node.cx, node.top], [node.cx, midY], [target.cx, midY], [target.cx, target.bottom]] };
}

export function connectorPaths(input: ConnInput): Polyline[] {
  const out: Polyline[] = [];
  for (const link of input.links) {
    const node = input.boxes[link.id];
    if (!node) continue;
    const target = link.target.kind === 'hero' ? input.hero : input.boxes[link.target.id];
    if (!target) continue;
    out.push(elbow(node, target));
  }
  return out;
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `yarn jest connectorPaths`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/family/connectorPaths.ts __tests__/lib/family/connectorPaths.test.ts
git commit -m "feat(family): connectorPaths elbow geometry"
```

---

## Task 6: Deno _shared resolver copy + parity

**Files:**
- Modify: `supabase/functions/_shared/family.ts`
- Test: `__tests__/lib/family/parity.test.ts`

- [ ] **Step 1: Append the resolver to the Deno copy**

In `supabase/functions/_shared/family.ts`, append a self-contained copy of `BranchSide`, `KinNode`, `KinAttachment`, the `isFather`/`isMother`/`uniqueBy` helpers, and `resolveKinship` — **verbatim logic** from `src/lib/family/resolveKinship.ts` (it imports only the `FamilyRelation` type, which already exists in this file). Export `resolveKinship` and the types.

- [ ] **Step 2: Extend the parity test**

In `__tests__/lib/family/parity.test.ts`, add:

```ts
import { resolveKinship as srcResolve } from '../../../src/lib/family/resolveKinship';
import { resolveKinship as shResolve } from '../../../supabase/functions/_shared/family';

describe('resolveKinship parity', () => {
  const nodes = [
    { id: 'f', relation: 'parent' as const, role: 'father', modifiers: [] },
    { id: 'm', relation: 'parent' as const, role: 'mother', modifiers: [] },
    { id: 'gf', relation: 'grandparent' as const, role: 'paternal grandfather', modifiers: [] },
    { id: 'u', relation: 'aunt_uncle' as const, role: 'uncle', modifiers: [] },
    { id: 'c', relation: 'cousin' as const, role: 'cousin', modifiers: [] },
  ];
  it('matches between src and _shared', () => {
    expect([...shResolve(nodes).entries()]).toEqual([...srcResolve(nodes).entries()]);
  });
});
```

- [ ] **Step 3: Run, verify it passes**

Run: `yarn jest parity`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/_shared/family.ts __tests__/lib/family/parity.test.ts
git commit -m "feat(family): resolveKinship Deno copy + parity"
```

---

## Task 7: backfill update + deploy + run

**Files:** `supabase/functions/backfill-family/index.ts`; deploy + invoke via MCP/curl.

- [ ] **Step 1: Generate ids and run the resolver in the backfill**

In `supabase/functions/backfill-family/index.ts`:

1. Add `resolveKinship` to the import from `'../_shared/family.ts'`.
2. Change the row build so each row has a generated id BEFORE resolving, then attach kinship. Replace the `const rows = parsed.map(...)` block and the insert with:

```ts
      const built = parsed.map((p) => {
        const c = classifyRole(p.role);
        const linked =
          roster.get(p.name.toLowerCase()) ??
          (p.alias ? roster.get(p.alias.toLowerCase()) : undefined) ??
          null;
        return {
          id: crypto.randomUUID(),
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
      const kin = resolveKinship(
        built.map((b) => ({ id: b.id, relation: b.relation, role: b.role, modifiers: b.modifiers })),
      );
      const rows = built.map((b) => ({
        ...b,
        tree_parent_id: kin.get(b.id)?.treeParentId ?? null,
        branch_side: kin.get(b.id)?.branchSide ?? null,
      }));
      await supabase.from('hero_relatives').delete().eq('hero_id', h.id);
      const { error: insErr } = await supabase.from('hero_relatives').insert(rows);
      if (insErr) return json({ error: insErr.message, hero: h.name }, 500);
      updated++;
      rowsWritten += rows.length;
```

- [ ] **Step 2: Deploy**

Call `mcp__supabase__deploy_edge_function` with name `backfill-family`, `entrypoint_path: "index.ts"`, `verify_jwt: true`, and BOTH files (`index.ts` with name `index.ts`, the shared copy with name `../_shared/family.ts`) — exactly as the function was first deployed. Confirm `mcp__supabase__list_edge_functions` shows it ACTIVE.

- [ ] **Step 3: Rebuild all rows (refresh mode)**

The columns are new, so every hero must be reprocessed. Invoke in `refresh` batches until `updated` totals 347. With the project URL + anon key (get via `mcp__supabase__get_project_url` / `mcp__supabase__get_publishable_keys`):

```bash
URL='https://<ref>.supabase.co/functions/v1/backfill-family'; KEY='<anon>'
for i in $(seq 1 8); do
  curl -s -X POST "$URL" -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' -d '{"refresh":true,"limit":60}'; echo
done
```

(`refresh:true` ignores the "already has rows" skip; run until the cumulative updated count reaches ~347.)

- [ ] **Step 4: Verify the kinship data**

Call `mcp__supabase__execute_sql`:

```sql
select
  count(*) filter (where tree_parent_id is not null) as linked_to_parent,
  count(*) filter (where branch_side is not null) as has_side
from hero_relatives;

-- Superman: Seyg-El (paternal grandfather) should attach to Jor-El (father)
select c.name as node, c.role, p.name as parent
from hero_relatives c
left join hero_relatives p on p.id = c.tree_parent_id
where c.hero_id = (select id from heroes where name = 'Superman')
order by c.tier desc, c.position;
```
Expected: `linked_to_parent` > 0; Seyg-El's `parent` = `Jor-El`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/backfill-family/index.ts
git commit -m "feat(family): backfill computes kinship attachments"
```

---

## Task 8: FamilyTree.web rewrite — nodes + SVG connectors

**Files:** Modify `src/components/family/FamilyTree.web.tsx`.

Screen rendering is not unit-tested (per CLAUDE.md) — verify by typecheck + live Playwright in Task 10.

- [ ] **Step 1: Rewrite the web component**

Rewrite `src/components/family/FamilyTree.web.tsx` to:
1. Call `buildFamilyGraph(members)`; return `null` if `members.length === 0`.
2. Keep the existing card chrome (eyebrow "FAMILY" + count, divider) and node visuals (linked = portrait/initial avatar + teal power badge + chevron + alignment-tinted border, tappable via `router.push('/character/<heroId>?name=…')`; plain = colored-initial avatar; deceased ✝ + dim; hero anchor dark + gold avatar + gold spouse tie). Preserve the avatar/badge styles already in the file.
3. Lay tiers top→bottom inside ONE relatively-positioned container `treeBody`. Each tier is a full-width row reporting its layout via `onLayout` (relative to `treeBody`); each node reports its layout via `onLayout` (relative to its tier row). Store both in state (`Record<string, {x,y,w,h}>` for tiers keyed by tier number, and for nodes keyed by member id; the hero by key `'__hero__'`).
4. Compute each node's container-space box: `cx = tierLayout.x + nodeLayout.x + nodeLayout.w/2`, `top = tierLayout.y + nodeLayout.y`, `bottom = top + nodeLayout.h`.
5. Build `links` from the graph: for every node in every tier, `{ id, target: node.connectTo }` (skip the spouse, which uses the gold tie, not SVG).
6. Once the hero box and all referenced boxes are measured, call `connectorPaths({ hero, boxes, links })` and render the result as an absolutely-positioned `<Svg>` (from `react-native-svg`) filling `treeBody`, drawing each polyline as `<Polyline points={pts} fill="none" stroke="#cdbfa6" strokeWidth={2} />`. The `<Svg>` sits BEHIND the nodes (render it first, nodes after, or `zIndex`).
7. Collapse: a tier with `collapsedByDefault` shows the first 6 nodes + a "+N more" pill that expands via local state; re-measure happens automatically through `onLayout` on expand.
8. Keep asides ("Variants") and footnotes ("Also: …") as today.

Import: `import Svg, { Polyline } from 'react-native-svg';` and `import { connectorPaths, type NodeBox } from '../../lib/family/connectorPaths';` and `buildFamilyGraph`.

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit 2>&1 | grep -E 'FamilyTree.web|src/components/family'`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add src/components/family/FamilyTree.web.tsx
git commit -m "feat(family): web SVG connector tree with kinship forks"
```

---

## Task 9: FamilyTree native rewrite — nodes + SVG connectors

**Files:** Modify `src/components/family/FamilyTree.tsx`.

- [ ] **Step 1: Rewrite the native component**

Apply the SAME structure as Task 8 to `src/components/family/FamilyTree.tsx`, using native primitives already in the file (`TouchableOpacity` for linked nodes, `router.push`). Key native differences:
- Replace the per-tier horizontal `ScrollView` with the measured wrapping-row + connector approach (so connectors line up). Tiers wrap; `connectorPaths` works off measured boxes regardless of wrapping.
- Use the same `react-native-svg` `<Svg><Polyline/></Svg>` overlay filling the `treeBody` container.
- Keep "+N more" collapse (instead of horizontal scroll) for overflow tiers.
- Preserve the existing native node/hero/spouse-tie styles.

- [ ] **Step 2: Typecheck**

Run: `yarn tsc --noEmit 2>&1 | grep -E 'FamilyTree.tsx|src/components/family'`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add src/components/family/FamilyTree.tsx
git commit -m "feat(family): native SVG connector tree with kinship forks"
```

---

## Task 10: Skeleton tweak + full verification

**Files:** `app/character/[id].web.tsx` (skeleton, optional); verification only otherwise.

- [ ] **Step 1: Skeleton sanity**

Confirm the existing `familyCard` skeleton in `CharacterSkeleton` (`app/character/[id].web.tsx`) still reads as a family card with the new look (centered rows of chips). If the new tree is visibly taller/different, nudge the skeleton rows to match (add one more centered row). Keep it minimal. If no change needed, skip. Commit only if changed:

```bash
git add 'app/character/[id].web.tsx'
git commit -m "feat(family): align family skeleton with connector tree"
```

- [ ] **Step 2: Full test suite**

Run: `yarn test:ci`
Expected: all pass (new `resolveKinship`, `buildFamilyGraph`, `connectorPaths`, extended `rowToMember`/`parity`; `buildTiers` tests removed).

- [ ] **Step 3: Typecheck — no new errors**

Run: `yarn tsc --noEmit 2>&1 | grep -E 'src/lib/family|src/components/family|character/\[id\]'`
Expected: empty.

- [ ] **Step 4: Live visual check**

With the dev server on `:8081`, load via Playwright and screenshot the Family card for:
- `/character/644` (Superman) — paternal grandfather should now **fork under the father**, not float on the trunk.
- `/character/346` (Iron Man) — Isaac Stark (ancestor, no side) hangs on the trunk; parents fork to Iron Man.
- `/character/38` (Aquaman) — ancestors tier collapsed by default; connectors don't cross messily; "+N more" works.
Confirm: real trunk + branch connectors render, forks attach correctly, avatars on all nodes, linked nodes tappable, no console errors.

- [ ] **Step 5: DB sanity (final)**

```sql
select
  (select count(*) from hero_relatives where tree_parent_id is not null) as forks,
  (select count(*) from hero_relatives where branch_side is not null) as sided;
```
Expected: meaningful non-zero counts (hundreds sided, dozens+ forked).

---

## Self-Review Notes

- **Spec coverage:** kinship columns (Task 1), resolver (Task 2) + Deno copy/parity (Task 6) + backfill (Task 7); types/query threading (Task 3); graph builder with parent-link ordering + collapse + spouse (Task 4); connector geometry (Task 5); SVG renderer web+native with measured positions (Tasks 8–9); honest-connector rule enforced by resolver guards (Task 2) + `connectTo` fallback to hero (Task 4); comprehension guards/skeleton/verification (Task 10). All §-sections map to a task. AI extraction explicitly excluded (spec §9).
- **Type consistency:** `BranchSide` defined in `resolveKinship.ts` and reused in `types.ts`/`rowToMember.ts`; `ConnTarget` defined in `types.ts` (graph) and mirrored in `connectorPaths.ts` (geometry input) — intentionally duplicated to keep the geometry module dependency-free; the renderer maps one to the other. `KinNode`/`KinAttachment`, `GraphNode`/`GraphTier`/`FamilyGraph`, `NodeBox`/`ConnLink`/`Polyline` are each defined once and reused.
- **Open items (spec §10):** orthogonal elbows chosen (Task 5); `buildFamilyGraph` replaces `buildTiers` outright (Task 4, with deletion); collapse re-measurement via `onLayout` on expand (Tasks 8–9).
```
