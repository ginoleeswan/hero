# Relationships — Social Web Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An additive force-directed "social web" on the web character page — an inline preview below the existing relationship shelves plus a deep-linkable full-screen explorer with pan/zoom, tap-to-navigate, and tap-to-recenter — powered by a new RPC that surfaces second-degree edges among a hero's neighborhood.

**Architecture:** A new `get_hero_neighborhood` SQL RPC reads the existing `hero_relationships` graph and returns an ego network (nodes + inter-neighbor edges) as JSON. A pure, dependency-free force simulation lays out the nodes deterministically. One shared `react-native-svg` + `View` renderer draws edges and portrait nodes; a compact `SocialWebPreview` embeds it in the relationships card, and a `/character/[id]/universe` route hosts the interactive explorer.

**Tech Stack:** Supabase/Postgres RPC, React Native Web, react-native-svg 15.15.4, @supabase/supabase-js, React Query, jest-expo.

**Spec:** `docs/superpowers/specs/2026-07-06-social-web-graph-design.md`

## Global Constraints

- yarn only; `yarn tsc --noEmit` + `yarn test:ci` green before each commit; `npx prettier --write` touched files (pre-push checks format).
- Migrations: new SQL file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`; apply via `mcp__supabase__apply_migration`; regenerate `src/types/database.generated.ts` after.
- New RPC MUST `grant execute … to anon, authenticated, service_role` — without it anon silently gets `[]` (repo lesson). `hero_relationships` already has a public-read policy.
- Screens never import `supabase` directly — DB access via `src/lib/db/`. RN-safe components only in the shared renderer (no `<img>`, no CSS-string-only styles) so native can reuse it.
- Web character screen + new route only. Native explorer is a **separate later pass**.
- Never Flame-Bold; `StyleSheet.create`; explicit widths on aspect-ratio nodes (WebKit collapse).
- Commit to `main` after each task; push at the end.

---

### Task 1: `get_hero_neighborhood` RPC + migration

**Files:**
- Create: `supabase/migrations/<timestamp>_hero_neighborhood.sql`
- Modify: `src/types/database.generated.ts` (regenerated)

**Interfaces:**
- Produces: `get_hero_neighborhood(p_hero_id text, p_limit integer default 24) returns json` → `{ nodes: NodeRow[], edges: EdgeRow[] }` where `NodeRow = { id, name, portrait_url, image_md_url, image_url, alignment, publisher, fame_score, is_subject }` and `EdgeRow = { from, to, kind }`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- <timestamp>_hero_neighborhood.sql
-- Ego network for the character-page "social web": the subject + its top
-- neighbours by fame, plus EVERY hero_relationships edge among that node set
-- (the second-degree edges get_related_heroes does not expose). Undirected —
-- reciprocal/multi-kind pairs collapse to one edge, precedence enemy>teammate>ally.
create or replace function public.get_hero_neighborhood(
  p_hero_id text,
  p_limit integer default 24
)
returns json
language sql
stable
as $$
  with neighbours as (
    select r.related_id as id
    from public.hero_relationships r
    join public.heroes h on h.id = r.related_id
    where r.hero_id = p_hero_id
    group by r.related_id, h.fame_score, r.rank
    order by h.fame_score desc nulls last, min(r.rank) asc nulls last
    limit p_limit
  ),
  node_ids as (
    select p_hero_id as id
    union
    select id from neighbours
  ),
  node_rows as (
    select h.id, h.name, h.portrait_url, h.image_md_url, h.image_url,
           h.alignment, h.publisher, h.fame_score,
           (h.id = p_hero_id) as is_subject
    from public.heroes h
    join node_ids n on n.id = h.id
  ),
  pair_edges as (
    select distinct
      least(r.hero_id, r.related_id) as a,
      greatest(r.hero_id, r.related_id) as b,
      r.kind
    from public.hero_relationships r
    where r.hero_id in (select id from node_ids)
      and r.related_id in (select id from node_ids)
      and r.hero_id <> r.related_id
  ),
  ranked as (
    select a, b, kind,
      row_number() over (
        partition by a, b
        order by case kind when 'enemy' then 0 when 'teammate' then 1 when 'ally' then 2 else 3 end
      ) as rn
    from pair_edges
  ),
  edge_rows as (
    select a as "from", b as "to", kind from ranked where rn = 1
  )
  select json_build_object(
    'nodes', coalesce((select json_agg(row_to_json(node_rows)) from node_rows), '[]'::json),
    'edges', coalesce((select json_agg(row_to_json(edge_rows)) from edge_rows), '[]'::json)
  );
$$;

grant execute on function public.get_hero_neighborhood(text, integer) to anon, authenticated, service_role;
```

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase__apply_migration` with the file contents.

- [ ] **Step 3: Smoke-test the RPC**

Use `mcp__supabase__execute_sql`:
`select public.get_hero_neighborhood('643', 8);`
Expected: JSON with a `nodes` array containing `643` flagged `is_subject: true` plus up to 8 neighbours, and an `edges` array with at least the subject-incident edges. Try a sparse hero id too — expect `nodes` with just the subject (and few/no edges).

- [ ] **Step 4: Regenerate types**

Use `mcp__supabase__generate_typescript_types`; write the result to `src/types/database.generated.ts`. Confirm `get_hero_neighborhood` appears in the `Functions` block.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<timestamp>_hero_neighborhood.sql src/types/database.generated.ts
git commit -m "feat(db): get_hero_neighborhood RPC — ego network with second-degree edges"
```

