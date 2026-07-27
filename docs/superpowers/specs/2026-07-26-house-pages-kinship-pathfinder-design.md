# House pages and the kinship pathfinder

**Date:** 2026-07-26
**Status:** SHIPPED and superseded (2026-07-27 correction — this line
originally said "approved, implementing"). The design drifted during build
(predates the crest, relation console, reigns, discovery layer); the live
reference is `docs/architecture/family-trees-and-houses.md`. The
guess-the-relation game (C) remains unbuilt and unspecced.
**Scope:** house pages (A) + kinship pathfinder (B) + re-rooting (D), Game of Thrones only.
The daily guess-the-relation game (C) is deliberately a separate spec, built on this one.

## Why

The family tree is the most distinctive thing in the app and it is not a feature.
It is a band inside `character/[id]` plus a fullscreen modal, with no URL of its
own — it cannot be linked, shared, or found. 487 heroes have a tree at all, and
only 206 of the 1,043 characters with a fame score above 40.

The measured state of the kinship graph decides the scope:

| Universe | heroes in graph | edges | edges/hero |
| --- | --- | --- | --- |
| Game of Thrones | 110 | 1,666 | 15 |
| DC | 269 | 532 | 2 |
| Marvel | 194 | 440 | 2 |

Game of Thrones has a real dynasty because it was derived
(`20260726140000_targaryen_dynasty_tree`). Everything else averages two links per
character — free-text scraps, not trees. **83 of the 110 GoT heroes sit in one
connected component**, so a path exists between almost any two of them. That is
what makes a pathfinder possible here and nowhere else yet.

So: ship it where it is genuinely excellent, and let it be the template.

## What we are building

A destination at `/house/[slug]` whose hook is answering "how are these two
related?", and whose navigation model is walking the bloodline by re-rooting.

```
/house/targaryen                          the house
/house/targaryen?focus=<heroId>           re-rooted on one character
/house/targaryen?focus=<a>&with=<b>       the kinship path between two, lit
```

The last URL is the shareable artefact. Every state the user can reach is
addressable, which is what makes it worth an OG card.

## Data model

### `houses` — curated

One row per house. Hand-written, because these pages are meant to read as
authored rather than generated: real house words, a real seat, a real sigil
colour.

| column | type | example |
| --- | --- | --- |
| `slug` | text, pk | `targaryen` |
| `name` | text | House Targaryen |
| `universe` | text | Game of Thrones |
| `words` | text, null | Fire and Blood |
| `seat` | text, null | Dragonstone |
| `sigil_tint` | text, null | `#8c1c13` |
| `blurb` | text, null | one sentence |
| `position` | int | ordering on the index |

`universe` matches `heroes.publisher`, the existing universe column.

### `house_members` — derived once, then hand-correctable

| column | type |
| --- | --- |
| `house_slug` | text, fk → houses |
| `hero_id` | text, fk → heroes |
| `via` | text — `surname` or `kin`, how they were picked up |

Populated by migration in two passes:

1. **Surname seed** — heroes in the universe whose name ends with the house name
   (`… Targaryen`).
2. **One hop of closure** — heroes joined to a seed by a lineal or spouse edge in
   `hero_relatives`.

One hop is the bound that matters. It picks up Jon Snow as both a Stark and a
Targaryen — correct, and the single most interesting fact in the dataset — and
it picks up married-in members like Catelyn Stark. It stops before dragging the
whole 83-node component into every house, which is what unbounded closure or
connected-component clustering would do. (Components were evaluated and
rejected: Targaryen, Stark, Baratheon and Lannister are interlinked by marriage,
so clustering yields "Westeros", not houses.)

Membership is stored rather than computed so it is inspectable and a wrong
member is fixed by editing a row, not by tuning a heuristic.

### `get_house(slug)` RPC

Returns house meta, member hero rows (id, name, portrait/avatar/image, alignment,
gender, fame_score), and the `hero_relatives` edges among those members.

The whole Westeros graph is ~110 nodes and 1,666 edges — about 40KB. It ships
once and every subsequent interaction is local: re-root, pathfind and hover cost
nothing. This is why the pathfinder can be interactive rather than a round-trip
per query.

Needs a public read policy — RLS is on by default and without one anon reads
zero rows and the RPC returns empty silently.

## Kinship pathfinding

Pure module, `src/lib/family/kinshipPath.ts`, no I/O:

```ts
findKinshipPath(graph, fromId, toId): KinshipStep[] | null
describeKinship(steps): { headline: string; chain: string }
```

Breadth-first over the undirected edge set, so the path returned is the shortest
one. Each step carries the relation that got you there.

**Labelling.** A path composes into a single relation for the short cases people
actually name — parent, sibling, grandparent, aunt/uncle, cousin, nth
great-grandparent. Beyond that, composition stops being a word anyone uses, so
the headline degrades honestly to "distant kin, N steps" and the chain carries
the detail:

> **Daenerys is Jon Snow's aunt**
> Jon Snow → his father Rhaegar Targaryen → his sister Daenerys Targaryen

Rendering the chain always, and the headline only when a real word exists, keeps
it truthful. A composed label for a seven-step path would be inventing a word.

## Canvas changes

The existing `FamilyCanvas` gains two optional props and no new concepts:

- `focusId` — which member the tree is rooted on. Clicking a node sets it,
  writes `?focus=` and re-lays out. Crossfade rather than node tweening;
  full transition animation is a large lift for a small gain.
- `pathIds` — the set on the lit kinship path. Members on it keep full weight;
  everything else drops to the collateral treatment already built. The existing
  lineal/collateral weighting is reused rather than a new highlight style
  invented.

## Share and discovery

- `api/og.tsx` gains a `house` card and a `relation` card. The relation card —
  two portraits and the headline — is the artefact that gets posted.
- Bot pages already exist for character/title/team/vs; houses join them, and the
  sitemap gains `/house/*`.

## Error handling

| case | behaviour |
| --- | --- |
| unknown slug | 404 through the existing not-found path |
| `focus` not a member | ignored, falls back to the default root |
| `with` not a member | ignored, no path drawn |
| no path between two members | "no recorded connection" — honest, given 27 of 110 sit outside the main component |
| RPC failure | existing React Query error surface |

## Testing

Pure logic gets unit tests; screens do not, per the repo's testing rule.

- `findKinshipPath` — direct relation, multi-hop, no path, shortest-path when two
  routes exist, self-path.
- `describeKinship` — each named case, and the honest degradation past them.
- house membership derivation is verified by SQL against the migrated data
  (Jon Snow in both Stark and Targaryen; no house containing the whole component).

## Deliberately not in scope

- The daily guess-the-relation game. Needs streak state and a daily-content
  pipeline; its own spec.
- Deriving kinship for Marvel/DC families. The template is this release; the
  House of El and the Summers tangle come after it is proven.
- Node-level transition animation on re-root.
