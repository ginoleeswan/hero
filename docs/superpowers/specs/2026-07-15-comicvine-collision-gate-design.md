# ComicVine collision gate — publisher plausibility check (#65)

**Status:** spec, ready to execute
**Priority:** 4 of 4 in the 2026-07-15 hardening batch (see `2026-07-15-hardening-execution-plan.md`)
**Closes:** [#65](https://github.com/ginoleeswan/hero/issues/65)
**Size:** medium-large (1 PR: two edge functions + migration + admin queue panel)

## Problem (from #65, confirmed in code)

`enrich-comicvine-batch` matches heroes to ComicVine by **exact lowercased name
only** and takes the most-published hit — no franchise/publisher plausibility
check. Observed 2026-07-13: hand-curated **Aragorn** (publisher
`'J. R. R. Tolkien'`) was matched to ComicVine id 6810 — a **Marvel winged
horse** — which overwrote `publisher, summary, image_url, powers, description,
origin, issue_count, creators, enemies, friends, movies, teams, first_issue_*`
and reported `comicvine_status='done'`. A wrong match is indistinguishable from
a right one; nothing flags it.

Not actively spreading (pending queue is currently drained), but every future
ingestion batch re-arms it, and there is **static historical debt** (~80
suspicious rows by the smell test below).

## The exact bug locus (two hand-duplicated "drift-twins" — keep in sync)

1. `supabase/functions/enrich-comicvine-batch/index.ts:148-165` (the 6-hourly
   cron drain; batch selection at `:380-386` pulls
   `comicvine_status='pending'` ordered by `issue_count`).
2. `supabase/functions/get-comicvine-hero/index.ts:157-178` (live per-view
   fallback — byte-identical decision block).

Both do: filter results to exact name equality (fallback: name-before-`(`
equality) → sort by `count_of_issue_appearances` desc → take `[0]` →
unconditionally `'done'`. The search `field_list` is only
`id,name,count_of_issue_appearances` — **publisher isn't even fetched at
decision time** (it arrives on the later detail call, after commit:
`enrich-comicvine-batch:178`, `get-comicvine-hero:200`).

## Design

### 1. Shared matcher: `supabase/functions/_shared/comicvineMatch.ts` (NEW)

Kill the drift-twin problem: extract ONE matcher both functions import
(`_shared/` already exists). Signature:

```ts
export type MatchDecision =
  | { kind: 'match'; cvId: string }
  | { kind: 'needs_review'; reason: string }
  | { kind: 'unmatched' };

export function pickComicvineMatch(
  results: Array<Record<string, unknown>>, // CV /characters list results
  hero: { name: string; publisher: string | null },
): MatchDecision;
```

Both call sites change their list-call `field_list` to
`id,name,count_of_issue_appearances,publisher` (CV returns publisher as an
object with `.name` — same shape already read post-detail at
`enrich-comicvine-batch:178`).

Decision rules (in order):

1. Exact-name filter (existing logic: trim/lowercase equality, else
   base-before-`(` equality). Empty → `unmatched` (unchanged).
2. **Publisher gate.** Normalize both sides with a small
   `normalizePublisher()`: lowercase, strip punctuation, and collapse known
   aliases — at minimum `marvel*→marvel`, `dc*→dc`, `dark horse*→dark horse`,
   `image*→image`. Comparison = normalized equality OR one side containing the
   other (`'marvel'` vs `'marvel comics'`).
   - Hero has a publisher AND ≥1 candidate agrees → keep only agreeing
     candidates, sort by popularity, `match` on `[0]`.
   - Hero has a publisher AND **no** candidate agrees → `needs_review`
     (reason: `publisher mismatch: hero=<p> cv=<top candidate p>`). **Never**
     auto-apply a disagreeing match — this is the Aragorn case.
   - Hero has NO publisher (null / `'Company-Licensed'` / `'Creator-Owned'` —
     the unbranded sentinels from `20260714143052_index_unbranded_worklist.sql`):
     single exact candidate → `match`; multiple candidates with **different**
     normalized publishers → `needs_review` (reason: `ambiguous: N same-name
     candidates`); multiple with the same publisher → `match` on most popular.
3. When `hero.comicvine_id` is already set (the `if (cvId)` branch), the gate
   does not run — an explicit id is trusted (that's how admin resolution works,
   see §4).

### 2. New status: `needs_review`

- Migration: extend the `heroes_comicvine_status_check` CHECK constraint
  (introduced `20260612130000`, last widened `20260618120000`) to
  `('pending','done','empty','failed','unmatched','needs_review')`. Add a
  partial index matching the house pattern
  (`20260713140000_index_heroes_comicvine_status_pending.sql`):
  `create index … on heroes (comicvine_status) where comicvine_status = 'needs_review';`
- `enrich-comicvine-batch`: add `'needs_review'` to `EnrichOutcome`
  (`index.ts:76`), update the status-semantics comment block (`:66-75`), and on
  that outcome write `comicvine_status='needs_review'` **without touching any
  other column**. Count it in the `enrichment_runs` live counters the way
  `unmatched` is counted today.
- `get-comicvine-hero` (live path): on `needs_review`, set the status (so the
  admin queue sees it) and return `NULL_RESPONSE` exactly like `markUnmatched()`
  does — the character page renders un-enriched, no user-visible error.
- Rows in `needs_review` must NOT be re-picked by the drain (batch selection
  only pulls `pending`/`failed` — already true; verify).

Apply via `mcp__supabase__apply_migration`; regenerate
`src/types/database.generated.ts` after.

### 3. Admin review queue — the human decision surface

Reuse the **NeedsYou pattern**
(`src/components/admin/health/domains/NeedsYou.tsx` — the wikidata ambiguous
resolver: candidate rows with inline accept + manual-ID escape hatch). New
panel `ComicvineReview` in the same domain area (wire it wherever the
enrichment pipeline panels live — `PipelinesDomain.tsx` — matching how
NeedsYou/DuplicatesPanel are surfaced).

- List: heroes with `comicvine_status='needs_review'` (id, name, publisher,
  portrait via `HeroThumb` from `atoms.tsx`).
- Candidates: fetch live via the existing `cv-search` edge function (no new
  candidates table — same approach as NeedsYou's live `fetchWikidataEntities`).
  Show name, publisher, issue count, deck.
- Actions per hero:
  - **Accept candidate** → set `comicvine_id=<picked>`,
    `comicvine_status='pending'` → the drain enriches it by explicit id on its
    next pass (trusted-id branch, no gate).
  - **Manual ID** input → same write.
  - **Not on ComicVine** → `comicvine_status='unmatched'` (terminal; the
    interim guardrail already uses this for hand-curated rows).
- Writes go through `src/lib/db/` (new module or extend the existing admin
  catalog-health module — follow how `NeedsYou` persists its resolution), and
  must be admin-gated the same way (`is_admin` RPC pattern per
  `ReviewDomain.tsx`).

### 4. One-time audit of historical debt

In the same migration (or a follow-up SQL via MCP), flag the smell-test rows
for human review in the new queue instead of a spreadsheet:

```sql
update heroes set comicvine_status = 'needs_review'
where comicvine_status = 'done'
  and id not like 'cv-%'
  and publisher in ('Marvel Comics', 'DC Comics')   -- adjust to actual values: check `select distinct publisher` first
  and franchise is not null;
```

**Before running:** verify the predicate against prod (`select count(*)` ≈ 80
per #65) and eyeball 5 rows. This does NOT revert their data — it just surfaces
them in the queue; the human either re-accepts (status back to `done` via
accept → pending → drain re-enriches from the confirmed id) or corrects. Rows
the admin confirms wrong get the Aragorn treatment (accept correct id, or
`unmatched` + manual data repair — data repair itself is out of scope here).

## Non-goals

- Fixing CV-sourced *content* pollution on correct matches (Gandalf's
  friends-array crossover noise) — that's CV's data, different problem.
- A confidence-score model. Publisher agreement is the 95% gate; the queue
  catches the rest.
- Reverting/repairing historical wrong rows automatically.

## Tests

The matcher is now a pure importable function — unit-test it in Deno or port a
mirror to jest if edge-function testing is awkward; minimum coverage:

- Aragorn case: hero publisher `J. R. R. Tolkien`, single Marvel candidate →
  `needs_review` (NOT match).
- Agreement: hero `Marvel Comics` + candidates from Marvel and DC → picks the
  Marvel one even if the DC one is more published.
- Alias: hero `Marvel` vs CV `Marvel Comics` → agree.
- No-publisher hero + single candidate → match; + multi-publisher candidates →
  `needs_review`; + same-publisher candidates → most popular.
- No exact hit → `unmatched`.

## Acceptance criteria

1. Re-running the Aragorn scenario yields `needs_review`, zero columns written.
2. A normal unambiguous hero (e.g. a Marvel hero with one CV hit) still
   enriches `done` in one drain pass — throughput unharmed.
3. The admin queue lists `needs_review` rows with live CV candidates; accepting
   one leads (after the next drain pass) to `done` with the chosen id.
4. `get-comicvine-hero` on a mismatch: character page loads un-enriched, row
   flagged `needs_review`, no error surfaced to the user.
5. Historical smell-test rows appear in the queue (count sanity ≈ 80).
6. Both functions import the shared matcher — the duplicated decision blocks
   are deleted. Deployed via `mcp__supabase__deploy_edge_function`.
7. Migration applied via MCP + types regenerated; `yarn test:ci` green.
