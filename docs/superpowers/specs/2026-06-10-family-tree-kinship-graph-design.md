# Family Tree — Kinship Graph + Connector Redesign

**Date:** 2026-06-10
**Status:** Approved (design), pending implementation plan
**Builds on:** `2026-06-10-hero-family-tree-design.md` (the shipped tier-based family tree)
**Platforms:** Web (desktop + mobile web) and Native — full parity

## 1. Summary

Two complementary upgrades to the shipped family tree:

1. **Kinship graph (DB):** derive real inter-relative attachments — *deterministically* — so a paternal grandfather nests under the father, a cousin under an aunt/uncle, etc., instead of every relative sitting in a flat generational row.
2. **Connector redesign (UI):** render a proper family tree with an SVG connector layer (central trunk + per-generation branch bars + drop-lines, plus real forks where the graph supplies them) and richer avatar-bearing nodes, so the structure reads instantly.

The existing hero-centric `hero_relatives` rows and the `relatives` source string are unchanged as the source of truth; the kinship attachments are **derived** and rebuildable. AI-based edge extraction is explicitly **out of scope** here (see §9) — the deterministic resolver is the foundation a future AI pass would top up.

## 2. Motivation

The shipped tree is honest but visually flat: stacked centered rows, left-floating connector stubs that link nothing, lots of dead space, and no signal of *which* parent a grandparent belongs to. Two root causes:

- **Connectors were cosmetic stubs**, not a real trunk/branch structure.
- **We only stored each relative's relation to the hero**, never inter-relative structure — so grandparents/cousins/etc. couldn't nest.

Both are fixable: the inter-relative structure is largely *recoverable* from data we already have (kinship logic + `paternal/maternal/in-law` qualifiers + cross-hero links), and proper connectors are a `react-native-svg` rendering job (dependency already installed at 15.15.4).

## 3. Core principle — honest connectors

Connector lines may **only**:
- tie the hero's vertical spine to each generation (membership of a generation), and
- express attachments the resolver is **confident** about (a node → its specific closer-to-hero parent).

Lines must **never** invent lateral relationships between relatives (no fake marriage bars between two parents, no fake sibling bars). The single known lateral link is the **hero↔spouse tie**. When an attachment is ambiguous, the node hangs off the central trunk at its tier — correct, never misleading.

## 4. DB — derived kinship attachment

### 4.1 Schema

Add two **derived** columns to `hero_relatives` (migration; regenerate `database.generated.ts` after):

```sql
alter table hero_relatives
  add column tree_parent_id uuid references hero_relatives(id) on delete set null,
  add column branch_side text;  -- 'paternal' | 'maternal' | 'spouse' | null
```

- `tree_parent_id` — the family member this node hangs from, one step **closer to the hero** generationally. `null` = attaches directly to the hero spine at its tier.
- `branch_side` — paternal/maternal/spouse hint, for grouping/styling; `null` when unknown.

Both are recomputed by the backfill (idempotent, like the existing columns).

### 4.2 Deterministic resolver (runs in `backfill-family`, per hero's family)

After the existing parse/classify produces the member rows for a hero, a second pass assigns `tree_parent_id` / `branch_side`. **Resolve only when unambiguous; otherwise leave null.**

