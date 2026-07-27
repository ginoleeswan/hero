# Relationship blurbs — design

**Date:** 2026-07-27
**Status:** approved, ready for planning

## Problem

Tapping a character in another character's orbit on `/social-web/[id]` opens
`SocialWebFocusCard`. The card's best line is the relationship blurb — a written
note on what these two actually are to each other. There are **36 of them**.

Everything else falls back to `describeRelationship()` in
`src/lib/graph/relationshipReason.ts`, which composes a templated line from
shared teams and mutual-connection count:

> "An enemy of Batman, with 7 mutual connections in common."

That is honest but inert, and it is what nearly every tap produces today.

The 36 that exist set the bar:

> "Norman Osborn is his best friend's father, which is why Spider-Man kept
> pulling the punch — until the Goblin took Gwen Stacy off a bridge. That is the
> line the rivalry never came back from."

## Goal

Take written blurbs from 36 to roughly 3,000, covering the marquee and mid-tier
pairs a reader is actually likely to open, without inventing a single one.

## Measurements taken 2026-07-27

Pair counts, deduplicated to unordered pairs (a blurb is keyed on the pair, so
one row serves both directions):

| Pool | Pairs |
| --- | --- |
| Written today | 36 |
| Both fame ≥ 60 | 6,221 |
| Both fame ≥ 40 | 16,409 |
| One ≥ 60, other ≥ 20 | 39,687 |

Non-teammate (family + enemy + ally) only:

| Min fame | family | enemy | ally | total |
| --- | --- | --- | --- | --- |
| ≥ 60 | 71 | 1,764 | 1,998 | 3,833 |
| ≥ 50 | 87 | 1,902 | 2,140 | 4,129 |
| ≥ 40 | 140 | 3,983 | 5,119 | 9,242 |

Of the 3,833 at ≥ 60, **3,058 are same-publisher** and 775 are cross-publisher.

### Why the queue cannot be fame-ranked alone

Sampling the fame-ranked ≥ 60 non-teammate list by position:

| Rank | Pair | Kind | Assessment |
| --- | --- | --- | --- |
| 1 | Batman · Wonder Woman | ally | real |
| 200 | Ant-Man · Hulk | ally | real |
| 500 | Rocket Raccoon · Venom | ally | not a relationship |
| 1400 | Black Panther · Colossus | ally | weak |
| 2000 | Peacemaker · Optimus Prime | ally | data artifact |
| 2600 | Human Torch · Mary Jane | ally | real |
| 3600 | Iron Fist · Electro | enemy | thin |

`hero_relationships` is derived entirely from the free-text `heroes.enemies`,
`heroes.friends` and `heroes.teams` arrays, resolved by name in
`rebuild_hero_relationships()`. Those arrays carry ComicVine's noise, so a
meaningful share of high-fame pairs are not relationships at all. This matches
the existing relationship-relevance-ceiling finding.

**Consequence:** the queue selects candidates; it does not certify them. Every
pair is judged at writing time, and a decline must be recordable — otherwise the
queue never drains and the same junk resurfaces every session.

## Design

### 1. Schema — three outcomes, one table

`hero_relationship_blurbs` today models only success. Migration:

```sql
alter table public.hero_relationship_blurbs
  alter column blurb drop not null,
  add column status text not null default 'written'
    check (status in ('written', 'no_relationship', 'nothing_to_say')),
  add column note text;
```

| Status | Meaning | Blurb |
| --- | --- | --- |
| `written` | A true, specific note exists. Renders on the card. | present |
| `no_relationship` | The edge is a ComicVine artifact; these two are not connected. | null |
| `nothing_to_say` | Real connection, nothing specific to add beyond the fallback. | null |

Existing constraints on the table, confirmed 2026-07-27, that the migration must
respect:

- `PRIMARY KEY (hero_a, hero_b)` plus `CHECK (hero_a < hero_b)` — pair identity
  and ordering are already structural. Callers key on `least`/`greatest`.
- `CHECK (char_length(blurb) between 20 and 320)` — **survives the nullability
  change unaltered.** `char_length(null)` is null, and a CHECK rejects only on
  false, so skip rows with a null blurb pass. No edit needed.

The `no_relationship` rows are a curated denylist of bad edges — a second,
durable product of this work. **They are recorded but not yet consumed.**
Feeding them back into `rebuild_hero_relationships()` to suppress edges is a
separate change with its own blast radius and is explicitly out of scope here.

`get_hero_neighborhood` must gain `and bl.status = 'written'` on its
`hero_relationship_blurbs` join, so a skip row yields null (and therefore the
templated fallback) rather than blanking the line.

### 2. Queue — a view, not a frozen list

```text
hero_relationship_blurb_queue:
  edges from hero_relationships (source <> 'curated') + hero_relatives,
    deduplicated to unordered pairs, kind = min(family, enemy, ally)
  where kind is not teammate
    and both characters fame_score >= 60
    and publishers match
    and the pair has no row in hero_relationship_blurbs (any status)
  order by (fame_a + fame_b) desc
```

