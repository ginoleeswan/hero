# Family trees and houses

The live reference for `/house/[slug]`, the family chart, and the kinship
pathfinder. Supersedes `docs/superpowers/specs/2026-07-26-house-pages-kinship-pathfinder-design.md`,
which is the pre-implementation design and has drifted — it predates the crest,
the relation console, reigns, and the whole discovery layer. (It's also inside
`docs/superpowers/`, which `.ignore` hides from `rg`, so nothing will surface it
to you by accident.)

Two things use the same chart:

- **A character page** shows one person's relatives as a band inside a longer
  read. `app/character/[id].tsx` + `.web.tsx`.
- **A house page** is the chart as the destination, plus the thing only a house
  can do: answer "how are these two related?" `app/house/[slug].tsx` + `.web.tsx`.

## The trap: two id spaces

**This is the one that will bite you, and it fails silently.**

`hero_relatives.tree_parent_id` points at **another `hero_relatives` ROW** — not
at a hero. It's what chains a lineage: Aerys II hangs off the row for Rhaegar,
which hangs off the row for Jon.

The house page re-projects that flat graph around whoever is in focus, and the
projected members get **edge-scoped ids** — `` `${heroId}:${relatedHeroId}` `` —
because the same person appears in many people's trees. Row ids mean nothing in
that space.

The first version dropped the pointer. The chart still rendered; it just put all
sixteen of Jon Snow's forebears in the canvas's "generation unrecorded" list
while the _identical data_ drew a thirteen-tier lineage on his character page.
Nothing errored. No test caught it, because the fixtures didn't have chains.

So `get_house` resolves the pointer to the parent's **hero** id
(`tree_parent_hero_id`, via a self-join on `p.id = r.tree_parent_id and
p.hero_id = r.hero_id`), and `relativesOf` remaps it back into edge-scoped ids —
only when the parent is also one of _this_ person's relatives, or the chain
would point at an id that isn't in the list.

**If you add any consumer of `get_house`** (an OG card, a bot page, a house
index that draws charts), verify chaining against real data rather than
eyeballing the chart:

```sql
with p as (select public.get_house('targaryen') as j),
e as (select jsonb_array_elements(j->'edges') x from p),
jon as (select x from e where x->>'hero_id' = 'cv-80161')
select j1.x->>'role' role, j1.x->>'tree_parent_hero_id' tp,
       exists (select 1 from jon j2
               where j2.x->>'related_hero_id' = j1.x->>'tree_parent_hero_id') as chain_ok
from jon j1 order by (j1.x->>'tier')::int desc;
```

Every ancestor row should be `chain_ok`. Only tier-1 rows (parents, aunts,
uncles) legitimately have a null pointer.

## One verb per surface

The chart has three plausible meanings for a click — _who is this_, _centre on
them_, _how do they relate to the root_ — so guessing one silently was wrong
twice before this settled. The rule now:

| Surface                         | Click does                                |
| ------------------------------- | ----------------------------------------- |
| Chart node                      | fills the console's second seat (compare) |
| Roster row body                 | fills the console's second seat (compare) |
| Roster crosshair button         | re-roots the chart                        |
| Console seat (either)           | opens `HousePicker` for that seat         |
| Route chip (middle stops only)  | re-traces to that person                  |
| Generations chip                | re-roots the chart, back to the line view |
| Console "Centre the chart on X" | re-roots the chart                        |
| Console "Open profile"          | leaves for `/character/[id]`              |

The crosshair glyph means "centre the chart here" everywhere it appears. It is
taught once by the console's filled button, which carries it beside the words,
and then repeated silently on all fifty-four roster rows.

**The console is the only answer surface.** Everything that isn't navigation
feeds it, so there is exactly one place on the page where things happen.

`FamilyCanvas` takes an **optional** `onSelectMember`. Given, nodes report the
press back to the host; absent, they navigate to the character page. That's how
one component serves both pages — don't fork it.

Consequences worth knowing:

- The chart height is `winHeight - 340`, **not** the full viewport. Filling the
  viewport put the console off-screen, so clicking a face near the bottom of the
  chart produced an answer you couldn't see. That was the original "clicking
  does nothing" bug in a new costume.
- The roster sits _beside_ the chart above 1000px for the same reason, and
  **below that width it does not render at all**. Stacked, it put the control a
  screen and a half under the console it drives, which made every change a
  scroll down and a scroll back. `HousePicker` — a sheet over the page, opened
  by whichever seat asked, one verb per opening — replaced that round trip.

## Layout constants must agree

`NODE_W` / `NODE_H` / `CAMEO` are declared in **three** places —
`layoutFamily.ts` and both `FamilyCanvas` files — and the comment saying so is
load-bearing. `layoutFamily` computes positions from its copies; the canvases
draw from theirs. They drift, the edges stop meeting the heads.

This is why the date line **reuses the role slot** rather than adding a line:
`const secondary = role ?? member.dates`. The role is already suppressed on
lineal ancestors (the row gutter names the generation), so the slot was free and
node height never moved.

## Dates are text, never integers

`heroes.born` / `died` / `reign_start` / `reign_end` are `text`.

No two settings share a calendar. Westeros counts AC/BC from Aegon's Conquest,
Star Wars counts BBY/ABY, Marvel's sliding timescale has no canon year at all.
An `int` column forces a fabricated absolute year onto every character outside
the one setting with real dates.

