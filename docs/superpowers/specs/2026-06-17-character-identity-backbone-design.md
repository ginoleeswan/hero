# Character Identity & Source Backbone — Design (Spec #1)

**Date:** 2026-06-17
**Status:** Approved (design); implementation plan to follow.
**Scope:** The first sub-project of a larger program to turn _mythique_ from a
ComicVine-rooted superhero catalogue into a general catalogue of **all fictional
characters** across any medium.

---

## 1. Context & vision

mythique today models its core entity as `heroes`, identified primarily by a
ComicVine id. The catalogue has already grown beyond that framing — it holds
villains, supporting cast, and non-comic figures (e.g. Looney Tunes). The
long-term vision is to catalogue **all fictional characters** regardless of
origin medium (comics, manga, anime, video games, film, TV, literature,
mythology, folklore, original).

That vision demotes ComicVine from "the trunk" to "one source among many" and
makes **Wikidata the identity reconciliation _hub_** — not the data trunk
(Wikidata is sparse for the long tail; ~3,100 catalogued characters currently
have no QID), but the place where a single match hands us every other source's
id for free (P5905 → ComicVine, P4086 → MAL/AniList, etc.).

This is a program of work, decomposed into five sub-projects:

1. **Identity & source backbone** — _this spec_.
2. Wikidata-spine ingestion for _new_ characters of any medium (external-id
   property crawler).
3. New source adapters (AniList/MAL for anime, IGDB for games, …).
4. People / creators pipeline (normalized people table; P5905 `4040-` matching).
5. Discovery & UI (medium/role facets in search; app-wide "hero" → "character"
   copy and route changes).

Each gets its own spec → plan → build cycle. This spec locks the irreversible
modelling decisions the other four ride on, while keeping the blast radius small.

## 2. What a "character" is (the definition)

**A character is one notable fictional figure that earns its own page** — the
unit a user searches for, opens, favourites, and throws into a matchup. From
that, everything else follows:

- **"Hero" and "villain" are role _tags_, not what the entity is.** Batman, the
  Joker, Commissioner Gordon and Porky Pig all share one table wearing different
  role tags. This is exactly why `heroes` is the wrong name.
- **Aliases are alternate _names for the same page_, never separate entries.**
  "Batman" is the page; "Bruce Wayne / Dark Knight / Caped Crusader" are aliases
  (search synonyms + display strings). Hard rule: **an alias never creates or
  splits a character.**
- **The person-vs-mantle tangle is deliberately NOT schema.** Bruce Wayne-the-man
  vs Batman-the-mantle, or the four people who've been Robin — that ontology
  lives in the existing **relationships graph** (`hero_relationships`) when it
  matters, not in a first-class persona/identity table. YAGNI.

### 2.1 Identity grain (the one modelling fork)

**Separate page per distinct figure.** Peter Parker and Miles Morales are two
character pages (same display name is fine — disambiguated by aliases/publisher).
Each notable Robin is its own page. **Versions of the _same_ figure** (Earth-616
Peter vs MCU Peter) stay **one page**.

This grain matches how every identity source already issues ids and how users
favourite/matchup figures. **Accepted cost:** it pushes an entity-resolution
burden to ingest time ("new figure vs another incarnation"). We do not solve this
with cleverness — we **trust each source's own grain** and lean on the existing
manual merge tooling (`find_duplicate_heroes` / `admin_merge_heroes`).

## 3. Source model

### 3.1 Two classes of source

The domain has a hard law, exposed by TMDB: some sources have character
entities; some do not.

- **Identity sources** — have a stable character id we can reconcile on; appear
  in `character_sources`. Today: `comicvine`, `wikidata`, `superhero_api`.
  Future: `anilist`, `igdb`.
