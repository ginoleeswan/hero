# IGDB Ingestion Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest characters from a curated set of game franchises via IGDB into the `heroes` table, tagging `publisher` (universe) + `franchise`, deduping/re-homing against existing rows, with hand-rated marquee fame and a Wikidata-driven tail.

**Architecture:** A service-role Supabase Edge Function (`seed-igdb-characters`) drives a curated franchise allowlist. Pure, side-effect-free logic (allowlist, transform, dedup decision, Twitch auth) lives in `supabase/functions/_shared/` with **no `https://` imports**, so it is imported by both the Deno function and Jest. The function resolves each franchise → its games → its characters via IGDB, then inserts new heroes or re-homes existing matches.

**Tech Stack:** Deno (Supabase Edge Functions), Supabase JS v2, IGDB REST API (Apicalypse query language) authenticated via Twitch OAuth, Jest (jest-expo preset) for the pure-logic tests.

## Global Constraints

- Package manager: **yarn** only (never npm/bun).
- Tests live in `__tests__/` mirroring source; run with `yarn test:ci`. Unit-test pure logic with mocked `fetch`; no live edge-function E2E.
- TypeScript throughout — no `any`, prefer `unknown` for caught errors.
- Migrations: new SQL file in `supabase/migrations/` named `YYYYMMDDHHMMSS_description.sql`, applied via the Supabase MCP tool (`mcp__supabase__apply_migration`), then regenerate `src/types/database.generated.ts` via `mcp__supabase__generate_typescript_types`. Never hand-edit the generated file.
- Supabase/PostgREST default 1000-row cap — always `.limit()`/`.range()` on `heroes` (~34k rows).
- New edge function is **`verify_jwt: true`** (service-role only) — do NOT ship a public DB-writer.
- Pure `_shared` modules must not import from `https://…`, must not read `Deno.env` at module top-level (pass config in as args), so Jest can import them.
- Popularity ordering uses `heroes.fame_score`. New rows surface via `recompute_fame_scores()` after a run; the tail surfaces via the existing Wikidata + weekly fame crons. Do NOT add a new cron.

---

### Task 1: Schema migration + type regen

**Files:**
- Create: `supabase/migrations/20260701120000_igdb_ingestion.sql`
- Modify (regenerated, not hand-edited): `src/types/database.generated.ts`

**Interfaces:**
- Produces: `heroes.igdb_id text`, `heroes.igdb_status text`; table `igdb_ingestion_state` with columns `franchise text PK`, `publisher text`, `igdb_franchise_id bigint`, `status text`, `last_synced_at timestamptz`, `inserted int`, `rehomed int`, `skipped int`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260701120000_igdb_ingestion.sql
-- IGDB game-universe ingestion: per-source id + status on heroes, plus an
-- admin-only ingestion-state table mirroring cv_ingestion_state.

alter table public.heroes add column if not exists igdb_id text;
alter table public.heroes add column if not exists igdb_status text;

create unique index if not exists heroes_igdb_id_key
  on public.heroes (igdb_id)
  where igdb_id is not null;

create table if not exists public.igdb_ingestion_state (
  franchise        text primary key,
  publisher        text not null,
  igdb_franchise_id bigint,
  status           text not null default 'pending',
  last_synced_at   timestamptz,
  inserted         int not null default 0,
  rehomed          int not null default 0,
  skipped          int not null default 0
);

-- Admin-only: RLS enabled with NO public policy (anon/auth read nothing).
alter table public.igdb_ingestion_state enable row level security;
```

- [ ] **Step 2: Apply the migration**

Apply via MCP tool `mcp__supabase__apply_migration` with name `igdb_ingestion` and the SQL above.
Expected: success, no error.

- [ ] **Step 3: Verify schema landed**

Run via `mcp__supabase__execute_sql`:
```sql
select column_name from information_schema.columns
where table_name='heroes' and column_name in ('igdb_id','igdb_status')
union all
select table_name from information_schema.tables where table_name='igdb_ingestion_state';
```
Expected: three rows — `igdb_id`, `igdb_status`, `igdb_ingestion_state`.

- [ ] **Step 4: Regenerate types**

Run `mcp__supabase__generate_typescript_types` and write the result to `src/types/database.generated.ts`.
Expected: file contains `igdb_id` and `igdb_ingestion_state`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260701120000_igdb_ingestion.sql src/types/database.generated.ts
git commit -m "feat(db): igdb_id/igdb_status + igdb_ingestion_state for IGDB ingestion"
```

---

### Task 2: Allowlist module

**Files:**
- Create: `supabase/functions/_shared/igdb-allowlist.ts`
- Test: `__tests__/supabase/igdb-allowlist.test.ts`

**Interfaces:**
- Produces:
  - `interface FranchiseEntry { franchise: string; publisher: string; igdbFranchiseId?: number; marqueeTiers: Record<string, number> }`
  - `const IGDB_ALLOWLIST: FranchiseEntry[]`
  - `function marqueeTier(entry: FranchiseEntry, characterName: string): number` — normalized-name lookup, default `0`.
  - `function normalizeName(s: string): string` — `lower`, strip non-alphanumeric (shared with transform).

- [ ] **Step 0: Let Jest resolve Deno-style `.ts` extension imports**

