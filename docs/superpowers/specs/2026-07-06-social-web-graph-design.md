# Relationships — the Social Web graph

**Date:** 2026-07-06
**Status:** Approved design, pre-implementation
**Scope:** A new force-directed relationship graph on the web character screen — an inline preview plus a full-screen explorer route. New DB migration + RPC (reads existing `hero_relationships`; no new tables). Web first (desktop + mobile-web); native is a later follow-up pass.

## Goal

Turn the character's relationships into an explorable **social web** — a true network graph showing not just who the subject fights/allies with, but how those figures connect to **each other**. This is Character Dossier improvement #7 (the "social-universe graph" swing floated during the original brainstorm and simplified to shelves; now built for real). It becomes the page's exploration engine: walk the universe hero to hero.

## Placement — additive

The existing **Enemies / Allies / Teammates portrait shelves stay unchanged.** The Social Web is a **new element added below them** in the relationships card:

- A compact **graph preview** (subject + ~8 strongest neighbors, settled/static).
- An **"Explore the web →"** affordance opening the full-screen explorer.

Nothing existing is removed or restyled.

## Data — new `hero_neighborhood` RPC (+ migration)

A new SQL migration adds one function that returns a hero's **ego network**: the subject, its top neighbors, and every relationship edge **among that node set** (the second-degree edges `get_related_heroes` does not expose).

```
get_hero_neighborhood(p_hero_id text, p_limit integer default 24)
returns json  -- { nodes: Node[], edges: Edge[] }
```