So the era stays inside the value and `src/lib/family/lifespan.ts` parses what it
can. It degrades rather than guessing: a value it can't parse prints verbatim, a
missing reign end reads "Reigned from 129 AC" and never a computed span.
Counting-back eras (BC, BBY) parse **negative** so ranges don't invert.

Seeded so far: 18 Targaryen reigns, keyed by id — the house has several Aegons
and two Aerys, so a name-keyed update is a coin flip. `born`/`died` are columns
with no data yet; the rendering already handles them, so that pass is data-only.

Rhaenyra (129–130 AC) and Aegon II (129–131 AC) overlap. They ruled against each
other. Not a bug.

## Coverage, and why it's Game of Thrones only

96 heroes of ~50,500 are in a house — **0.19%**. Eight houses, all Westeros.

That isn't neglect, it's edge density: GoT characters average ~15 relationship
edges each, DC and Marvel about 2. A family chart needs a connected graph, and
most of the catalogue doesn't have one. Adding houses elsewhere means curating
relationships first, not writing more house rows.

Connected components can't define houses either — all 83 original GoT heroes
form **one** component, because the houses intermarry. Hence a curated `houses`
table plus surname-seeded membership with one-hop closure
(`20260726152000_derive_house_members.sql`).

## Discovery

Deliberate, because for a while there was exactly one route in and it was broken
on native. Don't remove these without a replacement:

- **Search** — `searchHouses` → `useUnifiedSearch` → the web palette, the web
  search page, the native search screen. Matches the **bare surname** as well as
  the stored style, since we store "House Targaryen" and people type
  "targaryen". An exact surname hit is promoted to the featured top result,
  ranked below universes so "game of thrones" still wins its own page.
- **`/house`** — the index, in the sitemap's core routes.
- **Universe / franchise pages** — `useUniverseHouses` renders a card row above
  the character grid, and nothing at all for the ~200 universes with no houses.
- **Character page** — `HouseLinks` in the family section. Both platform files.

`TopResult` is a discriminated union on purpose: adding the `house` variant made
the compiler name all four exhaustive switches that needed the case. Keep it a
union, not a string.

## Platform pairs that drift

Every one of these must exist and stay in sync — expo-router throws if a `.web`
half is missing, and nothing warns you when the two bodies diverge. `HouseLinks`
lived only in the web character page for several commits, which made the whole
feature unreachable on a phone.

- `app/house/[slug].tsx` / `.web.tsx`
- `app/house/index.tsx` / `.web.tsx`
- `app/character/[id].tsx` / `.web.tsx`
- `app/category/[slug].tsx` / `.web.tsx` (also serves `/universe` and `/franchise`)
- `app/(tabs)/search/index.tsx` / `.web.tsx`
- `src/components/family/FamilyCanvas.tsx` / `.web.tsx`

Shared logic belongs in `src/lib/family/` or `src/hooks/` so it can't diverge.
`src/components/family/` is RN-primitives-only for the same reason — the crest,
roster, console, and result rows all render on both platforms.

## Map

| Concern                           | Path                                                                  |
| --------------------------------- | --------------------------------------------------------------------- |
| Chart layout maths                | `src/lib/family/layoutFamily.ts`, `buildFamilyGraph.ts`               |
| Kinship BFS + wording             | `src/lib/family/kinshipPath.ts`, `kinshipGender.ts`                   |
| Date formatting                   | `src/lib/family/lifespan.ts`                                          |
| Name shortening in-chart          | `src/lib/family/displayName.ts`                                       |
| Generational ladder (whole house) | `src/lib/family/generations.ts`                                       |
| House payload + re-projection     | `src/hooks/useHouse.ts`                                               |
| House lists (index, universe row) | `src/hooks/useHouseList.ts`, `src/lib/db/houses.ts`                   |
| Crest, banner, console, picker    | `src/components/family/`                                              |
| RPC                               | `get_house(p_slug)` — see `20260726172000_*.sql` for the current body |

## Two views of one house

`?view=line` (default) draws one person's relatives. `?view=house` draws every
member on a generational ladder, oldest rung first.

Nothing in the data records a generation — edges only ever say what two people
are to _each other_ — so `assignGenerations` derives it: seed the most famous
member at zero, walk outward adding the offset each relation carries, rebase so
the oldest rung is 0. `ancestor` and `descendant` carry their distance in the
**role text** ("10× great-grandfather" → twelve rungs), which is the only place
it exists; `roleDepth` parses it. Relations that say nothing about generation
(`in_law`) are not walked, and anyone no chain reaches lands in `unplaced`
rather than being given an invented rung.

Breadth-first, so a house that married its cousins resolves by shortest path.
All 55 Targaryens place, in 14 rungs. Tested in
`__tests__/lib/family/generations.test.ts`.

## Not done

- `born`/`died` unseeded (columns and rendering exist).
- No OG card for a traced relation — a `?with=` link is the shareable artefact
  the pathfinder was built for, and it currently unfurls as nothing.
- No bot page for houses (`api/bot-page.ts`).
- One duplicate row: `Daemon Blackfyre` was ingested twice. Flagged, not merged —
  see `feedback_merge_destructive_caution`.
