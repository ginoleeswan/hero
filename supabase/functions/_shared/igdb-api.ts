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

export async function igdbQuery<T>(
  client: IgdbClient,
  endpoint: string,
  body: string,
): Promise<T[]> {
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

interface FranchiseRow {
  id: number;
  name: string;
  games?: number[];
}

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