**3,058 pairs**, minus the 36 already written.

Teammate edges are excluded on purpose: those edges exist *because* the two
share a named roster, so `describeRelationship()` already emits a true and
specific line ("Served alongside Storm in the X-Men"). A written blurb there
mostly restates what the fallback says.

Cross-publisher pairs are excluded because at this fame level they are
overwhelmingly name-collision artifacts (Peacemaker · Optimus Prime). Genuinely
notable cross-universe pairs are rare and can be added by hand.

Widening later is a threshold edit. Measured sizes of the same-publisher,
non-teammate queue at each fame gate: **≥ 60 → 3,058**, ≥ 50 → 3,312 (+254),
≥ 40 → 7,871 (+4,813). Re-admitting cross-publisher at ≥ 60 adds 775. Decide
after the observed decline rate at ≥ 60.

### 3. Writing contract

Derived from the 36 existing rows, which are the style reference:

- **125–220 characters.** One or two sentences.
- **Names both characters.** The card renders the same row on both characters'
  pages, so it must read correctly from either end. No bare pronouns, no
  assuming which page the reader is on.
- **One concrete, checkable fact.** A relationship, an event, an origin.
- **Present tense** for standing facts; past tense only for a specific event.
- **No hype vocabulary** — no "iconic", "legendary", "epic", "fan-favourite".
- **Not a plot summary.** The note explains the pair, not the storyline.
- `author = 'claude'`, `verified = false`, matching the existing rows.

**The decline rule is load-bearing:** if there is no specific true fact to state
about the pair, record `no_relationship` or `nothing_to_say`. Never write a
sentence that merely sounds right. A declined pair keeps today's templated line,
which is honest. Declining is a success state, not a failure.

### 4. Draining the work

Each batch: read the next ~100 rows from the queue view, write or decline each,
emit a single migration file of inserts. Resumable by construction — the view
excludes every pair already recorded, so a later session reads the view and
continues with no bookkeeping. Roughly 30 batches.

### 5. Reverse-edge fix (folded in)

`get_hero_neighborhood` builds its candidate set from **outgoing edges only**:

```sql
from public.hero_relationships r
where r.hero_id = p_hero_id
```

So a character nobody's arrays point *out* from gets an empty universe page even
when many characters point *at* them. Measured:

| Hero | Outgoing | Incoming | Union |
| --- | --- | --- | --- |
| Sherlock Holmes | 0 | 5 | 5 |
| Harry Potter | 0 | 10 | 10 |
| Dracula | 0 | 70 | 70 |
| Spider-Man | 133 | 544 | 561 |
| Batman | 135 | 2,782 | 2,792 |

**1,468 heroes** have zero outgoing edges but at least one incoming edge or kin
link — a blank page that the data could already fill.

A naive union is not acceptable. Measured on Batman with `explain analyze`:

| Candidate strategy | Candidates scored | Execution |
| --- | --- | --- |
| Naive union of outgoing + incoming | 2,792 | **2,928 ms** |
| Outgoing + top-150 incoming by rank | 241 | **10 ms** |

Anon `statement_timeout` is 3s, so the naive version would time out the
highest-traffic universe page in the app. The cost is one `heroes_pkey` lookup
per candidate at ~1ms under the free-tier IO ceiling.

The fix, therefore, has two parts:

1. **Bound the reverse pull** — `order by r.rank asc limit 150`. `rank` is the
   subject's position in the other character's list, so rank 1 means the subject
   is that character's top enemy: a genuine relevance signal, not an arbitrary
   cut.
2. **Prefer outgoing** — carry an `is_out` flag through `cand` and `scored`, and
   sort by `is_out desc` first in both the per-kind window and the final order.
   A character's own stated cast outranks people who merely name them.

Together these leave Batman's page byte-identical (135 outgoing candidates fill
all 24 slots) while Dracula's fills from his 70 incoming edges.

## Non-goals

- Suppressing junk edges from the graph using the `no_relationship` denylist.
  Recorded now, consumed later.
- The 75 characters at fame ≥ 20 with no edges in either direction (Pennywise,
  Willy Wonka, Katniss, Walter White). Almost all are non-ComicVine, so their
  arrays were never populated by any pipeline. Sourcing connections for them is
  a separate ingest problem.
- Teammate-pair blurbs.
- Changing `SocialWebFocusCard`. It already prefers `blurb ?? summary`.

## Testing

- `describeRelationship()` is pure and already unit-testable: assert a pair with
  a skip row still yields the templated summary, so a decline degrades to the
  fallback rather than to an empty card.
- SQL assertion: no row with `status = 'written'` has a null blurb (enforced by
  a CHECK constraint) or one under **125** characters — the contract floor,
  asserted per batch rather than constrained, since the database check permits 20.
- No duplicate-pair test is needed: `PRIMARY KEY (hero_a, hero_b)` and
  `CHECK (hero_a < hero_b)` make it structurally impossible.
- Re-run the two `explain analyze` timings above after the RPC change and
  confirm Batman stays under ~50ms and Dracula returns a non-empty node set.