The `_shared` modules import each other with explicit `.ts` extensions (required by Deno, e.g. `from './igdb-allowlist.ts'`). Jest's resolver does not strip these by default, so add a mapper that does (Deno still reads the real `.ts` files). In `package.json`, under `jest.moduleNameMapper`, add:

```json
"^(\\.{1,2}/.*)\\.ts$": "$1"
```

so the block becomes:
```json
"moduleNameMapper": {
  "^react-native-reanimated/mock$": "<rootDir>/__mocks__/react-native-reanimated-mock-shim.js",
  "^@react-native-async-storage/async-storage$": "@react-native-async-storage/async-storage/jest/async-storage-mock",
  "\\.svg$": "<rootDir>/__mocks__/svgMock.js",
  "^(\\.{1,2}/.*)\\.ts$": "$1"
}
```

Verify nothing broke: `yarn jest __tests__/sanity.test.ts` → PASS.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/supabase/igdb-allowlist.test.ts
import {
  IGDB_ALLOWLIST,
  marqueeTier,
  normalizeName,
  type FranchiseEntry,
} from '../../supabase/functions/_shared/igdb-allowlist';

describe('igdb allowlist', () => {
  it('has 21 unique franchises across the expected publishers', () => {
    const names = IGDB_ALLOWLIST.map((e) => e.franchise);
    expect(names.length).toBe(21);
    expect(new Set(names).size).toBe(21);
    expect(IGDB_ALLOWLIST.find((e) => e.franchise === 'Final Fantasy')?.publisher).toBe(
      'Square Enix',
    );
    expect(IGDB_ALLOWLIST.find((e) => e.franchise === 'Halo')?.publisher).toBe(
      'Xbox Game Studios',
    );
  });

  it('every entry has a publisher and a marqueeTiers map', () => {
    IGDB_ALLOWLIST.forEach((e: FranchiseEntry) => {
      expect(typeof e.publisher).toBe('string');
      expect(e.publisher.length).toBeGreaterThan(0);
      expect(typeof e.marqueeTiers).toBe('object');
    });
  });

  it('marqueeTier resolves headliners case/punctuation-insensitively, else 0', () => {
    const ff = IGDB_ALLOWLIST.find((e) => e.franchise === 'Final Fantasy')!;
    expect(marqueeTier(ff, 'cloud  strife')).toBe(4);
    expect(marqueeTier(ff, 'Sephiroth')).toBe(4);
    expect(marqueeTier(ff, 'Random NPC')).toBe(0);
  });

  it('normalizeName lowercases and strips non-alphanumerics', () => {
    expect(normalizeName('Mr. Mime!')).toBe('mrmime');
    expect(normalizeName('Cloud Strife')).toBe('cloudstrife');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/supabase/igdb-allowlist.test.ts`
Expected: FAIL — cannot find module `igdb-allowlist`.

- [ ] **Step 3: Write the allowlist module**

```ts
// supabase/functions/_shared/igdb-allowlist.ts
// Curated game-franchise allowlist for IGDB ingestion. Single source of truth;
// adding a franchise is one entry here. `marqueeTiers` are hand-rated fame_tier
// values (0-4) for headliners that must surface immediately; everyone else
// defaults to 0 and earns fame via the Wikidata drain. No https/Deno imports —
// this file is imported by both the Deno edge function and Jest.

export interface FranchiseEntry {
  franchise: string;
  publisher: string;
  /** Optional explicit IGDB franchise id, used when the name is ambiguous. */
  igdbFranchiseId?: number;
  /** characterName -> fame_tier (0-4). Keys are matched normalized. */
  marqueeTiers: Record<string, number>;
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const IGDB_ALLOWLIST: FranchiseEntry[] = [
  {
    franchise: 'Final Fantasy',
    publisher: 'Square Enix',
    marqueeTiers: {
      'Cloud Strife': 4, Sephiroth: 4, 'Tifa Lockhart': 3, 'Aerith Gainsborough': 3,
      'Squall Leonhart': 3, Lightning: 3, 'Noctis Lucis Caelum': 3,
    },
  },
  {
    franchise: 'Kingdom Hearts',
    publisher: 'Square Enix',
    marqueeTiers: { Sora: 3, Riku: 3, Kairi: 2, Aqua: 2 },
  },
  {
    franchise: 'NieR',
    publisher: 'Square Enix',
    marqueeTiers: { '2B': 4, '9S': 3, A2: 2 },
  },
  {
    franchise: 'Tomb Raider',
    publisher: 'Square Enix',
    marqueeTiers: { 'Lara Croft': 4 },
  },
  {
    franchise: 'League of Legends',
    publisher: 'Riot Games',
    marqueeTiers: {
      Jinx: 4, Ahri: 3, Yasuo: 3, Lux: 3, Teemo: 3, Ezreal: 2, Garen: 2, Vi: 3, Jhin: 2,
    },
  },
  {
    franchise: 'Valorant',
    publisher: 'Riot Games',
    marqueeTiers: { Jett: 3, Sage: 2, Phoenix: 2, Reyna: 2 },
  },
  {
    franchise: 'Overwatch',
    publisher: 'Blizzard Entertainment',
    marqueeTiers: {
      Tracer: 4, Genji: 3, Reaper: 3, Mercy: 3, 'D.Va': 3, Widowmaker: 3, Reinhardt: 2,
    },
  },
  {
    franchise: 'Warcraft',
    publisher: 'Blizzard Entertainment',
    marqueeTiers: {
      'Sylvanas Windrunner': 4, 'Arthas Menethil': 4, Thrall: 3, 'Jaina Proudmoore': 3,
      'Illidan Stormrage': 3,
    },
  },
  {
    franchise: 'Diablo',
    publisher: 'Blizzard Entertainment',
    marqueeTiers: { Diablo: 3, Lilith: 3, 'Deckard Cain': 2 },
  },
  {
    franchise: 'The Witcher',
    publisher: 'CD Projekt',
    marqueeTiers: { 'Geralt of Rivia': 4, Yennefer: 3, Ciri: 3, 'Triss Merigold': 3 },
  },
  {
    franchise: 'Cyberpunk',
    publisher: 'CD Projekt',
    marqueeTiers: { 'Johnny Silverhand': 3, V: 3, 'Panam Palmer': 2 },
  },
  {
    franchise: 'Genshin Impact',
    publisher: 'HoYoverse',
    marqueeTiers: {
      'Raiden Shogun': 3, Zhongli: 3, 'Hu Tao': 3, Venti: 3, Ganyu: 3, Paimon: 3,
      Klee: 2, Aether: 2, Lumine: 2,
    },
  },
  {
    franchise: 'Persona',
    publisher: 'Atlus',
    marqueeTiers: { Joker: 3, 'Yu Narukami': 2, 'Makoto Yuki': 2, Morgana: 2 },
  },
  {
    franchise: 'Tekken',
    publisher: 'Bandai Namco',
    marqueeTiers: { 'Kazuya Mishima': 3, 'Jin Kazama': 3, 'Heihachi Mishima': 3, 'Nina Williams': 2 },
  },
  {
    franchise: 'Halo',
    publisher: 'Xbox Game Studios',
    marqueeTiers: { 'Master Chief': 4, Cortana: 3, Arbiter: 2 },
  },
  {
    franchise: 'God of War',
    publisher: 'PlayStation Studios',
    marqueeTiers: { Kratos: 4, Atreus: 3 },
  },
  {
    franchise: 'Metal Gear',
    publisher: 'Konami',
    marqueeTiers: { 'Solid Snake': 4, 'Big Boss': 3, Raiden: 2, 'Revolver Ocelot': 2 },
  },
  {
    franchise: 'The Elder Scrolls',
    publisher: 'Bethesda',
    marqueeTiers: { Dragonborn: 3, 'Alduin': 2 },
  },
  {
    franchise: 'Fallout',
    publisher: 'Bethesda',
    marqueeTiers: { 'Vault Boy': 2 },
  },
  {
    franchise: 'Mass Effect',
    publisher: 'Electronic Arts',
    marqueeTiers: { 'Commander Shepard': 3, 'Garrus Vakarian': 3, 'Liara T\'Soni': 2, 'Tali\'Zorah': 2 },
  },
];

const tierIndex = new Map<FranchiseEntry, Map<string, number>>();

export function marqueeTier(entry: FranchiseEntry, characterName: string): number {
  let idx = tierIndex.get(entry);
  if (!idx) {
    idx = new Map(
      Object.entries(entry.marqueeTiers).map(([k, v]) => [normalizeName(k), v]),
    );
    tierIndex.set(entry, idx);
  }
  return idx.get(normalizeName(characterName)) ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/supabase/igdb-allowlist.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/igdb-allowlist.ts __tests__/supabase/igdb-allowlist.test.ts
git commit -m "feat(igdb): curated franchise allowlist with marquee fame tiers"
```

---

### Task 3: Twitch OAuth token helper

**Files:**
- Create: `supabase/functions/_shared/igdb-auth.ts`
- Test: `__tests__/supabase/igdb-auth.test.ts`

**Interfaces:**
- Produces: `async function getIgdbToken(clientId: string, clientSecret: string, fetchFn?: typeof fetch): Promise<string>` — POSTs to Twitch OAuth, returns the bearer `access_token`; throws on non-OK.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/supabase/igdb-auth.test.ts
import { getIgdbToken } from '../../supabase/functions/_shared/igdb-auth';

describe('getIgdbToken', () => {
  it('exchanges client credentials for a bearer token', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok_123', expires_in: 5000 }),
    });
    const tok = await getIgdbToken('cid', 'secret', fetchFn as unknown as typeof fetch);
    expect(tok).toBe('tok_123');
    const url = (fetchFn.mock.calls[0][0] as string);
    expect(url).toContain('id.twitch.tv/oauth2/token');
    expect(url).toContain('client_id=cid');
    expect(url).toContain('grant_type=client_credentials');
  });

  it('throws when Twitch responds non-OK', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' });
    await expect(
      getIgdbToken('cid', 'secret', fetchFn as unknown as typeof fetch),
    ).rejects.toThrow(/twitch/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/supabase/igdb-auth.test.ts`
Expected: FAIL — cannot find module `igdb-auth`.

- [ ] **Step 3: Write the auth helper**

```ts
// supabase/functions/_shared/igdb-auth.ts
// Twitch OAuth client-credentials exchange for IGDB access. No top-level
// Deno.env / https imports so Jest can import it; the caller passes creds + an
// optional fetch (defaults to global fetch, present in both Deno and Node 18+).

export async function getIgdbToken(
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetchFn(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Twitch token error: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Twitch token error: no access_token in response');
  return json.access_token;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/supabase/igdb-auth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/igdb-auth.ts __tests__/supabase/igdb-auth.test.ts
git commit -m "feat(igdb): Twitch OAuth token helper"
```

---

### Task 4: Transform + dedup decision

**Files:**
- Create: `supabase/functions/_shared/igdb-transform.ts`
- Test: `__tests__/supabase/igdb-transform.test.ts`

**Interfaces:**
- Consumes: `FranchiseEntry`, `marqueeTier`, `normalizeName` from `igdb-allowlist`.
- Produces:
  - `interface IgdbCharacter { id: number; name: string; description?: string | null; mug_shot?: { image_id?: string } | null }`
  - `interface ExistingRow { id: string; name: string; publisher: string | null; comicvine_id: string | null; igdb_id: string | null }`
  - `function mugShotUrl(imageId?: string | null): string | null`
  - `function characterToHeroRow(c: IgdbCharacter, entry: FranchiseEntry, now: string): NewHeroRow`
  - `type DedupDecision = { kind: 'skip' } | { kind: 'insert'; row: NewHeroRow } | { kind: 'rehome'; targetId: string; patch: RehomePatch }`
  - `function dedupDecision(c: IgdbCharacter, entry: FranchiseEntry, existing: ExistingRow[], now: string): DedupDecision`
  - `const PROTECTED_PUBLISHERS: Set<string>`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/supabase/igdb-transform.test.ts
import {
  mugShotUrl,
  characterToHeroRow,
  dedupDecision,
  type IgdbCharacter,
  type ExistingRow,
} from '../../supabase/functions/_shared/igdb-transform';
import { IGDB_ALLOWLIST } from '../../supabase/functions/_shared/igdb-allowlist';

const ff = IGDB_ALLOWLIST.find((e) => e.franchise === 'Final Fantasy')!;
const lol = IGDB_ALLOWLIST.find((e) => e.franchise === 'League of Legends')!;
const tr = IGDB_ALLOWLIST.find((e) => e.franchise === 'Tomb Raider')!;
const NOW = '2026-07-01T00:00:00.000Z';

describe('mugShotUrl', () => {
  it('builds a 720p image url from an image id', () => {
    expect(mugShotUrl('abc123')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_720p/abc123.jpg',
    );
  });
  it('returns null when no image id', () => {
    expect(mugShotUrl(null)).toBeNull();
    expect(mugShotUrl(undefined)).toBeNull();
  });
});

describe('characterToHeroRow', () => {
  it('maps an IGDB character to a new hero row with marquee tier + pending wikidata', () => {
    const c: IgdbCharacter = { id: 55, name: 'Cloud Strife', description: 'SOLDIER.', mug_shot: { image_id: 'img1' } };
    const row = characterToHeroRow(c, ff, NOW);
    expect(row.id).toBe('igdb-55');
    expect(row.igdb_id).toBe('55');
    expect(row.name).toBe('Cloud Strife');
    expect(row.publisher).toBe('Square Enix');
    expect(row.franchise).toBe('Final Fantasy');
    expect(row.fame_tier).toBe(4);
    expect(row.wikidata_status).toBe('pending');
    expect(row.igdb_status).toBe('enriched');
    expect(row.ai_stats_status).toBeNull();
    expect(row.image_url).toBe('https://images.igdb.com/igdb/image/upload/t_720p/img1.jpg');
    expect(row.summary).toBe('SOLDIER.');
    expect(row.enriched_at).toBe(NOW);
  });
  it('defaults non-marquee characters to fame_tier 0', () => {
    const row = characterToHeroRow({ id: 9, name: 'Town Guard' }, ff, NOW);
    expect(row.fame_tier).toBe(0);
  });
});

describe('dedupDecision', () => {
  it('skips when the igdb_id already exists', () => {
    const existing: ExistingRow[] = [
      { id: 'igdb-55', name: 'Cloud Strife', publisher: 'Square Enix', comicvine_id: null, igdb_id: '55' },
    ];
    const d = dedupDecision({ id: 55, name: 'Cloud Strife' }, ff, existing, NOW);
    expect(d.kind).toBe('skip');
  });

  it('re-homes an orphaned game character (non-comic publisher)', () => {
    const existing: ExistingRow[] = [
      { id: 'cv-900', name: 'Lara Croft', publisher: 'Crystal Dynamics', comicvine_id: '900', igdb_id: null },
    ];
    const d = dedupDecision({ id: 7, name: 'Lara Croft' }, tr, existing, NOW);
    expect(d.kind).toBe('rehome');
    if (d.kind === 'rehome') {
      expect(d.targetId).toBe('cv-900');
      expect(d.patch.publisher).toBe('Square Enix');
      expect(d.patch.franchise).toBe('Tomb Raider');
      expect(d.patch.igdb_id).toBe('7');
    }
  });

  it('does NOT re-home a comic character that merely shares a name (collision)', () => {
    const existing: ExistingRow[] = [
      { id: 'h_x', name: 'Jinx', publisher: 'DC Comics', comicvine_id: '111', igdb_id: null },
    ];
    const d = dedupDecision({ id: 22, name: 'Jinx' }, lol, existing, NOW);
    expect(d.kind).toBe('insert');
    if (d.kind === 'insert') expect(d.row.id).toBe('igdb-22');
  });

  it('inserts a new row when there is no match', () => {
    const d = dedupDecision({ id: 30, name: 'Yasuo' }, lol, [], NOW);
    expect(d.kind).toBe('insert');
  });

  it('inserts (not re-home) when the name is ambiguous across multiple rows', () => {
    const existing: ExistingRow[] = [
      { id: 'a', name: 'Sage', publisher: 'Crystal Dynamics', comicvine_id: null, igdb_id: null },
      { id: 'b', name: 'Sage', publisher: 'Some Studio', comicvine_id: null, igdb_id: null },
    ];
    const valorant = IGDB_ALLOWLIST.find((e) => e.franchise === 'Valorant')!;
    const d = dedupDecision({ id: 40, name: 'Sage' }, valorant, existing, NOW);
    expect(d.kind).toBe('insert');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/supabase/igdb-transform.test.ts`
Expected: FAIL — cannot find module `igdb-transform`.

- [ ] **Step 3: Write the transform module**

```ts
// supabase/functions/_shared/igdb-transform.ts
// Pure IGDB-character -> hero-row transform and dedup/re-home decision. One
// source of truth (no dual-path drift); no https/Deno imports so Jest can run it.

import { type FranchiseEntry, marqueeTier, normalizeName } from './igdb-allowlist.ts';

export interface IgdbCharacter {
  id: number;
  name: string;
  description?: string | null;
  mug_shot?: { image_id?: string } | null;
}

export interface ExistingRow {
  id: string;
  name: string;
  publisher: string | null;
  comicvine_id: string | null;
  igdb_id: string | null;
}

export interface NewHeroRow {
  id: string;
  name: string;
  igdb_id: string;
  igdb_status: 'enriched';
  publisher: string;
  franchise: string;
  summary: string | null;
  image_url: string | null;
  fame_tier: number;
  wikidata_status: 'pending';
  ai_stats_status: null;
  enriched_at: string;
}

export interface RehomePatch {
  igdb_id: string;
  igdb_status: 'enriched';
  publisher: string;
  franchise: string;
}

export type DedupDecision =
  | { kind: 'skip' }
  | { kind: 'insert'; row: NewHeroRow }
  | { kind: 'rehome'; targetId: string; patch: RehomePatch };

// Universes IGDB ingestion must never hijack via a name collision. A row under
// one of these with a comicvine_id is a comic character, not a game character.
export const PROTECTED_PUBLISHERS: Set<string> = new Set([
  'DC Comics', 'Marvel', 'Image', 'Dark Horse Comics', 'Archie Comics',
  'Valiant/Acclaim', 'Disney', 'Star Wars', 'Shueisha', 'Kodansha',
]);

export function mugShotUrl(imageId?: string | null): string | null {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_720p/${imageId}.jpg`;
}

export function characterToHeroRow(
  c: IgdbCharacter,
  entry: FranchiseEntry,
  now: string,
): NewHeroRow {
  return {
    id: `igdb-${c.id}`,
    name: c.name,
    igdb_id: String(c.id),
    igdb_status: 'enriched',
    publisher: entry.publisher,
    franchise: entry.franchise,
    summary: c.description ?? null,
    image_url: mugShotUrl(c.mug_shot?.image_id),
    fame_tier: marqueeTier(entry, c.name),
    wikidata_status: 'pending',
    ai_stats_status: null,
    enriched_at: now,
  };
}

function isProtected(row: ExistingRow): boolean {
  return !!row.comicvine_id && !!row.publisher && PROTECTED_PUBLISHERS.has(row.publisher);
}

export function dedupDecision(
  c: IgdbCharacter,
  entry: FranchiseEntry,
  existing: ExistingRow[],
  now: string,
): DedupDecision {
  const igdbId = String(c.id);
  if (existing.some((r) => r.igdb_id === igdbId)) return { kind: 'skip' };

  const norm = normalizeName(c.name);
  const candidates = existing.filter((r) => normalizeName(r.name) === norm);

  // Unambiguous, non-comic match -> re-home. Anything else (none, multiple, or a
  // protected comic character sharing the name) -> insert a fresh row.
  if (candidates.length === 1 && !isProtected(candidates[0])) {
    return {
      kind: 'rehome',
      targetId: candidates[0].id,
      patch: {
        igdb_id: igdbId,
        igdb_status: 'enriched',
        publisher: entry.publisher,
        franchise: entry.franchise,
      },
    };
  }
  return { kind: 'insert', row: characterToHeroRow(c, entry, now) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/supabase/igdb-transform.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/igdb-transform.ts __tests__/supabase/igdb-transform.test.ts
git commit -m "feat(igdb): character->hero transform + collision-safe dedup/re-home"
```

---

### Task 5: IGDB query helpers (franchise + characters)

**Files:**
- Create: `supabase/functions/_shared/igdb-api.ts`
- Test: `__tests__/supabase/igdb-api.test.ts`

**Interfaces:**
- Produces:
  - `interface IgdbClient { clientId: string; token: string; fetchFn?: typeof fetch }`
  - `async function igdbQuery<T>(client: IgdbClient, endpoint: string, body: string): Promise<T[]>` — POSTs an Apicalypse body to `https://api.igdb.com/v4/<endpoint>`, sets `Client-ID` + `Authorization: Bearer` headers; throws on non-OK.
  - `async function resolveFranchiseGameIds(client: IgdbClient, entry: FranchiseEntry): Promise<{ franchiseId: number | null; gameIds: number[] }>` — looks up `/franchises` then `/collections` by name (or uses `entry.igdbFranchiseId`), returns the franchise id + its game ids (highest game-count candidate wins).
  - `async function fetchFranchiseCharacters(client: IgdbClient, gameIds: number[]): Promise<IgdbCharacter[]>` — paginates `/characters where games = (…)` selecting `name, description, mug_shot.image_id, games`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/supabase/igdb-api.test.ts
import {
  igdbQuery,
  resolveFranchiseGameIds,
  fetchFranchiseCharacters,
  type IgdbClient,
} from '../../supabase/functions/_shared/igdb-api';
import { IGDB_ALLOWLIST } from '../../supabase/functions/_shared/igdb-allowlist';

const ff = IGDB_ALLOWLIST.find((e) => e.franchise === 'Final Fantasy')!;

function clientWith(fetchFn: jest.Mock): IgdbClient {
  return { clientId: 'cid', token: 'tok', fetchFn: fetchFn as unknown as typeof fetch };
}

describe('igdbQuery', () => {
  it('POSTs apicalypse with auth headers and returns the array', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 1 }] });
    const out = await igdbQuery(clientWith(fetchFn), 'characters', 'fields name;');
    expect(out).toEqual([{ id: 1 }]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.igdb.com/v4/characters');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Client-ID']).toBe('cid');
    expect(headers['Authorization']).toBe('Bearer tok');
  });

  it('throws on non-OK', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate' });
    await expect(igdbQuery(clientWith(fetchFn), 'characters', 'x')).rejects.toThrow(/429/);
  });
});

describe('resolveFranchiseGameIds', () => {
  it('picks the franchise with the most games and returns its game ids', async () => {
    const fetchFn = jest
      .fn()
      // /franchises lookup
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 10, name: 'Final Fantasy', games: [1, 2, 3] },
          { id: 11, name: 'Final Fantasy Tactics', games: [9] },
        ],
      });
    const { franchiseId, gameIds } = await resolveFranchiseGameIds(clientWith(fetchFn), ff);
    expect(franchiseId).toBe(10);
    expect(gameIds).toEqual([1, 2, 3]);
  });
});