- **Appearance sources** — have _no_ character entity (a TMDB "character" is just
  a credit string on a person within one title's cast); contribute only
  titles/credits and feed the existing `titles` / media-appearances layer.
  Today: `tmdb`. **Structurally barred from creating characters.**

### 3.2 Sources are selectable + toggleable; adapters stay code

"Where we ingest from" is a first-class, operator-controlled choice (required by
the multi-medium vision — you can't find an anime character in ComicVine). The
`sources` table makes each source a declared, toggleable entity, and
`ingest_character` (§5) means every source writes the same way.

**The line we hold:** the `sources` table is a **registry of deployed adapters**,
not a no-code source builder. Every real API needs a code adapter (auth,
pagination, schema, id format). Adding a new source = deploy an adapter + seed a
`sources` row. Field-level **precedence** on conflicts stays a **coded default**;
because we snapshot each source's raw payload (§4.2), precedence can be
re-derived later without re-ingesting — so making it configurable is cheap _if_
ever wanted, but is out of scope now.

## 4. Data model

### 4.1 The character entity

Physically still the `heroes` table this spec (see §6 rename note); new code
speaks "character" via a `db/characters.ts` facade. Existing columns stay; we add:

- `origin_medium` _(text, single-valued)_ — where the character **originated**:
  `comics · manga · anime · video_game · film · tv · literature · mythology ·
  folklore · original`. The new top-level axis that makes "all fictional
  characters" coherent. Single value = the _first_ medium.
- `roles` _(text[], many-valued)_ — `hero · villain · antihero · supporting · …`.
  Role tags, not identity.
- `aliases` — unchanged (alternate names for the same page).

### 4.2 `character_sources` (canonical id store)

| column         | meaning                                              |
| -------------- | ---------------------------------------------------- |
| `character_id` | FK → the character (`heroes.id`)                     |
| `source`       | FK → `sources.source` (`comicvine`, `wikidata`, …)   |
| `external_id`  | that source's id (`4005-1443`, `Q79037`)             |
| `url`          | canonical page on that source                        |
| `data` (jsonb) | raw payload snapshot from that source                |
| `fetched_at`   | when we pulled it                                    |

- **`unique(source, external_id)`** — one source-entity maps to exactly one
  character (powers idempotent ingest + dedup).
- Index on `character_id`.
- The raw `data` snapshot is the cheap on-ramp to real provenance: the merged
  character row can be **re-derived** from its sources later, without committing
  to heavyweight field-level provenance now.

### 4.3 `sources` (reference / registry)

| column         | meaning                                              |
| -------------- | ---------------------------------------------------- |
| `source` (pk)  | `comicvine`, `wikidata`, `superhero_api`, `tmdb`, …  |
| `kind`         | `identity` \| `appearance`                           |
| `label`        | human display name                                   |
| `enabled`      | boolean — operator on/off switch                     |
| `id_format`    | doc/validation hint for `external_id`                |
| `url_template` | builds `url` from `external_id`                      |

Seed: comicvine/wikidata/superhero_api = `identity`; tmdb = `appearance`;
anilist/igdb may be seeded `identity` + `enabled=false` until their adapters land.

### 4.4 Single source of truth (no drift)

`character_sources` is **canonical**. The legacy `comicvine_id` / `wikidata_qid` /
`superhero_api_id` columns on `heroes` become a **derived compatibility
projection** maintained by a trigger off `character_sources`, so the ~40 existing
RPCs that read those columns keep working untouched. **No code writes the legacy
columns directly.** They are deprecated and removed on a later pass once RPCs
migrate to read `character_sources`.

## 5. Ingestion integrity & command-center continuity

### 5.1 One primitive, many adapters

All identity-source ingestion funnels through a single internal RPC:

```
ingest_character(source, external_id, attrs, url, data) -> character_id
```

Guarantees:

- **Atomic** — character row + `character_sources` row in one transaction (never
  a half-ingested character).
- **Idempotent** — `ON CONFLICT (source, external_id)` updates, never duplicates.
- **Reconciliation-aware** — on insert, fires the hub hook (§5.3); if a discovered
  external id already belongs to _another_ character, it is flagged as a **merge
  candidate** (surfaced to existing dedup tooling), never silently linked.

### 5.2 Command-center Add flow is preserved

`admin_add_comicvine_heroes` becomes a **thin wrapper** over `ingest_character`.
The command-center "Add heroes · ComicVine" flow's contract and UX are
**unchanged**: `cv-search`, the inline preview, bulk-add, and the returned
`{ heroId, comicvineId }` shape all stay identical — only the write layer beneath
generalizes. **Acceptance gate:** re-run the end-to-end Add → Build verification
(the Razorback-style check) after the refactor.

The Build pipeline (ComicVine enrich → Wikidata resolve [P5905 path] →
appearances → TMDB) is **untouched** — it already operates on character ids,
which do not change.

### 5.3 Reconciliation (the hub in action)

When a character has a `wikidata` source row, its Wikidata external-id properties
(P5905 → ComicVine, P4086 → MAL/AniList, IGDB, …) yield other sources' ids → we
insert those `character_sources` rows. One QID unlocks the rest. _The actual
property-crawler is Spec #2; this spec defines only the write path and the
trigger/hook it uses._

## 6. Migration steps (all additive — nothing breaks)

1. `sources` reference table + seed rows.
2. `character_sources` table (unique, FK, indexes) + **RLS** enabled. Access is
   via SECURITY-DEFINER RPCs; add a public-read policy only if the client ever
   reads it directly (it does not in this spec). _(New tables get RLS
   auto-enabled; without a policy anon reads 0 rows — intentional here.)_
3. Backfill `character_sources` from the three existing id columns.
4. Trigger: `character_sources` → legacy columns (compat projection); route all
   writes through `character_sources` / `ingest_character`.
5. Add `origin_medium` + `roles` columns; backfill (`origin_medium='comics'` for
   the current all-comic catalogue; `roles` from existing hero/villain signals).
6. `ingest_character` RPC; refactor `admin_add_comicvine_heroes` to wrap it.
7. Extend `admin_merge_heroes` to relocate `character_sources` rows
   (conflict-safe under the unique constraint).
8. `db/characters.ts` TS facade over `db/heroes.ts`.
9. Regenerate `database.generated.ts`.

### 6.1 Rename note

We do **not** physically rename `heroes` → `characters` in this spec. New code
speaks "character" via the TS facade; the physical rename (40+ RPCs, RLS
policies, realtime channels, types, components) is a separate, purely-cosmetic
spec — deferred and optional. This keeps the valuable, irreversible modelling
shipping now without bundling a large risky rename.

## 7. Testing

- **Compat trigger** — writing/updating/deleting a `character_sources` row keeps
  the matching legacy column in lockstep; deleting the comicvine source nulls
  `comicvine_id`.
- **Idempotent ingest** — re-ingesting the same `(source, external_id)` updates
  in place, no duplicate character.
- **Merge relocation** — merging two characters relocates `character_sources`
  rows and resolves unique-constraint collisions deterministically (keep one).
- **Backfills** — every existing `comicvine_id`/`wikidata_qid`/`superhero_api_id`
  produces exactly one `character_sources` row; `origin_medium`/`roles` backfill
  is correct.
- **Add-flow acceptance** — end-to-end Add → Build still works and yields the same
  shape (Razorback-style check).

## 8. Scope boundaries (explicitly OUT of this spec)

- Physical `heroes` → `characters` table rename (later cosmetic spec).
- New non-comic source adapters — AniList/IGDB/etc. (Spec #3).
- The Wikidata external-id property crawler for _new_ characters (Spec #2).
- People / creators pipeline (Spec #4).
- Discovery/UI medium+role facets and app-wide copy rename (Spec #5).
- Field-level provenance engine (the raw `data` jsonb is only the on-ramp).
- UI-configurable source precedence and any no-code source registry.
- person/mantle ontology (lives in the relationships graph).

## 9. Decisions log

- Vision = **all fictional characters**, any medium.
- Character = a page; roles = tags; aliases never split; grain = **separate page
  per distinct figure** (versions of one figure = one page).
- Wikidata = reconciliation **hub**, not data trunk; internal id stays the PK.
- Sources split into **identity** vs **appearance** (TMDB is appearance-only).
- `character_sources` is **canonical**; legacy id columns = derived compat
  projection (no drift).
- Sources are **selectable + toggleable**; adapters stay **code**; precedence =
  coded default (re-derivable via raw snapshots).
- Ingestion via one **atomic, idempotent, reconciliation-aware** primitive;
  command-center Add flow preserved and re-verified.
- Physical table rename **deferred** behind a TS facade.
