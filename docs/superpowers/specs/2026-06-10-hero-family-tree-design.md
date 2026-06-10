# Hero Family Tree — Design Spec

**Date:** 2026-06-10
**Status:** Approved (design), pending implementation plan
**Platforms:** Web (desktop + mobile web) and Native — full parity

## 1. Summary

Turn the flat `heroes.relatives` free-text string into a **beautiful, generational family
tree** on the character page. The raw string is parsed, classified, and linked **once
upstream** into a normalized `hero_relatives` table; both client renderers read clean,
joined rows. Relatives that have their own character page render as tappable mini hero
cards (portrait + power badge) that navigate through; everyone else is a quiet text node.

The chosen layout is **Generational Tiers** (hero anchored in the middle, generations
stacked above/below, spouse tied beside the hero, same-generation row below).

## 2. Why upstream normalization

`heroes.relatives` is a single messy free-text string, e.g.:

> `Bruce Wayne (biological father), Warren McGinnis (father, deceased), Mary McGinnis (mother), Matt McGinnis (brother)`

Parsing this on every render, on two platforms, would duplicate fragile logic and pay the
cost repeatedly. Instead we parse/classify/link **once** into a normalized table (the same
spirit as the existing `backfill-enemies` job). The character page then does near-zero work
and both platforms share identical structured data. A normalized table (vs. a JSONB column)
was chosen deliberately to support complex joins, reverse lookups, and a feature-rich,
joinable experience.

**Key constraint that shapes the layout:** the source only tells us each person's relation
to *the hero*, never to each other. We therefore cannot draw true genealogy edges between
relatives. The honest, beautiful form is a **hero-centric generational chart** — relatives
positioned by their generation relative to the hero, not connected to one another.

## 3. Data model

### 3.1 Schema

```sql
create type relation_kind as enum (
  'parent','child','sibling','spouse','grandparent','grandchild',
  'aunt_uncle','niece_nephew','cousin','in_law','ancestor','clone','other'
);

create table hero_relatives (
  id              uuid primary key default gen_random_uuid(),
  hero_id         uuid not null references heroes(id) on delete cascade,
  name            text not null,                 -- parsed display name
  alias           text,                          -- e.g. "Kara Zor-El"
  role            text not null,                 -- raw role, e.g. "adoptive father"
  relation        relation_kind not null,        -- normalized classification
  tier            smallint not null,             -- generation offset (see 3.2)
  modifiers       text[] not null default '{}',  -- {adoptive},{step},{foster},{half},{great}
  status          text,                          -- deceased | estranged | formerly | null
  related_hero_id uuid references heroes(id) on delete set null,  -- resolved link
  position        int not null default 0,        -- preserves source order
  created_at      timestamptz not null default now()
);
create index hero_relatives_hero_id_idx on hero_relatives (hero_id);
create index hero_relatives_related_hero_id_idx on hero_relatives (related_hero_id);
```

- `heroes.relatives` (raw string) stays as the **source of truth**; `hero_relatives` is
  **derived** and fully rebuildable by the backfill at any time.
- Migration filename: `supabase/migrations/<YYYYMMDDHHMMSS>_create_hero_relatives.sql`.
- Apply via `mcp__supabase__apply_migration`, then regenerate
  `src/types/database.generated.ts` via `mcp__supabase__generate_typescript_types`
  (never edit by hand — per CLAUDE.md).

### 3.2 Tier model

`tier` is the generation offset from the hero, used directly for vertical layout:

| tier | meaning | `relation` values |
|---|---|---|
| +2 | ancestors / grandparents | `grandparent`, `ancestor` |
| +1 | elders | `parent`, `aunt_uncle` |
|  0 | hero's generation | `spouse`, `sibling`, `cousin`, `in_law`, `other` |
| −1 | descendants | `child`, `niece_nephew` |
| −2 | grandchildren | `grandchild` |
|  9 | aside (not a generation) | `clone` |

The hero itself is not a row in `hero_relatives`; the renderer injects the subject hero at
tier 0.

### 3.3 Read API

`getHeroFamily(heroId)` in `src/lib/db/heroes.ts` performs the enrichment join:

```sql
select hr.*,
       h.id    as linked_id,
       h.name  as linked_name,
       h.image as linked_image,
       h.power_total as linked_power,   -- exact column name confirmed at impl time
       h.alignment   as linked_alignment
from hero_relatives hr
left join heroes h on h.id = hr.related_hero_id
where hr.hero_id = $1
order by hr.tier desc, hr.position;
```

