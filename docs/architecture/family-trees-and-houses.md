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

## Adding a house

A house is two inserts: one `houses` row (slug, name, universe, words, seat,
`sigil_tint`, blurb, position) and its `house_members` rows (`via` is
`'surname'` or `'kin'`). The tree draws itself from `hero_relatives` — there is
no per-house graph to build.

Four rules learned the hard way seating twenty-two of them:

1. **Pin members by hero id, never by name.** There are nine heroes called
   "Hunter" across six publishers and six called "Crystal". A name join seats
   the wrong person silently.
2. **Curate from the relation type, not from graph reach.** Two hops out from
   Magneto pulls in the whole Inhuman royal family and Onslaught (a psychic
   fusion recorded as `other`). Franklin Richards' godparents are recorded with
   relation `parent`, which draws the Thing onto the parents row.
3. **Prefer the row that carries the kinship over the row with the fame.**
   Duplicates are common: Elastigirl and Dash both have a higher-fame row with
   zero relations, and seating those draws five people who know nobody.
4. **Don't ship a house whose members have no recorded kin between them.** It
   renders the empty state. Cassel, Umber, Manderly, Reed, Royce, Seaworth,
   Tallhart and Payne are all waiting on relations, not on a house row.

**Check the kinship before you build on it.** Batman (hero `69`) had Terry
McGinnis's parents recorded as his own — the tell was a parent row whose role
was "biological father" and whose name was _Bruce Wayne_. The two heroes'
outbound relatives were hung on the wrong owner, while every inbound edge
(Alfred, three Robins) was correct. Fixed in
`20260727110000_unswap_batman_kinship.sql`, which moves sixteen rows by explicit
id and documents its own reversal.

Deep `ancestor` rows with no `tree_parent_id` land in the chart's "generation
unrecorded" list. That is the honest treatment where the succession order isn't
recorded — see House of Atlan, which leaves fourteen forebears unplaced on
purpose rather than inventing a line of descent.

## Coverage

218 heroes of ~50,500 are in a house — **0.43%**. Twenty-six houses across five
universes: fourteen in Westeros, plus El, Wayne, Atlan, Allen, Wakanda,
Richards, Maximoff, Xavier, Summers, Odinson, Skywalker and the Parrs.

That number stays small for a reason, and it isn't neglect: a family chart needs
a connected graph, and edge density is wildly uneven. GoT characters average ~15
relationship edges each; DC and Marvel about 2. Adding houses elsewhere means
curating relationships first, not writing more house rows.

**But check whether it's already written down.** Skywalker, Odinson, Summers and
Themyscira all turned out to be fully recorded in `hero_relatives` as free text
with `related_hero_id` left null, so the graph couldn't see any of it. Luke's
sibling row read "Princes Leia" — one letter short — which is the only reason
the most famous brother and sister in cinema were not connected. Resolving an
existing record beats authoring a new one every time: look for unlinked rows
whose `name` matches a hero before deciding a family is missing.

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
  The row lands on **ink** on web and on the **beige sheet** on native, so the
  web file passes `tone="ink"` and native takes the `paper` default — see below.

  **The band is one row and stays one row.** Game of Thrones charts fourteen
  houses; wrapped, that pushed 323 characters — what the page is _for_ — two
  screens down. Web computes `housesPerRow` from the band's own width (the same
  arithmetic flex-wrap would do, run ahead of it) and shows that many, with a
  "Show all N" disclosure for the rest; houses arrive biggest-first from
  `listHousesForUniverse`, so the row is the houses that carry the world. Native
  needs no cap — its row is a sideways-scrolling rail, which already costs the
  grid nothing. If you change the card width, change `HOUSE_CARD_W` in
  `app/category/[slug].web.tsx` with it or the cap and the wrap disagree.
- **Character page** — `HouseLinks` in the family section. Both platform files.

### The house card is cut from its surface

`HouseCard` (`src/components/family/HouseIndex.tsx`) is a **hanging banner**: a
field washed with the house's `sigil_tint` carrying the crest, a hairline
division, then a plinth with the name, the motto — or the **seat**, for a house
with no words, so the line never goes blank and drops that card's name a whole
line below its neighbours — and the member count. It takes
a `tone` — `paper` (default) or `ink` — and every colour on it is that tint
blended into the host surface, so the same component sits down on the universe
page's ink floor and on the parchment index without either being special-cased.

Three things are load-bearing and easy to undo:

- **`tone` must match the host.** The card used to be a flat white plate, which
  on the ink universe page made twelve rectangles brighter than the character
  grid they were introducing. If you add a third host, pass the tone it sits on
  rather than letting it default.
- **`carryable()` floors the tint's luminance on ink.** Greyjoy's `#1f2d3a` is
  within a hair of `deepNavy`; a plate blended from it is an _invisible_ card,
  not a subtle one. Any new house with a near-black sigil depends on this.
- **The field wash is backed off in proportion to the tint's luminance.**
  Baratheon's gold at the same strength as Targaryen's red goes olive over deep
  navy — a colour that house does not own. Drop `soften` and the pale tints muddy.

`HouseCrest`'s `outline` prop exists for the same reason: the beige edge that
lifts the shield off an ink band is the same value as a parchment plate, so the
crest loses its contour there. On `paper` the edge is cut from the tint instead.

Card geometry is mirrored in `HouseIndexSkeleton` — change one, change both, or
the crests reflow when the query settles.

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