- **Node selection:** the subject, plus its neighbors across all three kinds (enemy/ally/teammate), ranked by `heroes.fame_score` desc, capped at `p_limit`. Node = `{ id, name, portrait_url, image_md_url, image_url, alignment, publisher, fame_score }`.
- **Edges:** every row in `hero_relationships` where **both** `hero_id` and `related_id` are in the selected node set — this yields subject↔neighbor edges *and* neighbor↔neighbor edges. Edge = `{ from, to, kind }` (`kind` ∈ enemy/ally/teammate). De-duplicate reciprocal pairs (the graph is drawn undirected; keep one edge per unordered pair, preferring a stable kind precedence enemy > teammate > ally when a pair has multiple).
- SQL `stable`, `search_path = public`, mirroring `get_related_heroes`. **RLS/grant:** `grant execute … to anon, authenticated, service_role` (per the repo lesson: without the grant + the table's public-read policy, anon silently gets `[]`).
- Regenerate `database.generated.ts` after applying (RPC return type).
- Typed fetch wrapper: `src/lib/db/heroes/neighborhood.ts` → `getHeroNeighborhood(heroId, limit?)` returning `{ nodes: NeighborNode[]; edges: NeighborEdge[] }`.

## Layout — hand-rolled force simulation (no new dependency)

`src/lib/graph/forceLayout.ts` — a pure, dependency-free force sim (~40–60 lines):

- Forces: node–node repulsion (inverse-square), link springs on edges (rest length), and a mild centering pull; subject node pinned at center.
- Run a **fixed iteration count** to settle, seeded deterministically by node id so a character's web looks the same every visit.
- Pure function `layoutNeighborhood(nodes, edges, opts) → Map<id, {x, y}>` (normalized coordinates), unit-tested for determinism + no-overlap-ish spacing + subject-centered.
- Cheap for ≤24 nodes; identical on web + native.

## Rendering — hybrid SVG edges + View nodes

One presentational approach shared by preview and explorer:

- An **SVG layer** (`react-native-svg`) draws edges as lines tinted by `kind` — **enemy red, ally warm/green, teammate blue** (reuse the shelf `ACCENT` map), subject-incident edges slightly stronger.
- **Portrait nodes** are absolutely-positioned round `HeroImage` avatars on top (blurhash placeholders, tap targets first-class). The **subject node** is centered, larger, `theme.accent`-ringed. Neighbor nodes carry a thin kind-tinted ring.
- Node labels: name on hover (web) / under the node in the explorer.

## Preview (in-page)

- Fixed ~300px band inside the relationships card, below the shelves, headed "Social Web".
- Subject + ~8 strongest neighbors, **settled and static** (sim run once at mount), springs in once on scroll (reuse `Reveal`; reduced-motion → static).
- The whole band is tappable → opens the explorer. Individual nodes need not be interactive in the preview (keeps it calm).

## Full-screen explorer — route `/character/[id]/universe`

A deep-linkable route (per `CLAUDE.md`, ships both `app/character/[id]/universe.tsx` and `app/character/[id]/universe.web.tsx`; web is the built target this pass, the native file is a thin placeholder/redirect until the native pass). Rationale over a modal: shareable URL, working back button, router-native. The segment is **`universe`**, not `web` — a route literally named `web` collides with the `.web.tsx` platform-suffix convention.

**Implementation note (verify first):** expo-router must accept the file `app/character/[id].tsx` coexisting with the folder `app/character/[id]/` (nested route under the same dynamic segment). Confirm this resolves at the very start of the explorer task with a trivial stub route; if expo-router rejects the mix, fall back to a distinct top-level route `app/social-web/[id].tsx` (+ `.web.tsx`). Do **not** use `/universe/[id]` — the existing `/universe/[slug]` publisher route would collide.

- Loads `get_hero_neighborhood(id, 24)` — the fuller web, accent-themed to the entry subject.
- **Gestures:** pan + pinch-zoom over the canvas (web: wheel/trackpad zoom + drag; `react-native-gesture-handler` on the eventual native pass).
- **Tap a node → navigate** to that character's dossier (`/character/[nodeId]`), exiting the explorer.
- **Tap-to-recenter (approved):** a distinct affordance (e.g. long-press, or a small "center on this" control on node focus) re-runs the ego network around the tapped node — internal `focusId` state refetches `get_hero_neighborhood(focusId)` and re-lays-out, **without changing the route** (the entry id stays the captured URL). This is the walk-the-universe engine.
- Chrome: title `{focusName}'s universe`, an edges legend (enemy/ally/teammate), a back affordance, accent glow to the focused subject.

## New units

| Unit | Responsibility |
| --- | --- |
| migration `*_hero_neighborhood.sql` | `get_hero_neighborhood` RPC over `hero_relationships` |
| `src/lib/db/heroes/neighborhood.ts` | typed `getHeroNeighborhood` fetch |
| `src/lib/graph/forceLayout.ts` | pure force-sim `layoutNeighborhood` (unit-tested) |
| `src/components/web/character/SocialWebGraph.tsx` | shared SVG-edges + View-nodes renderer (preview + explorer use it) |
| `src/components/web/character/SocialWebPreview.tsx` | in-page band wrapping the renderer + "Explore →" |
| `app/character/[id]/universe.tsx` + `universe.web.tsx` | full-screen explorer route (focusId state, gestures, recenter) |

## Data flow

Character screen already has the subject id. Preview fetches `getHeroNeighborhood(id, 8)` (or reuses already-loaded related heroes for the nodes and fetches only the edge set — implementation detail; the RPC returning both is simplest). Explorer fetches `getHeroNeighborhood(focusId, 24)` per focus. React Query cache keyed by `['neighborhood', focusId, limit]`.

## Error / edge handling

- **Sparse hero** (few/no relationships): preview shows subject + whatever neighbors exist; if fewer than ~2 neighbors, render **nothing** (the shelves already covered them) — no lonely single-node graph.
- **Missing portraits:** node falls back to a monogram avatar (reuse the shelf `monogram` helper).
- **RPC error / empty:** preview renders nothing; explorer shows a graceful empty state and a back affordance. Never a broken canvas.
- **Anon users:** read-only graph works (public-read); navigation works; no write actions involved.

## Platform

Web first (desktop + mobile-web), verified via device screenshots. Native explorer (gesture-handler pan/zoom, perf pass) is a **separate follow-up** — `SocialWebGraph` is built RN-primitive + `react-native-svg` so the renderer is reusable; only the gesture/route shell is web-specific this pass.

## Testing

Per `CLAUDE.md`, no full-screen render tests. Unit-test pure logic:

- `layoutNeighborhood` — determinism (same input → same positions), subject pinned at center, all nodes within bounds, no two nodes closer than a min distance for a small fixture. `__tests__/lib/graph/forceLayout.test.ts`.
- Edge de-dup / kind-precedence logic if extracted as a pure helper (reciprocal pair → one edge; multi-kind pair → precedence). `__tests__` alongside.
- No tests for the RPC SQL beyond a manual `execute_sql` smoke check during implementation.

## Guardrails

- Reads existing `hero_relationships`; **no new tables**, no writes.
- New RPC must have the anon/authenticated grant or anon silently gets `[]`.
- Never Flame-Bold; `StyleSheet.create`; explicit widths on any aspect-ratio nodes (WebKit collapse).
- `SocialWebGraph` stays RN-safe (no `<img>`, no CSS-string-only styling) so native can reuse it.

## Delivery — phased, each landing on main

1. **Data:** migration + `get_hero_neighborhood` RPC, `neighborhood.ts` fetch, regenerate types, MCP smoke test.
2. **Layout + renderer:** `forceLayout.ts` (+ tests), `SocialWebGraph` renderer.
3. **Preview:** `SocialWebPreview` wired into the relationships card below the shelves.
4. **Explorer:** `/character/[id]/universe` route — full graph, pan/zoom, tap-navigate, tap-to-recenter.
5. Screenshot verify (desktop + iOS Safari). Native explorer deferred to its own pass.
