# Search Relevance & Ranking

**Date:** 2026-06-27
**Status:** Approved design

## Problem

The search palette buries canonical results. Observed:
- "super" → *Super Duper, Super‑Hip, Super‑Man, Super‑Rex* — **Superman not visible**.
- "spider" → four literal **"Spider"** rows + a **1‑member team** — **no Spider‑Man**.

## Diagnosis (grounded in the live DB)

1. **`heroes.fame_score` is 100% populated and well-calibrated** (Superman 100,
   Spider‑Man 100, Supergirl 97, every deep‑cut ≤ 2) — and **search ignores it**.
2. **`search_heroes` orders by `… similarity → issue_count`.** Trigram similarity
   to "super" is *higher* for short junk ("Super‑Rex") than for "Superman", and
   similarity sits **above** popularity — so junk wins.
3. **Exact-tier dominates fame.** Literal "Spider" (exact, fame 2) outranks
   Spider‑Man (prefix, fame 100) because exact match is the top sort key.
4. **Client `rankResults`** ([core.ts](../../../src/lib/db/heroes/core.ts)) re-imposes
   strict match-tiers on the RPC output — a *second* source of the same bug, and it
   would undo any RPC fix.
5. **Teams** order by `popularity` only with no relevance tier and no member floor,
   so a **1‑member "team"** can lead.

## Design — blended, fame-weighted ranking

Score every hero as **`match_tier × W + fame_score`** (W = 40), so a vastly more
famous result can jump one relevance tier, while a better match still wins between
equally-famous names.

| match tier | base |
| --- | --- |
| exact name (`name ilike q`) | 4 |
| prefix (`name ilike q%`) | 3 |
| contains in name (`name ilike %q%`) | 2 |
| full_name / alias contains | 1.5 |
| trigram-only (typo) | 1 |

Worked check (W=40): literal "Spider" exact/obscure = `4·40+2 = 162`; **Spider‑Man**
prefix/famous = `3·40+100 = 220` ✅. "Super‑Rex" prefix/obscure = `121`; **Superman**
prefix/famous = `220` ✅. Two equally-famous names still order by tier (exact > prefix).

### Changes

1. **Migration — rewrite `search_heroes`** (same signature, same return columns →
   no `database.generated.ts` regen). New tail:
   ```sql
   order by
     (case
        when h.name ilike search_query then 4
        when h.name ilike search_query || '%' then 3
        when h.name ilike '%' || search_query || '%' then 2
        when coalesce(h.full_name,'') ilike '%' || search_query || '%'
          or public.heroes_aliases_text(h.aliases) ilike '%' || search_query || '%' then 1.5
        else 1
      end) * 40 + coalesce(h.fame_score, 0) desc,
     h.issue_count desc nulls last,
     h.id
   ```
   (Empty query → all rows tier 2 → fame-ordered browse, an improvement.)

2. **Drop the client re-sort.** [useHeroSearch.ts](../../../src/hooks/useHeroSearch.ts)
   sets `results = res` (trust the RPC). Remove the now-unused `rankResults`
   (+ its test) if nothing else imports it.

3. **Teams (client-side, no migration).** [searchTeams](../../../src/lib/db/teams.ts):
   - add `.gte('member_count', 2)` (drop ≤1-member junk),
   - fetch a pool (`limit 40`) ordered by `popularity`,
   - re-rank with a pure `rankTeams(rows, q)` — exact > prefix > contains on name,
     popularity preserved within a tier (stable sort) — then slice to the caller's
     limit.

### Non-goals

- **No hard de-dupe** of identical names (the four "Spider"s are distinct
  characters) — fame ordering buries them; publisher-subtitle disambiguation is
  part of the separate *visual* pass.
- No change to the section layout / labels (also the visual pass).

## Testing

- `__tests__/lib/db/teams.test.ts` — `rankTeams`: exact > prefix > contains;
  popularity tiebreak; `searchTeams` applies the member floor + RPC pool.
- Live SQL validation after the migration: `super → Superman`, `spider → Spider‑Man`,
  `bat → Batman`, `aveng → Avengers`(team) first.
- Full `yarn typecheck && yarn test:ci`.

## Rollout

Apply migration → validate with SQL → ship client changes → verify.