Returns an array of `FamilyMember` rows already enriched with linked portrait/power/
alignment, so renderers need no further fetches. (Implemented with a PostgREST embedded
select on the FK, or a small RPC if the embed is awkward — decided during planning.)

## 4. Parsing & classification (the hard logic)

Pure TypeScript, **no React Native / Expo imports**, living in `src/lib/family/`:

- `src/lib/family/types.ts` — `RelationKind`, `ParsedRelative`, `FamilyMember`, `FamilyTier`.
- `src/lib/family/parseRelatives.ts` — `parseRelatives(raw: string): ParsedRelative[]`.
- `src/lib/family/classifyRole.ts` — `classifyRole(role: string): { relation, tier, modifiers, status }`.

These modules are **unit-tested with the existing jest-expo harness** and **also imported by
the backfill edge function** (single source of truth). Risk: Deno ↔ `src/` import friction.
**Fallback:** if the edge function cannot cleanly import from `src/`, copy the two pure
modules into `supabase/functions/_shared/family.ts`; tests still cover the `src/` originals,
and a tiny parity test asserts the copy stays in sync (or a build step copies it).

### 4.1 Parsing rules

1. Split the raw string on `,` and `;` into entries. (Note: commas also appear *inside*
   parentheses — see step 3 — so split at the top level, treating parentheses as protected
   regions.)
2. For each entry, extract `Name (inner)` where `inner` is the parenthetical content.
   - `name` = text before the first `(`, trimmed.
   - If no parentheses: `name` = whole entry, `role` = `''` → classifies as `other`.
3. Inside `inner`, the **role is the last comma-segment**; everything before it is the
   `alias`. E.g. `Pietro Maximoff (Quicksilver, son)` → name `Pietro Maximoff`,
   alias `Quicksilver`, role `son`. `Supergirl (Kara Zor-El, cousin)` → alias `Kara Zor-El`,
   role `cousin`.
4. Pull `status` keywords out of the role text separately: `deceased` (→ ✝), `estranged`,
   `formerly`/`ex`, `alleged`/`allegedly`, `presumably`. Status does not change tier.
5. Trim, drop empties and sentinel junk (`-`, `null`, ``).
6. Preserve original order in `position`.

### 4.2 Classification

Lowercase the role and match against an **ordered keyword table** (first match wins) to
assign `relation` + `tier`, and collect `modifiers` (`great`, `grand`, `adoptive`, `step`,
`foster`, `half`, `in-law`):

- `great-grand*` / `ancestor` → `ancestor`, tier +2
- `grand*` (grandfather/mother/parent) → `grandparent`, tier +2
- `father` / `mother` / `parent` (+ adoptive/step/foster mods) → `parent`, tier +1
- `aunt` / `uncle` → `aunt_uncle`, tier +1
- `wife` / `husband` / `spouse` (+ ex → status formerly) → `spouse`, tier 0
- `brother` / `sister` / `sibling` (+ half/foster/adopted mods) → `sibling`, tier 0
- `cousin` → `cousin`, tier 0
- `*-in-law` → `in_law`, tier 0
- `son` / `daughter` (+ foster/adopted/step mods) → `child`, tier −1
- `niece` / `nephew` → `niece_nephew`, tier −1
- `grandson` / `granddaughter` / `grandchild` → `grandchild`, tier −2
- `clone` / `duplicate` / `genetic` / `alternate` → `clone`, tier 9
- anything unmatched → `other`, tier 0 (never silently dropped)

### 4.3 Known messy cases (must be handled gracefully, never crash)

- Semicolon-separated clusters (Deadpool, Alfred).
- 30–40 `ancestor` entries (Aquaman) → all stored; UI collapses (see 6.3).
- Nested/prefixed grouping like Venom's `"Eddie Brock: ... ; Venom symbiote: ..."` →
  best-effort parse; unparseable fragments fall to `other` rather than throwing.
- Encoding artifacts (`T?Chaka`, `Fianc?e`) → stored/displayed **as-is**; no repair attempt.
- Pure non-family (`girlfriend`, `fiancée`) → `relation = other`; rendered as a quiet
  footnote, not a tier (see 6.3).

## 5. Backfill job

`supabase/functions/backfill-family/index.ts` — a resumable batch job modeled on
`backfill-enemies`:

- Reads `heroes` (id, name, relatives) in popularity order, batched (`limit`, default ~60).
- For each hero: `parseRelatives` → `classifyRole` → resolve each member's `name` and
  `alias` against the roster (chunked `.in('name', …)`, matching the `backfill-enemies`
  resolver) to fill `related_hero_id`.