| Member (relation + role qualifier) | `tree_parent_id` → | `branch_side` | Guard |
|---|---|---|---|
| grandparent, role has `paternal` | the father row | paternal | exactly one `father` parent exists |
| grandparent, role has `maternal` | the mother row | maternal | exactly one `mother` parent exists |
| grandparent, no side | null | null | (don't guess) |
| ancestor (great-grand+) | the matching grandparent if exactly one, else null | inherit | |
| grandchild | the single child of matching side, else null | | exactly one child |
| cousin | the single aunt/uncle row, else null | inherit aunt/uncle side | |
| niece/nephew | the single sibling row, else null | | |
| in_law (any) | the spouse row if exactly one, else null | spouse | |
| parent / child / sibling / spouse / clone / other | null (attach to hero spine) | parent→its own side if role says so | always null parent |

"father"/"mother" detection uses the member's `role`/`relation` (`parent` relation + role contains father/mother) and `modifiers` (adoptive/step still count as a father/mother for attachment). Ties/duplicates (e.g. two fathers from bio+adoptive) → treat as ambiguous → null.

Cross-hero reconciliation (using `related_hero_id` to confirm edges from the linked hero's own relatives) is **not** required for v1; the within-family resolver above is sufficient. It is a natural later enhancement.

### 4.3 Resolver location

The resolver is pure TS in `src/lib/family/resolveKinship.ts` (no RN imports), unit-tested with jest, and **mirrored into the Deno `_shared/family.ts` copy** (parity test extended to cover it), exactly as `parseRelatives`/`classifyRole` are today. The `backfill-family` function calls it after classification and writes `tree_parent_id` + `branch_side` per row.

## 5. UI — connector tree

### 5.1 Layout model — `buildFamilyGraph(members)`

Pure function (replaces/extends `buildTiers`): returns an ordered, render-ready model:
- Generation tiers in fixed vertical order (+2 ancestors → +1 parents/aunts/uncles → 0 hero row → −1 children → −2 grandchildren), clones as an aside, non-family as footnotes (unchanged from today).
- **Within each tier, order nodes so a node with a `tree_parent_id` sits in the column of its parent** (group resolved children beneath/above their parent's position) to keep connector lines from crossing.
- Annotate each node with its connection target: `hero-spine` (default, at its tier) or `parent:<id>` (resolved fork).
- The hero is injected at tier 0; spouse extracted for the gold tie; tiers >6 and the ancestors tier flagged `collapsedByDefault`.

Unit-tested: tier ordering, parent-column grouping, collapse flags, spouse extraction.

### 5.2 Connector rendering

- Each rendered node reports its center + box via `onLayout` into a positions map (keyed by member id; the hero by a sentinel key), all within one relatively-positioned container.
- `FamilyConnectors` (pure, given the positions map + the graph model) emits a single absolutely-positioned `<Svg>` layer filling that container, drawing:
  - the **central trunk** through the hero,
  - per-tier **branch bar + drop-lines** from the trunk to each `hero-spine` node,
  - **forks**: a path from a parent node's edge to each `parent:<id>` child node,
  - (the gold spouse tie is a styled View beside the hero, not SVG.)
- Two-pass: first render measures, state holds positions, overlay draws. Re-measures on layout changes (collapse expand, resize).

### 5.3 Node design (avatars on every node)

- **Linked** (`heroId != null`): portrait (expo-image) or colored-initial fallback, teal power badge, chevron, slight elevation, alignment-tinted border; tappable → `/character/<heroId>`.
- **Plain**: colored-initial avatar, flat, no chevron.
- **Deceased**: ✝ + dimmed.
- **Hero anchor**: dark node, gold avatar, "This hero"; **gold spouse tie** beside it.
- Every node shows its role label (relationship word, status stripped).

### 5.4 Comprehension guards

Centered generation labels retained; every node shows its role; ancestors tier + any tier >6 collapsed behind "+N more"; vertical oldest→youngest reading order.

### 5.5 Mobile / web parity

Same model and connector logic both places. Tiers wrap on narrow widths; because connectors are drawn from measured positions, wrapping never breaks the lines. "+N more" handles overflow (no horizontal scroll needed). `react-native-svg` renders identically on web and native.

## 6. Component structure

```
src/lib/family/
  resolveKinship.ts     NEW — pure resolver (tree_parent_id + branch_side); jest-tested
  buildFamilyGraph.ts   NEW — pure layout model (extends/replaces buildTiers); jest-tested
  types.ts              + FamilyMember.treeParentId, .branchSide; graph-model types
  rowToMember.ts        + map the two new columns
supabase/functions/
  _shared/family.ts     + resolveKinship copy (parity-tested)
  backfill-family/index.ts  + call resolver, write new columns
src/components/family/
  FamilyConnectors.web.tsx / .tsx   NEW — SVG connector layer
  FamilyTree.web.tsx / .tsx         rewritten — measure nodes + render nodes + connectors
src/lib/db/heroes.ts    getHeroFamily: select the two new columns
```

## 7. Data flow

```
heroes.relatives (source) ──backfill-family──► hero_relatives (+ tree_parent_id, branch_side)
                                                   │ getHeroFamily (FK embed)
                                                   ▼
                          buildFamilyGraph(members) → tiers + parent-links + collapse
                                                   ▼
        FamilyTree (measure nodes) + FamilyConnectors (<Svg> from measured positions)
```

## 8. Testing

- `resolveKinship` — table-driven over real fixtures (Superman: Seyg-El paternal grandfather → Jor-El; Iron Man: Isaac Stark ancestor → null; ambiguous multi-father → null; cousin→aunt/uncle; in-law→spouse).
- `buildFamilyGraph` — tier order, parent-column grouping, collapse flags, spouse extraction.
- Parity test extended for `resolveKinship` (src vs `_shared`).
- Connector geometry / rendering: not unit-tested (per CLAUDE.md, no screen-render tests); verified by typecheck + live Playwright check on Superman, Iron Man, Aquaman.

## 9. Out of scope (future)

- **AI edge extraction** for ambiguous/messy residue (the deterministic resolver is the foundation it would extend).
- **Cross-hero reconciliation** (confirming edges from a linked hero's own relatives).
- Reverse "appears in N families" surfacing; dynasty/cluster views.

## 10. Open implementation details (resolve in planning)

- Exact SVG path style for forks (orthogonal elbows vs. curves) — start with orthogonal elbows to match the org-chart idiom.
- Whether `buildFamilyGraph` supersedes `buildTiers` outright or wraps it (keep one source of truth — likely replace, migrating its tests).
- Collapse-expand re-measurement strategy for the connector overlay.