---

### Task 2: Typed fetch wrapper

**Files:**
- Create: `src/lib/db/heroes/neighborhood.ts`
- Modify: `src/lib/db/heroes.ts` (barrel — add `export * from './heroes/neighborhood';`)
- Test: `__tests__/lib/heroes/neighborhood.test.ts`

**Interfaces:**
- Consumes: the `get_hero_neighborhood` RPC (Task 1); `supabase` from `src/lib/supabase`.
- Produces:
  - types `NeighborNode = { id: string; name: string; portrait_url: string | null; image_md_url: string | null; image_url: string | null; alignment: string | null; publisher: string | null; fame_score: number | null; is_subject: boolean }`, `NeighborEdge = { from: string; to: string; kind: 'enemy' | 'ally' | 'teammate' }`, `Neighborhood = { nodes: NeighborNode[]; edges: NeighborEdge[] }`.
  - `getHeroNeighborhood(heroId: string, limit?: number): Promise<Neighborhood>`.
  - pure helper `subjectKind(edges: NeighborEdge[], subjectId: string, nodeId: string): NeighborEdge['kind'] | null` — the relationship of a node to the subject, from the subject-incident edge (for tinting node rings). Exported + tested.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/heroes/neighborhood.test.ts
import { subjectKind } from '../../../src/lib/db/heroes/neighborhood';

const edges = [
  { from: 'A', to: 'B', kind: 'enemy' as const },
  { from: 'C', to: 'A', kind: 'ally' as const },
  { from: 'B', to: 'C', kind: 'teammate' as const },
];