describe('fetchFranchiseCharacters', () => {
  it('returns [] for empty gameIds without calling the API', async () => {
    const fetchFn = jest.fn();
    const out = await fetchFranchiseCharacters(clientWith(fetchFn), []);
    expect(out).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('paginates until a short page is returned', async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `c${i}` }));
    const page2 = [{ id: 999, name: 'last' }];
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });
    const out = await fetchFranchiseCharacters(clientWith(fetchFn), [1, 2]);
    expect(out.length).toBe(501);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/supabase/igdb-api.test.ts`
Expected: FAIL — cannot find module `igdb-api`.

- [ ] **Step 3: Write the API helper**

```ts
// supabase/functions/_shared/igdb-api.ts
// Thin IGDB v4 client (Apicalypse over POST). Pure except for fetch; no
// https/Deno imports so Jest can run it. Caller supplies clientId + token.

import { type FranchiseEntry } from './igdb-allowlist.ts';
import { type IgdbCharacter } from './igdb-transform.ts';

const IGDB_BASE = 'https://api.igdb.com/v4';
const PAGE = 500;

export interface IgdbClient {
  clientId: string;
  token: string;
  fetchFn?: typeof fetch;
}

export async function igdbQuery<T>(client: IgdbClient, endpoint: string, body: string): Promise<T[]> {
  const fetchFn = client.fetchFn ?? fetch;
  const res = await fetchFn(`${IGDB_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': client.clientId,
      Authorization: `Bearer ${client.token}`,
      Accept: 'application/json',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`IGDB ${endpoint} error: ${res.status} ${text}`);
  }
  return (await res.json()) as T[];
}

interface FranchiseRow { id: number; name: string; games?: number[] }

export async function resolveFranchiseGameIds(
  client: IgdbClient,
  entry: FranchiseEntry,
): Promise<{ franchiseId: number | null; gameIds: number[] }> {
  const where = entry.igdbFranchiseId
    ? `where id = ${entry.igdbFranchiseId};`
    : `where name ~ *"${entry.franchise}"*;`;
  // Try /franchises first, then /collections as a fallback grouping.
  for (const endpoint of ['franchises', 'collections']) {
    const rows = await igdbQuery<FranchiseRow>(
      client,
      endpoint,
      `fields name,games; ${where} limit 50;`,
    );
    const withGames = rows.filter((r) => (r.games?.length ?? 0) > 0);
    if (withGames.length) {
      withGames.sort((a, b) => (b.games?.length ?? 0) - (a.games?.length ?? 0));
      return { franchiseId: withGames[0].id, gameIds: withGames[0].games ?? [] };
    }
  }
  return { franchiseId: null, gameIds: [] };
}

export async function fetchFranchiseCharacters(
  client: IgdbClient,
  gameIds: number[],
): Promise<IgdbCharacter[]> {
  if (gameIds.length === 0) return [];
  const out: IgdbCharacter[] = [];
  let offset = 0;
  for (;;) {
    const page = await igdbQuery<IgdbCharacter>(
      client,
      'characters',
      `fields name,description,mug_shot.image_id,games;` +
        ` where games = (${gameIds.join(',')});` +
        ` limit ${PAGE}; offset ${offset};`,
    );
    out.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/supabase/igdb-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/igdb-api.ts __tests__/supabase/igdb-api.test.ts
git commit -m "feat(igdb): IGDB v4 query client (franchise resolve + character fetch)"
```

---

### Task 6: Edge function entry (`seed-igdb-characters`)

**Files:**
- Create: `supabase/functions/seed-igdb-characters/index.ts`
- Modify: `.env.example` (document `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`)

**Interfaces:**
- Consumes: `getIgdbToken`, `IgdbClient`/`resolveFranchiseGameIds`/`fetchFranchiseCharacters`, `dedupDecision`, `IGDB_ALLOWLIST`.
- Produces: HTTP endpoint accepting `{ batches?: number }`; returns `{ results: Array<{ franchise; resolved; inserted; rehomed; skipped; status }> }`. No Jest test (Deno-only, manual verification in Task 7).

- [ ] **Step 1: Document the new env vars**

Add to `.env.example`:
```
# IGDB (Twitch) — Supabase Edge Function secrets for seed-igdb-characters
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
```

- [ ] **Step 2: Write the edge function**

```ts
// supabase/functions/seed-igdb-characters/index.ts
// Service-role drain: ingests curated game franchises from IGDB into heroes.
// verify_jwt is enabled (see config note in Step 3) — invoke via service role.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { IGDB_ALLOWLIST } from '../_shared/igdb-allowlist.ts';
import { getIgdbToken } from '../_shared/igdb-auth.ts';
import {
  resolveFranchiseGameIds,
  fetchFranchiseCharacters,
  type IgdbClient,
} from '../_shared/igdb-api.ts';
import { dedupDecision, type ExistingRow } from '../_shared/igdb-transform.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

// IGDB allows ~4 req/s; sleep between franchises to stay well under.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let batches = IGDB_ALLOWLIST.length;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.batches === 'number') batches = Math.min(Math.max(1, body.batches), IGDB_ALLOWLIST.length);
  } catch { /* no body ok */ }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  let token: string;
  try {
    token = await getIgdbToken(
      Deno.env.get('IGDB_CLIENT_ID') ?? '',
      Deno.env.get('IGDB_CLIENT_SECRET') ?? '',
    );
  } catch (e) {
    return json({ error: `auth: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
  const client: IgdbClient = { clientId: Deno.env.get('IGDB_CLIENT_ID') ?? '', token };

  const now = new Date().toISOString();
  const results: unknown[] = [];

  // Process franchises not yet 'complete', up to `batches` per invocation.
  const { data: stateRows } = await sb.from('igdb_ingestion_state').select('franchise,status');
  const doneSet = new Set((stateRows ?? []).filter((s) => s.status === 'complete').map((s) => s.franchise));
  const todo = IGDB_ALLOWLIST.filter((e) => !doneSet.has(e.franchise)).slice(0, batches);

  for (const entry of todo) {
    try {
      const { franchiseId, gameIds } = await resolveFranchiseGameIds(client, entry);
      const characters = await fetchFranchiseCharacters(client, gameIds);

      // Load existing rows once per franchise (name + ids needed for dedup).
      const { data: existing } = await sb
        .from('heroes')
        .select('id,name,publisher,comicvine_id,igdb_id');
      const rows = (existing ?? []) as ExistingRow[];

      let inserted = 0, rehomed = 0, skipped = 0;
      for (const c of characters) {
        const d = dedupDecision(c, entry, rows, now);
        if (d.kind === 'skip') { skipped++; continue; }
        if (d.kind === 'insert') {
          const { error } = await sb.from('heroes').insert(d.row);
          if (!error) { inserted++; rows.push({ id: d.row.id, name: d.row.name, publisher: d.row.publisher, comicvine_id: null, igdb_id: d.row.igdb_id }); }
        } else {
          // re-home: never overwrite existing art/description.
          const { error } = await sb.from('heroes').update(d.patch).eq('id', d.targetId);
          if (!error) {
            rehomed++;
            const t = rows.find((r) => r.id === d.targetId);
            if (t) t.igdb_id = d.patch.igdb_id;
          }
        }
      }

      const status = characters.length === 0 ? 'empty' : 'complete';
      await sb.from('igdb_ingestion_state').upsert({
        franchise: entry.franchise,
        publisher: entry.publisher,
        igdb_franchise_id: franchiseId,
        status,
        last_synced_at: now,
        inserted,
        rehomed,
        skipped,
      });
      results.push({ franchise: entry.franchise, resolved: characters.length, inserted, rehomed, skipped, status });
      await sleep(500);
    } catch (e) {
      results.push({ franchise: entry.franchise, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ results });
});
```

- [ ] **Step 3: Add the verify_jwt config note**

If the repo uses `supabase/config.toml` function blocks, ensure `seed-igdb-characters` is NOT marked `verify_jwt = false` (default is JWT-required). Confirm by reading `supabase/config.toml`; if other seeders have `[functions.<name>] verify_jwt = false`, do NOT add such a block for this one.

- [ ] **Step 4: Typecheck the workspace**

Run: `yarn tsc --noEmit` (or the repo's typecheck script)
Expected: no new errors from the added files.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/seed-igdb-characters/index.ts .env.example
git commit -m "feat(igdb): seed-igdb-characters service-role ingestion function"
```

---

### Task 7: Deploy, first run, verify

**Files:** none (operational task).

**Interfaces:** Consumes everything above; produces real `heroes` rows under the new universes and a populated `igdb_ingestion_state`.

- [ ] **Step 1: Set function secrets**

Confirm with the user that a Twitch developer app exists, then set the secrets (the user supplies values):
```bash
supabase secrets set IGDB_CLIENT_ID=<value> IGDB_CLIENT_SECRET=<value>
```
Expected: secrets stored. (If the user cannot supply these yet, STOP and report — the run cannot proceed.)

- [ ] **Step 2: Deploy the function**

Deploy `seed-igdb-characters` via `mcp__supabase__deploy_edge_function`.
Expected: deploy success.

- [ ] **Step 3: Smoke-run a single franchise**

Invoke with `{ "batches": 1 }` (service role). Inspect the JSON `results[0]` — expect `resolved > 0` and `inserted > 0` for the first franchise.
If `resolved === 0` for a franchise, note it (its name may need an `igdbFranchiseId` override in the allowlist — add it and redeploy).

- [ ] **Step 4: Verify rows + re-home in the DB**

Run via `mcp__supabase__execute_sql`:
```sql
select publisher, count(*) from heroes where igdb_id is not null group by 1 order by 2 desc;
select id, name, publisher, franchise from heroes where name ilike 'Lara Croft';
```
Expected: new universes appear with counts; Lara Croft shows `publisher='Square Enix', franchise='Tomb Raider'` (re-homed, not duplicated).

- [ ] **Step 5: Run the remaining franchises**

Invoke again with `{ "batches": 21 }` (idempotent — completed franchises are skipped). Confirm `igdb_ingestion_state` shows all franchises `complete`/`empty`:
```sql
select franchise, status, inserted, rehomed, skipped from igdb_ingestion_state order by inserted desc;
```

- [ ] **Step 6: Recompute fame so marquee characters surface**

Run `select recompute_fame_scores();` via `mcp__supabase__execute_sql`, then:
```sql
select name, publisher, franchise, fame_score from heroes
where igdb_id is not null order by fame_score desc nulls last limit 20;
```
Expected: marquee characters (Cloud Strife, Master Chief, Geralt, etc.) carry a non-trivial `fame_score`. The long tail backfills via the existing Wikidata + weekly fame crons.

- [ ] **Step 7: Final full test run**

Run: `yarn test:ci`
Expected: all suites pass (new igdb suites + existing).

---

## Self-Review

**Spec coverage:** Schema (Task 1) ✓; allowlist single-source (Task 2) ✓; Twitch auth (Task 3) ✓; transform + collision-safe re-home (Task 4) ✓; franchise/character IGDB queries with rate-limit-aware pagination (Task 5) ✓; service-role-only function, no new cron (Task 6) ✓; deploy/run/recompute + Wikidata tail handoff (Task 7) ✓; free-only art/stats (no portrait/AI-stats queued — `ai_stats_status=null`, image from mug_shot) ✓; fame via hand-rated marquee + `wikidata_status='pending'` ✓.

**Deferred to Plan 2 (browse UX):** `/franchise/[slug]` route + `useFranchiseHeroes`, two-tier eyebrow, ComicVine read-through guard, Pokémon `franchise` cleanup, brand badges. These are UX-surface concerns; ingestion above is independently shippable and testable. The read-through guard is not required before Task 7 because IGDB rows aren't linked/browsable until Plan 2, and an unguarded view degrades gracefully (ComicVine returns unmatched).

**Placeholder scan:** none — all steps contain concrete code/SQL/commands.

**Type consistency:** `normalizeName` defined in `igdb-allowlist`, reused by `igdb-transform`. `IgdbCharacter`/`ExistingRow`/`NewHeroRow`/`DedupDecision` defined in `igdb-transform`, consumed by `igdb-api` and the edge function. `IgdbClient` defined in `igdb-api`, used by the function. Field names (`igdb_id`, `igdb_status`, `fame_tier`, `wikidata_status`, `ai_stats_status`, `enriched_at`) match the Task 1 schema and the `heroes` columns verified against the live table.
