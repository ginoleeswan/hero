// Search-crawler content pages. Search engines (matched by user-agent rewrites
// in vercel.json) land here instead of the static SPA shell and get fully
// rendered, internally-linked HTML for /character pages — the SPA renders
// nothing without JS, so this route is what makes the catalogue indexable.
// Social preview bots stay on /api/share-meta; humans never hit either.
import {
  buildCharacterBotPage,
  buildNotFoundPage,
  buildTeamBotPage,
  buildTitleBotPage,
  buildVsBotPage,
  type BotHero,
  type BotTeam,
  type BotTitle,
  type RelatedLite,
} from './_lib/botPage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

// Minimal req/res typing — avoids a dependency on @vercel/node just for types.
type Req = { query: Record<string, string | string[] | undefined> };
type Res = {
  setHeader: (k: string, v: string) => void;
  status: (code: number) => { send: (body: string) => void };
};

const HERO_COLUMNS =
  'id,name,full_name,aliases,alignment,publisher,franchise,description,summary,' +
  'first_appearance,occupation,place_of_birth,race,gender,height_metric,weight_metric,' +
  'base,creators,teams,powers,intelligence,strength,speed,durability,power,combat,' +
  'portrait_url,image_url';

async function fetchHero(id: string): Promise<BotHero | null> {
  const url = `${SUPABASE_URL}/rest/v1/heroes?id=eq.${encodeURIComponent(
    id,
  )}&select=${HERO_COLUMNS}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!r.ok) return null;
  const rows = (await r.json()) as BotHero[];
  return rows[0] ?? null;
}

// Same graph the app's related rows use (get_related_heroes RPC, popularity
// ranked). Fail-soft to [] — a relationships hiccup must not 404 the page.
async function fetchRelated(
  heroId: string,
  kind: 'enemy' | 'ally' | 'teammate',
): Promise<RelatedLite[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_related_heroes`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        p_hero_id: heroId,
        p_kind: kind,
        p_limit: 12,
        p_same_universe: false,
      }),
    });
    if (!r.ok) return [];
    const rows = (await r.json()) as Array<{ id?: string; name?: string }>;
    return rows.filter((h): h is RelatedLite => !!h.id && !!h.name);
  } catch {
    return [];
  }
}

const TITLE_COLUMNS =
  'id,title,media_type,year,release_date,runtime,vote_average,overview,poster_url';

async function fetchTitle(id: string): Promise<BotTitle | null> {
  const url = `${SUPABASE_URL}/rest/v1/titles?id=eq.${encodeURIComponent(
    id,
  )}&select=${TITLE_COLUMNS}`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!r.ok) return null;
  const rows = (await r.json()) as BotTitle[];
  return rows[0] ?? null;
}

/** Catalogue characters appearing in a title, richest-first (rank = issue count). */
async function fetchTitleCharacters(titleId: string): Promise<RelatedLite[]> {
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/hero_media_appearances?title_id=eq.${encodeURIComponent(
        titleId,
      )}` + `&select=rank,heroes(id,name)&order=rank.desc.nullslast&limit=24`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) return [];
    const rows = (await r.json()) as Array<{ heroes: { id?: string; name?: string } | null }>;
    return rows
      .map((row) => row.heroes)
      .filter((h): h is RelatedLite => !!h && !!h.id && !!h.name);
  } catch {
    return [];
  }
}

async function fetchTeam(id: string): Promise<BotTeam | null> {
  const url = `${SUPABASE_URL}/rest/v1/teams?id=eq.${encodeURIComponent(
    id,
  )}&select=id,name,publisher,member_count`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!r.ok) return null;
  const rows = (await r.json()) as BotTeam[];
  return rows[0] ?? null;
}

async function fetchTeamRoster(teamId: string): Promise<RelatedLite[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_team_roster`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_team_id: teamId, p_limit: 24 }),
    });
    if (!r.ok) return [];
    const rows = (await r.json()) as Array<{ id?: string; name?: string }>;
    return rows.filter((h): h is RelatedLite => !!h.id && !!h.name);
  } catch {
    return [];
  }
}

async function fetchTally(a: string, b: string): Promise<{ votesA: number; votesB: number }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_matchup_tally`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_a: a, p_b: b }),
    });
    if (!r.ok) return { votesA: 0, votesB: 0 };
    const t = (await r.json()) as { votes_a?: number; votes_b?: number };
    return { votesA: t.votes_a ?? 0, votesB: t.votes_b ?? 0 };
  } catch {
    return { votesA: 0, votesB: 0 };
  }
}

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

/** Render the requested page, or null when the subject doesn't exist. */
async function render(query: Req['query']): Promise<string | null> {
  const kind = str(query.kind);
  const id = str(query.id);
  if (kind === 'character' && id) {
    const hero = await fetchHero(id);
    if (!hero) return null;
    const [allies, enemies, teammates] = await Promise.all([
      fetchRelated(hero.id, 'ally'),
      fetchRelated(hero.id, 'enemy'),
      fetchRelated(hero.id, 'teammate'),
    ]);
    return buildCharacterBotPage(hero, { allies, enemies, teammates });
  }
  if (kind === 'title' && id) {
    const title = await fetchTitle(id);
    if (!title) return null;
    return buildTitleBotPage(title, await fetchTitleCharacters(title.id));
  }
  if (kind === 'team' && id) {
    const team = await fetchTeam(id);
    if (!team) return null;
    return buildTeamBotPage(team, await fetchTeamRoster(team.id));
  }
  if (kind === 'vs') {
    const [a, b] = await Promise.all([fetchHero(str(query.a)), fetchHero(str(query.b))]);
    if (!a || !b || a.id === b.id) return null;
    const [tally, forA, forB] = await Promise.all([
      fetchTally(a.id, b.id),
      fetchRelated(a.id, 'enemy'),
      fetchRelated(b.id, 'enemy'),
    ]);
    return buildVsBotPage(a, b, tally, { forA, forB });
  }
  return null;
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  try {
    const html = await render(req.query);
    if (html) {
      // A day at the edge + a week stale: crawl bursts never hammer Supabase,
      // and catalogue edits still surface within a day.
      res.setHeader('cache-control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).send(html);
      return;
    }
  } catch {
    // fall through to the noindex 404 — never serve a crawler a 500
  }
  res.setHeader('cache-control', 'public, s-maxage=3600');
  res.status(404).send(buildNotFoundPage());
}
