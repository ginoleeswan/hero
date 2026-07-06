# Social Web Explorer v3 — enrichments (identity, atmosphere, filters, search)

**Date:** 2026-07-06
**Status:** Approved design, pre-implementation
**Scope:** Four enrichment layers on the v2 explorer (`app/social-web/[id].web.tsx` + `[id].tsx`, `SocialWebGraph`, `SocialWebCanvas`). Web + native (shared components). No schema changes; reuses the shipped `get_hero_neighborhood` data.

## Goal

v2 made the explorer interactive and atmospheric. v3 makes it **legible and alive**: you can tell who everyone is (names + a focus detail card), the canvas feels like a living universe (starfield + flowing edges + hover lift), you can declutter a dense web (legend filters), and you can find and jump to anyone (search + shared-connection highlighting).

## 1. Identity — names + focus card

**Node names.** Currently nodes are anonymous portraits.

- **Web:** hovering a node reveals a name chip beneath it (small, ink-dark pill, `INK_TEXT` label). The **subject** and the **focused** node always show their name chip (no hover needed).
- **Native:** no hover — the subject always shows its name; focusing a node shows the focused node's + its neighbors' names. (Names for every node at once would be noise on a phone.)

**Focus detail card.** Replaces the small "Open ▸" chip from v2 (same job, richer). When a node is focused, a compact card animates in (bottom-left on web, bottom sheet-ish on native) with:

- The hero's portrait (round), name (Flame), and an **alignment badge** (Hero/Villain/Anti-Hero — semantic color, reuse the character-page alignment logic).
- A line: **"N connections in this web"** (its degree within the current neighborhood).
- A relationship-to-subject tag ("Enemy of {subject}") tinted by kind.
- A **"View dossier →"** button → `/character/{id}` (accent-colored).
- Dismisses when focus clears (re-tap the node, or tap the card's close).

The card is the primary navigation affordance now; the on-node Open chip is removed.

## 2. Atmosphere — starfield, living edges, hover lift

- **Starfield:** a faint field of small dots/stars on the ink canvas behind the graph (SVG `Pattern` of tiny low-alpha circles, like `FamilyCanvas`'s dot pattern but sparser and cooler-toned), fixed in the **viewport** (not transformed) so it reads as deep space behind the panning graph.
- **Living edges:** the subject-incident edges get a subtle **energy flow** — an animated `strokeDashoffset` on a thin overlaid dashed line per subject edge, looping slowly (reanimated shared value → animated `Line`, so it works web + native). Only subject edges animate (perf + focus); neighbor-neighbor edges stay static. Under `prefers-reduced-motion`, no flow.
- **Node hover lift (web):** nodes scale up slightly + halo brightens on hover (Pressable `hovered`), easing via `HOVER_TRANSITION`. No-op on native.

## 3. Legend filters — declutter

The Enemy / Ally / Team legend chips become **tappable toggles** (default all on).

- State `activeKinds: { enemy: boolean; ally: boolean; teammate: boolean }` lives in the screen, passed to `SocialWebCanvas` → `SocialWebGraph`.
- **Edges** of an inactive kind are hidden.
- **Nodes** whose relationship-to-subject kind is entirely inactive are dimmed (opacity ~0.15) and non-interactive, so the web visibly thins to the chosen relationship(s). The subject always stays full.
- A toggled-off chip renders muted (hollow), so the legend doubles as the control + the key.

## 4. Search + shared connections

- **Search:** a small search field in the header (web) / a search affordance opening an input (native) that filters the **current neighborhood's** node names. Selecting a result **focuses** that node (same as tapping it) and pans the camera to center it (animate `tx/ty` to the node's position). Typing filters a dropdown list of matching names with tiny portraits.
- **Shared connections:** when a node is focused, nodes connected to **both** the focused node **and** the subject get a brighter "shared" treatment (a second, warmer ring or a small link glyph) — surfacing "who they both know." This folds into the existing focus dim/lit tiers as a third tier: focused + directly-connected = lit; of those, also-connected-to-subject = shared (brightest); rest = dim.

## Architecture / units

| Unit | Change |
| --- | --- |
| `src/components/character/socialWebFocus.ts` | Add `sharedWithSubject(edges, subjectId, focusId): Set<string>` (nodes adjacent to both) — pure, unit-tested. |
| `src/components/character/SocialWebGraph.tsx` | Props gain `activeKinds`, name-chip rendering (hover/subject/focused), living-edge animation on subject edges, starfield backdrop is drawn by the canvas (below), shared-tier ring, hover lift. Remove the Open chip. |
| `src/components/character/SocialWebCanvas.tsx` | Renders the fixed starfield behind the transformed graph; exposes a `focusId` + `centerOn(id)` imperative (or lifts focus/center state up); passes `activeKinds` through. |
| `src/components/character/SocialWebFocusCard.tsx` (new) | The focus detail card (portrait, name, alignment, degree, relation, View button). Shared. |
| `src/components/character/SocialWebSearch.tsx` (new) | Search field + results dropdown over the current nodes. Shared; web/native chrome differences kept minimal. |
| `app/social-web/[id].web.tsx` / `[id].tsx` | Own `activeKinds` + interactive legend toggles + search wiring + render the focus card. |

**State ownership.** Focus and camera-center become shared between the canvas (gestures) and the screen (search, card). Lift `focusId` and a `centerOnId` signal to the screen; the canvas receives `focusId` + an `onCenterConsumed` and drives the transform. Keep the boundary clean: the canvas owns the *camera transform*; the screen owns *which node is focused/searched*.

## Data flow

Unchanged data source. All new behavior is view state over the loaded neighborhood: names/degree/shared/filters are derived from the in-memory `nodes`/`edges`. Degree = count of edges incident to a node. Alignment comes from `node.alignment` (already in the RPC payload).

## Error / edge handling

- **Filters that hide everything:** if all three kinds are off, show the subject alone + a hint "All relationships hidden." Never a blank canvas.
- **Search no match:** dropdown shows "No one by that name here."
- **Reduced motion:** no living-edge flow, no entrance, static starfield.
- **Focus card on a sparse/edge case:** degree 0 shows "No other links here."

## Testing

Per `CLAUDE.md`, no full-screen render tests. Unit-test pure logic:

- `sharedWithSubject(edges, subjectId, focusId)` — returns nodes adjacent to both; empty when focus is the subject or shares nothing. `__tests__/components/socialWebFocus.test.ts` (extend).
- `nodeDegree(edges, nodeId)` helper if extracted (count incident edges) — test in the same file.
- Everything else (chips, card, starfield, search UI, filter dimming) is view-layer — device screenshots.

## Guardrails

- Reuse v2 data/renderer/canvas; shared components stay RN-safe (svg + gesture-handler + reanimated; hover/`wheel` `Platform`-guarded).
- One *additional* looping animation allowed (the subject-edge energy flow) beyond the subject pulse — both reduced-motion gated; nothing else loops.
- Never Flame-Bold; `INK_TEXT` on ink; `StyleSheet.create`.

## Delivery — phased, each landing on main

1. **Names:** node name chips (hover/subject/focused) in `SocialWebGraph`.
2. **Focus card:** `SocialWebFocusCard` + wire focus state up to the screen; remove the Open chip; add `sharedWithSubject` + shared-tier ring (+ tests).
3. **Atmosphere:** starfield backdrop + living subject edges + node hover lift.
4. **Legend filters:** interactive legend toggles + `activeKinds` dimming.
5. **Search:** `SocialWebSearch` + center-on-select camera animation.
6. Screenshot verify (desktop + iOS Safari + native) each phase; iterate.