- Writes idempotently: `delete from hero_relatives where hero_id = $1`, then bulk insert
  the fresh rows. (Safe to re-run for any hero.)
- Modes (POST body): `{}` → only heroes with no `hero_relatives` rows yet (additive);
  `{ refresh: true }` → rebuild regardless; `{ limit }` → batch size.
- No external API needed — pure transform of data we already own.

## 6. UI — the Family card

### 6.1 Placement & structure

- A dedicated **`Family` card** in the character page body column, alongside Abilities /
  First Appearance. **Removes** the existing "Relatives" row from the Quick Facts side rail
  (web `app/character/[id].web.tsx`) and from the native dossier (`app/character/[id].tsx`).
- Card header: `FAMILY` eyebrow (orange) + count line ("N relatives · M on Mythique").
- Renders nothing (card hidden) when the hero has zero parsed relatives.

### 6.2 Components

- `src/components/family/buildTiers.ts` — pure: groups `FamilyMember[]` into ordered
  `FamilyTier[]` (by `tier` desc), splits `clone`/non-family asides, computes the collapse
  set. Unit-tested.
- `src/components/family/FamilyTree.web.tsx` — web renderer: tiers as centered flex rows,
  connector spine between tiers, spouse tied beside the hero anchor.
- `src/components/family/FamilyTree.tsx` — native renderer: same model, RN primitives;
  tiers stack and wrap; horizontally scrollable rows when a tier overflows.
- Both are **pure presentation** fed by `buildTiers`; no parsing, no fetching.

### 6.3 Node & interaction design

- **Linked node** (`related_hero_id != null`): portrait avatar (hero `image`) + name + role,
  teal **power badge**, alignment-tinted accent; tappable → `/character/[related_hero_id]`.
  Hover lift on web; pressable feedback on native.
- **Plain node**: quiet text node (name + role). Deceased → dimmed + ✝.
- **Hero anchor**: dark node at tier 0 center; **spouse** tied directly beside it with an
  orange connector. Siblings flank on the hero row.
- **Overflow collapse**: any tier/group beyond a threshold (e.g. > 6, tuned per platform)
  collapses trailing items into a **"+N more"** chip that expands in place. Targets large
  `ancestor` groups.
- **Non-family footnote**: `other`-classified pure-relationship entries (girlfriend, etc.)
  shown as a small footnote line under the tree, not as a generation.

### 6.4 Aesthetic

App canvas beige `#f5ebdc`, card `#fffdf8`, squircle radii, `Flame-*`/`FlameSans`/`Nunito`
fonts per CLAUDE.md, orange accent for spouse tie + eyebrow, teal for the power badge. Match
the existing card/skeleton patterns on the character page (including a skeleton state for the
Family card consistent with the other body cards).

## 7. Data flow

```
heroes.relatives (raw string, source of truth)
        │  backfill-family (parseRelatives → classifyRole → resolve links)
        ▼
hero_relatives (normalized, linked)
        │  getHeroFamily(heroId)  ── left join heroes ──► enriched FamilyMember[]
        ▼
buildTiers(FamilyMember[]) → FamilyTier[]
        ▼
FamilyTree.web.tsx / FamilyTree.tsx  (pure render; linked nodes navigate)
```

## 8. Testing

- `parseRelatives` — unit tests over real fixtures from the DB sample (Batman, Superman,
  Spider-Man, Aquaman 30+, Deadpool semicolons, Venom nested, Two-Face non-family, encoding
  junk). Assert names/aliases/roles/status extracted correctly and nothing crashes.
- `classifyRole` — table-driven tests for every `relation_kind` + modifier combinations.
- `buildTiers` — tiering order, collapse thresholds, spouse/sibling placement, asides.
- No screen/navigation rendering tests (per CLAUDE.md testing policy).

## 9. Out of scope (future, enabled by the schema)

- Reverse "appears in N families" surfacing on the related hero's page.
- Shared-relative / family-cluster / dynasty queries.
- Manual curation overrides for mis-parsed entries.

## 10. Open implementation details (resolve during planning, not blockers)

- Exact `heroes` column names for the enrichment join (`image`, `power_total`, `alignment`)
  confirmed against `database.generated.ts`.
- PostgREST FK embed vs. dedicated RPC for `getHeroFamily`.
- Whether the backfill imports `src/lib/family/` directly or uses the `_shared` copy
  fallback (§4).
- Per-platform collapse threshold tuning.
```