describe('subjectKind', () => {
  it('finds the kind of an edge incident to the subject, either direction', () => {
    expect(subjectKind(edges, 'A', 'B')).toBe('enemy');
    expect(subjectKind(edges, 'A', 'C')).toBe('ally');
  });
  it('returns null when the node has no direct edge to the subject', () => {
    // B–C is a neighbour–neighbour edge, not incident to subject A
    expect(subjectKind(edges, 'A', 'A')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it** — `yarn jest __tests__/lib/heroes/neighborhood.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/db/heroes/neighborhood.ts
import { supabase } from '../../supabase';

export interface NeighborNode {
  id: string;
  name: string;
  portrait_url: string | null;
  image_md_url: string | null;
  image_url: string | null;
  alignment: string | null;
  publisher: string | null;
  fame_score: number | null;
  is_subject: boolean;
}
export interface NeighborEdge {
  from: string;
  to: string;
  kind: 'enemy' | 'ally' | 'teammate';
}
export interface Neighborhood {
  nodes: NeighborNode[];
  edges: NeighborEdge[];
}

/** A hero's ego network: subject + top-fame neighbours + all edges among them. */
export async function getHeroNeighborhood(heroId: string, limit = 24): Promise<Neighborhood> {
  if (!heroId) return { nodes: [], edges: [] };
  const { data, error } = await supabase.rpc('get_hero_neighborhood', {
    p_hero_id: heroId,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getHeroNeighborhood] error:', error.message);
    return { nodes: [], edges: [] };
  }
  const parsed = (data ?? { nodes: [], edges: [] }) as Neighborhood;
  return { nodes: parsed.nodes ?? [], edges: parsed.edges ?? [] };
}

/** The relationship of `nodeId` to `subjectId`, from the subject-incident edge. */
export function subjectKind(
  edges: NeighborEdge[],
  subjectId: string,
  nodeId: string,
): NeighborEdge['kind'] | null {
  if (nodeId === subjectId) return null;
  const e = edges.find(
    (x) =>
      (x.from === subjectId && x.to === nodeId) || (x.to === subjectId && x.from === nodeId),
  );
  return e ? e.kind : null;
}
```

- [ ] **Step 4: Run it** — PASS (2 tests). Add the barrel export.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/heroes/neighborhood.ts src/lib/db/heroes.ts __tests__/lib/heroes/neighborhood.test.ts
git commit -m "feat(db): getHeroNeighborhood fetch + subjectKind helper"
```

---

### Task 3: Pure force-layout simulation

**Files:**
- Create: `src/lib/graph/forceLayout.ts`
- Test: `__tests__/lib/graph/forceLayout.test.ts`

**Interfaces:**
- Produces: `layoutNeighborhood(nodes: { id: string; isSubject: boolean }[], edges: { from: string; to: string }[], opts?: { iterations?: number }): Map<string, { x: number; y: number }>` — normalized coords roughly in `[-1, 1]`, subject pinned at `(0,0)`, deterministic (seeded by id hash).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/graph/forceLayout.test.ts
import { layoutNeighborhood } from '../../../src/lib/graph/forceLayout';

const nodes = [
  { id: 'S', isSubject: true },
  { id: 'A', isSubject: false },
  { id: 'B', isSubject: false },
  { id: 'C', isSubject: false },
];
const edges = [
  { from: 'S', to: 'A' },
  { from: 'S', to: 'B' },
  { from: 'S', to: 'C' },
  { from: 'A', to: 'B' },
];

describe('layoutNeighborhood', () => {
  it('pins the subject at the center', () => {
    const pos = layoutNeighborhood(nodes, edges);
    expect(pos.get('S')).toEqual({ x: 0, y: 0 });
  });
  it('is deterministic — same input yields identical positions', () => {
    const a = layoutNeighborhood(nodes, edges);
    const b = layoutNeighborhood(nodes, edges);
    for (const id of ['S', 'A', 'B', 'C']) expect(b.get(id)).toEqual(a.get(id));
  });
  it('keeps all nodes within bounds', () => {
    const pos = layoutNeighborhood(nodes, edges);
    for (const p of pos.values()) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.2);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.2);
    }
  });
  it('separates non-subject nodes (no two closer than a min distance)', () => {
    const pos = layoutNeighborhood(nodes, edges);
    const ids = ['A', 'B', 'C'];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.15);
      }
  });
});
```

- [ ] **Step 2: Run it** — FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/lib/graph/forceLayout.ts

/** Deterministic 0–1 hash of a string id → seeds initial placement. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Tiny deterministic force sim: node repulsion + link springs + centering,
 * subject pinned at origin. Fixed iteration count, seeded by id hash so a
 * character's web is stable across visits. Normalized to roughly [-1,1].
 */
export function layoutNeighborhood(
  nodes: { id: string; isSubject: boolean }[],
  edges: { from: string; to: string }[],
  opts?: { iterations?: number },
): Map<string, { x: number; y: number }> {
  const iterations = opts?.iterations ?? 300;
  const pos = new Map<string, { x: number; y: number }>();
  const N = nodes.length;
  nodes.forEach((n, i) => {
    if (n.isSubject) {
      pos.set(n.id, { x: 0, y: 0 });
    } else {
      // deterministic ring-ish seed
      const a = hash01(n.id) * Math.PI * 2;
      const r = 0.4 + 0.4 * hash01(n.id + 'r');
      pos.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  });

  const REPULSE = 0.02;
  const SPRING = 0.02;
  const REST = 0.5;
  const CENTER = 0.005;

  for (let it = 0; it < iterations; it++) {
    const force = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));
    // repulsion
    for (let i = 0; i < N; i++)
      for (let j = i + 1; j < N; j++) {
        const a = pos.get(nodes[i].id)!;
        const b = pos.get(nodes[j].id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.0001;
        const f = REPULSE / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        force.get(nodes[i].id)!.x += fx;
        force.get(nodes[i].id)!.y += fy;
        force.get(nodes[j].id)!.x -= fx;
        force.get(nodes[j].id)!.y -= fy;
      }
    // springs
    for (const e of edges) {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const f = SPRING * (d - REST);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      force.get(e.from)!.x += fx;
      force.get(e.from)!.y += fy;
      force.get(e.to)!.x -= fx;
      force.get(e.to)!.y -= fy;
    }
    // integrate (subject pinned)
    for (const n of nodes) {
      if (n.isSubject) continue;
      const p = pos.get(n.id)!;
      const f = force.get(n.id)!;
      p.x += f.x - p.x * CENTER;
      p.y += f.y - p.y * CENTER;
    }
  }

  // normalize into [-1,1] keeping subject at origin
  let max = 0.0001;
  for (const p of pos.values()) max = Math.max(max, Math.abs(p.x), Math.abs(p.y));
  const scale = max > 1 ? 1 / max : 1;
  for (const p of pos.values()) {
    p.x *= scale;
    p.y *= scale;
  }
  return pos;
}
```

- [ ] **Step 4: Run it** — PASS (4 tests). If the min-distance test flakes, raise `iterations` or `REPULSE` slightly and re-run until stable; the fixture is small so it should settle.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/forceLayout.ts __tests__/lib/graph/forceLayout.test.ts
git commit -m "feat(graph): deterministic force-layout for the social web"
```

---

### Task 4: `SocialWebGraph` renderer

**Files:**
- Create: `src/components/web/character/SocialWebGraph.tsx`

**Interfaces:**
- Consumes: `Neighborhood`, `NeighborNode`, `subjectKind` (Task 2); `layoutNeighborhood` (Task 3); `HeroImage`; `monogram` (exported from `RelatedHeroStrip`).
- Produces: `SocialWebGraph` — props `{ neighborhood: Neighborhood; subjectId: string; accent: string; size: number; onNodePress?: (id: string) => void; onNodeLongPress?: (id: string) => void }`. Pure presentational (positions computed via `useMemo(layoutNeighborhood)`).

- [ ] **Step 1: Implement**

```tsx
// src/components/web/character/SocialWebGraph.tsx
import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { COLORS } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import { monogram } from '../../RelatedHeroStrip';
import {
  layoutNeighborhood,
} from '../../../lib/graph/forceLayout';
import type { Neighborhood } from '../../../lib/db/heroes/neighborhood';

const KIND_COLOR: Record<string, string> = {
  enemy: COLORS.red,
  ally: COLORS.green,
  teammate: COLORS.blue,
};

export function SocialWebGraph({
  neighborhood,
  subjectId,
  accent,
  size,
  onNodePress,
  onNodeLongPress,
}: {
  neighborhood: Neighborhood;
  subjectId: string;
  accent: string;
  size: number;
  onNodePress?: (id: string) => void;
  onNodeLongPress?: (id: string) => void;
}) {
  const { nodes, edges } = neighborhood;
  const positions = useMemo(
    () => layoutNeighborhood(nodes.map((n) => ({ id: n.id, isSubject: n.is_subject })), edges),
    [nodes, edges],
  );

  const pad = 40;
  const R = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const at = (id: string) => {
    const p = positions.get(id) ?? { x: 0, y: 0 };
    return { x: cx + p.x * R, y: cy + p.y * R };
  };
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {edges.map((e, i) => {
          const a = at(e.from);
          const b = at(e.to);
          const incident = e.from === subjectId || e.to === subjectId;
          return (
            <Line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={(KIND_COLOR[e.kind] ?? COLORS.grey) + (incident ? 'cc' : '55')}
              strokeWidth={incident ? 2 : 1}
            />
          );
        })}
      </Svg>
      {nodes.map((n) => {
        const p = at(n.id);
        const d = n.is_subject ? 64 : 44;
        const ring = n.is_subject ? accent : KIND_COLOR[relKind(edges, subjectId, n.id)] ?? COLORS.grey;
        return (
          <Pressable
            key={n.id}
            onPress={() => onNodePress?.(n.id)}
            onLongPress={() => onNodeLongPress?.(n.id)}
            style={
              [
                styles.node,
                {
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  left: p.x - d / 2,
                  top: p.y - d / 2,
                  borderColor: ring,
                  borderWidth: n.is_subject ? 3 : 2,
                },
              ] as object
            }
          >
            {n.portrait_url || n.image_md_url || n.image_url ? (
              <HeroImage
                id={n.id}
                name={n.name}
                imageUrl={n.image_url}
                portraitUrl={n.portrait_url}
                imageMdUrl={n.image_md_url}
                grid
                contentFit="cover"
                contentPosition="top"
                style={{ width: d, height: d }}
                recyclingKey={n.id}
              />
            ) : (
              <View style={[styles.mono, { backgroundColor: COLORS.navy }]}>
                <Text style={[styles.monoText, { color: ring }]}>{monogram(n.name)}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function relKind(
  edges: Neighborhood['edges'],
  subjectId: string,
  nodeId: string,
): string {
  if (nodeId === subjectId) return 'subject';
  const e = edges.find(
    (x) => (x.from === subjectId && x.to === nodeId) || (x.to === subjectId && x.from === nodeId),
  );
  return e?.kind ?? 'none';
}

const styles = StyleSheet.create({
  node: { position: 'absolute', overflow: 'hidden', backgroundColor: COLORS.navy } as object,
  mono: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontFamily: 'Flame-Regular', fontSize: 16, lineHeight: 20 } as object,
});
```

(The local `relKind` duplicates `subjectKind`'s logic but returns a string default for styling; acceptable, or import `subjectKind` and map null→'none'. Prefer importing `subjectKind` to stay DRY — replace `relKind(...)` with `subjectKind(edges, subjectId, n.id) ?? 'none'` and drop the local fn.)

- [ ] **Step 2: DRY it** — replace the local `relKind` with the imported `subjectKind` (Task 2), mapping `null → 'none'`. Import it alongside the types.

- [ ] **Step 3: Typecheck** — `yarn tsc --noEmit` clean for the new file.

- [ ] **Step 4: Commit**

```bash
git add src/components/web/character/SocialWebGraph.tsx
git commit -m "feat(character): SocialWebGraph renderer — svg edges + portrait nodes"
```

---

### Task 5: `SocialWebPreview` in the relationships card

**Files:**
- Create: `src/components/web/character/SocialWebPreview.tsx`
- Modify: `app/character/[id].web.tsx` (relationships card — after the shelves, before the affiliations block)
- Modify: `src/lib/query/heroQueries.ts` (add a neighborhood query hook) OR fetch inline via React Query in the preview

**Interfaces:**
- Consumes: `getHeroNeighborhood` (Task 2), `SocialWebGraph` (Task 4), `Reveal`.
- Produces: `SocialWebPreview` — props `{ heroId: string; accent: string; onExplore: () => void }`. Fetches `getHeroNeighborhood(heroId, 8)` via React Query; renders nothing if `< 2` neighbours.

- [ ] **Step 1: Implement the preview**

```tsx
// src/components/web/character/SocialWebPreview.tsx
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { getHeroNeighborhood } from '../../../lib/db/heroes/neighborhood';
import { SocialWebGraph } from './SocialWebGraph';

export function SocialWebPreview({
  heroId,
  accent,
  onExplore,
}: {
  heroId: string;
  accent: string;
  onExplore: () => void;
}) {
  const { data } = useQuery({
    queryKey: ['neighborhood', heroId, 8],
    queryFn: () => getHeroNeighborhood(heroId, 8),
    staleTime: 5 * 60 * 1000,
  });
  if (!data || data.nodes.length < 3) return null; // subject + <2 neighbours → skip

  return (
    <Pressable onPress={onExplore} style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Social Web</Text>
        <View style={styles.explore}>
          <Text style={[styles.exploreText, { color: accent }] as object}>Explore the web</Text>
          <Ionicons name="arrow-forward" size={13} color={accent} />
        </View>
      </View>
      <View style={styles.graphWrap}>
        <SocialWebGraph neighborhood={data} subjectId={heroId} accent={accent} size={300} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  title: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.55)',
  },
  explore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exploreText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  graphWrap: { alignItems: 'center', paddingVertical: 8 },
});
```

- [ ] **Step 2: Wire into the relationships card**

In `[id].web.tsx`, inside the relationships card (`nativeID="sec-relations"`), after the three shelves' wrapper `<View style={{ marginHorizontal: -20 }}>…</View>` and before the affiliations block, add:

```tsx
<SocialWebPreview
  heroId={id}
  accent={theme.accent}
  onExplore={() =>
    router.push(`/character/${id}/universe` as Parameters<typeof router.push>[0])
  }
/>
```

Mirror into the mobile relationships section too (same placement after the mobile shelves). Import `SocialWebPreview`.

- [ ] **Step 3: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` → clean/green. Prettier the touched files.

```bash
git add src/components/web/character/SocialWebPreview.tsx "app/character/[id].web.tsx"
git commit -m "feat(character): Social Web preview below the relationship shelves"
```

---

### Task 6: Full-screen explorer route

**Files:**
- Create: `app/character/[id]/universe.tsx` (native placeholder — redirects to the dossier for now)
- Create: `app/character/[id]/universe.web.tsx` (the explorer)

**Interfaces:**
- Consumes: `getHeroNeighborhood`, `SocialWebGraph`, `deriveCharacterTheme`, `useHeroDetail`/`getHeroById` for the focus name/theme.

- [ ] **Step 1: Verify the nested route resolves (de-risk first)**

Create a trivial `app/character/[id]/universe.web.tsx` that renders `<Text>universe {id}</Text>` and a native `universe.tsx` that redirects. Run the app on web; navigate to `/character/643/universe`. Confirm expo-router serves it **and** `/character/643` still works (the `[id].tsx` file + `[id]/` folder coexist). If it errors, fall back to `app/social-web/[id].tsx` (+ `.web.tsx`) and update the `onExplore` push target in Task 5 accordingly. Commit the stub once confirmed.

- [ ] **Step 2: Build the explorer (web)**

```tsx
// app/character/[id]/universe.web.tsx
import { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { getHeroNeighborhood } from '../../../src/lib/db/heroes/neighborhood';
import { SocialWebGraph } from '../../../src/components/web/character/SocialWebGraph';
import { deriveCharacterTheme } from '../../../src/lib/accent';

export default function UniverseExplorer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  // The graph re-centers on focusId without changing the route (entry id stays the URL).
  const [focusId, setFocusId] = useState<string>(id);
  const { data } = useQuery({
    queryKey: ['neighborhood', focusId, 24],
    queryFn: () => getHeroNeighborhood(focusId, 24),
    staleTime: 5 * 60 * 1000,
  });

  const focusNode = data?.nodes.find((n) => n.id === focusId);
  const theme = useMemo(
    () => deriveCharacterTheme({ publisher: focusNode?.publisher ?? null }),
    [focusNode],
  );

  const size = Math.min(width, height - 120);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={COLORS.navy} />
        </Pressable>
        <Text style={styles.title}>{focusNode ? `${focusNode.name}'s universe` : 'Universe'}</Text>
        <View style={styles.legend}>
          <Legend color={COLORS.red} label="Enemy" />
          <Legend color={COLORS.green} label="Ally" />
          <Legend color={COLORS.blue} label="Team" />
        </View>
      </View>
      <View style={styles.canvas}>
        {data ? (
          <SocialWebGraph
            neighborhood={data}
            subjectId={focusId}
            accent={theme.accent}
            size={size}
            onNodePress={(nodeId) =>
              nodeId === focusId
                ? null
                : router.push(`/character/${nodeId}` as Parameters<typeof router.push>[0])
            }
            onNodeLongPress={(nodeId) => setFocusId(nodeId)}
          />
        ) : (
          <Text style={styles.empty}>Mapping the universe…</Text>
        )}
      </View>
      <Text style={styles.hint}>Tap a node to visit · long-press to recenter</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.beige },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { padding: 6 },
  title: { fontFamily: 'Flame-Regular', fontSize: 20, lineHeight: 26, color: COLORS.navy, flex: 1 } as object,
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(41,60,67,0.6)' },
  canvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: 'rgba(41,60,67,0.5)' },
  hint: { textAlign: 'center', fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(41,60,67,0.45)', paddingBottom: 16 },
});
```

Native placeholder:

```tsx
// app/character/[id]/universe.tsx
import { Redirect, useLocalSearchParams } from 'expo-router';
export default function UniverseNative() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/character/${id}`} />;
}
```

**Pan/zoom (approved v1 scope):** the recenter (long-press) is the primary exploration; pan/zoom is a nice-to-have. For this pass ship **tap-navigate + long-press-recenter** and a graph auto-sized to the viewport (`size` above). Defer pan/zoom gestures (`react-native-gesture-handler` transform on the canvas) to a follow-up polish step — note it here so it isn't lost, but do not block the route on it.

- [ ] **Step 3: Verify + commit**

Run: `yarn tsc --noEmit && yarn test:ci` → clean/green. Prettier touched files.

```bash
git add "app/character/[id]/universe.tsx" "app/character/[id]/universe.web.tsx"
git commit -m "feat(character): social-web explorer route — tap-navigate + long-press recenter"
```

---

### Task 7: Verification sweep + push

- [ ] **Step 1:** `yarn test:ci && yarn tsc --noEmit && yarn lint` (errors-only) → green (ignore pre-existing unrelated admin/script errors from parallel work; confirm none are in the new graph files).
- [ ] **Step 2:** `npx prettier --write` all new/touched files; commit any leftover formatting.
- [ ] **Step 3:** Push (`git push`; if the pre-push hook fails only on unrelated parallel work, use `--no-verify` per the documented escape — CI re-gates).
- [ ] **Step 4:** Hand off for device screenshots (desktop + iOS Safari): `/character/643` shows the Social Web preview below the shelves; tapping opens `/character/643/universe`; nodes tap through to characters; long-press recenters the web on a new hero (title + accent update). Try a sparse hero (preview absent) and a hub villain (dense web). Iterate; the native interactive explorer (gesture pan/zoom + real screen) is a separate later pass.
