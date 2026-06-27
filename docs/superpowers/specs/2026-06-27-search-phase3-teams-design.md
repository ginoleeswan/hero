# Smarter Search — Phase 3: Teams

**Date:** 2026-06-27
**Status:** Approved design (supersedes the earlier "deferred" draft)
**Depends on:** Phase 1 (universes) + Phase 2 (titles), both shipped

## Reframing — teams are already a first-class entity

The earlier draft assumed teams had no searchable representation. That was wrong.
A normalized **`teams` table already exists** (2,442 rows), built from the
`heroes.teams[]` tags for the Versus/Arena battle feature:

| column | type | notes |
| --- | --- | --- |
| `id` | text | stable team id |
| `name` | text | "Avengers", "X-Men", "Justice League of America"… |
| `publisher` | text | "Marvel" / "DC Comics" / … |
| `logo_url` | text | mostly null today |
| `member_count` | int | roster size |
| `popularity` | bigint | clean ordering — Avengers, X-Men, JLA, Defenders… on top |
| `is_featured` | bool | canonical teams (used by the Versus daily battle) |

Membership resolves through the existing **`get_team_roster(p_team_id, p_limit)`**
RPC (wrapped by `getTeamRoster` in `src/lib/db/teams.ts`), returning `RosterHero`
rows with `id, name, portrait_url, image_url` (+ stat fields).

So searching teams is now as simple as searching titles. The only real gap: teams
have **no standalone browse page** — they live only inside the Versus flow today.

## Goals

- Typing a team name ("avengers", "x-men") surfaces a **Teams** section in search,
  on web (palette + results page) and native.
- Tapping a team opens a new **`/team/[id]`** roster page: the team's members as a
  hero-card grid.
- Curation: popularity order, **no filtering** (v1) — minor noise like
  "X-Gene Mutant" is acceptable; the big real teams dominate by popularity.

## Non-goals

- No team logos work (column is mostly null; rows fall back to a wordmark tile).
- No filters/sort/infinite-scroll on the team page — teams are small (≤~300
  members, usually <100); one fetch is enough.
- No changes to the Versus/Arena team-battle feature.

## Architecture

Two parts. **Part 1 (the destination) ships first** because search links to it.

### Part 1 — Team browse page `/team/[id]`

A thin, standalone screen (NOT folded into the source-aware category screen —
teams use the RPC roster path, not the heroes-table filter path the category
hooks use, and need none of its filters).

| Unit | Path | Responsibility |
| --- | --- | --- |
| `getTeamById(id)` | `src/lib/db/teams.ts` (add) | One row → `TeamSummary { id, name, publisher, logo_url, member_count }`. Degrades to `null`. |
| `getTeamMembers(id, limit)` | `src/lib/db/teams.ts` (add, thin) | `getTeamRoster(id, limit)` at `limit=300` → member hero cards (`RosterHero[]`). |
| `useTeamPage(id)` | `src/hooks/useTeamPage.ts` (new) | Platform-neutral. Fetches summary + members in parallel; returns `{ team, members, loading, notFound }`. |
| `TeamScreen` | `app/team/[id].tsx` + `app/team/[id].web.tsx` (new) | Thin views over `useTeamPage`. Navy stage (team name, `member_count` + publisher eyebrow) + member grid → `/character/[id]`. Both files required by expo-router. |

`TeamSummary`:
```ts
export interface TeamSummary {
  id: string;
  name: string;
  publisher: string | null;
  logo_url: string | null;
  member_count: number;
}
```

The two view files reuse the existing visual language (navy stage + beige sheet +
compact hero grid card from `app/category/[slug].tsx`). The hero-grid card markup
is small; replicate it locally rather than extracting a shared component (YAGNI —
one new consumer).

### Part 2 — Team search

Extends Phase 1/2's client-side aggregation.

| Unit | Path | Responsibility |
| --- | --- | --- |
| `searchTeams(q, limit)` | `src/lib/db/teams.ts` (add) | `select('id, name, publisher, logo_url, member_count').ilike('name', %q%).order('popularity', desc).limit(limit)`. Empty query → `[]`. Degrades to `[]`. Returns `TeamSearchResult[]`. |
| `TeamSearchResult` | `src/lib/db/teams.ts` | `{ id, name, publisher, logo_url, member_count }` (same shape as `TeamSummary`). |
| `useUnifiedSearch` | `src/hooks/useUnifiedSearch.ts` (extend) | Add a debounced `teams` query. Return adds `teams: TeamSearchResult[]`. |
| `TeamResultRow` (web) | `src/components/web/search/TeamResultRow.tsx` (new) | Wordmark/logo tile + name + `member_count members · publisher`; `variant: 'dark'\|'light'`, `active`. → `/team/[id]`. |
| `TeamResultRow` (native) | `src/components/search/TeamResultRow.tsx` (new) | Native sibling (PressScale, chevron). |
| Teams section | palette, web results page, native search | render a **Teams** section between Universes and Heroes. |

**Section order:** Universes → **Teams** → Heroes → Films & Shows. Teams sit next
to universes as the other "grouping" result type.

**Caps:** 3 teams in the palette, 6 on the web results page, 3 on native (matching
the titles caps).

**Keyboard nav:** extend the palette `NavItem` union with `{ kind: 'team'; id }`;
teams come right after universes in the flat list; Enter → `/team/[id]`.

## Data flow

```
useUnifiedSearch(q)
  ├─ searchUniverses(q)  → UniverseResult[]   (sync)
  ├─ searchTeams(q)      → TeamSearchResult[]  (debounced, NEW)
  ├─ useHeroSearch(q)    → HeroSearchResult[]
  └─ searchTitles(q)     → TitleSearchResult[]
→ sections: Universes → Teams → Heroes → Films & Shows

/team/[id]  ──useTeamPage──┬─ getTeamById(id)        → TeamSummary
                           └─ getTeamMembers(id,300) → RosterHero[]  (→ /character/[id])
```

## Error handling

- `searchTeams`, `getTeamById`, `getTeamMembers` all degrade to `[]` / `null`
  (log a warning) — a DB hiccup never blanks the other search sections, and the
  team page shows a "Team not found" state when `getTeamById` returns null.

## Testing

Per repo convention (pure logic / hooks only, mocked Supabase; no screen renders):
- `__tests__/lib/db/teams.test.ts` — `searchTeams`: empty query short-circuits
  (no DB call); ILIKE + popularity order; row→`TeamSearchResult` mapping; error →
  `[]`. `getTeamById`: maps a row; missing → `null`.
- `__tests__/hooks/useUnifiedSearch.test.tsx` (extend) — teams section populates;
  a teams failure leaves the other sections intact.
- `__tests__/hooks/useTeamPage.test.tsx` (new) — resolves `{team, members}`;
  `notFound` when `getTeamById` → null; mocks `src/lib/db/teams`.
- No tests for the route view files (per CLAUDE.md).

## Build order

1. **Part 1** — `getTeamById` / `getTeamMembers` → `useTeamPage` → `/team/[id]`
   views. (Destination exists and is reachable by direct URL.)
2. **Part 2** — `searchTeams` → `useUnifiedSearch` → web `TeamResultRow` + palette
   + web results page → native `TeamResultRow` + native section.

## Open questions

None. Logos are intentionally out (wordmark fallback); curation is popularity-only
by decision.
