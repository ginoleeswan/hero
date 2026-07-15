// Search-crawler content pages. Search engines (matched by user-agent rewrites
// in vercel.json) land here instead of the static SPA shell and get fully
// rendered, internally-linked HTML for /character pages — the SPA renders
// nothing without JS, so this route is what makes the catalogue indexable.
// Social preview bots stay on /api/share-meta; humans never hit either.
import {
  buildCategoryBotPage,
  buildCharacterBotPage,
  buildFranchiseBotPage,
  buildNotFoundPage,
  buildTeamBotPage,
  buildTitleBotPage,
  buildUniverseBotPage,
  buildVsBotPage,
  CATEGORY_SEO,
  type BotHero,
  type BotTeam,
  type BotTitle,
  type RelatedLite,
} from './_lib/botPage';
import { universeBrandBySlug, universeBrandForPublisher } from '../src/constants/universeBrands';

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
  'portrait_url,image_url,wikidata_qid,enwiki_title';

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
      `${SUPABASE_URL}/rest/v1/hero_media_appearances?title_id=eq.${encodeURIComponent(titleId)}` +
      `&select=rank,heroes(id,name)&order=rank.desc.nullslast&limit=24`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) return [];
    const rows = (await r.json()) as Array<{ heroes: { id?: string; name?: string } | null }>;
    return rows.map((row) => row.heroes).filter((h): h is RelatedLite => !!h && !!h.id && !!h.name);
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

// Number of characters listed on a hub page — enough dense internal linking to
// be crawl-valuable, bounded so a page never balloons.
const HUB_LIMIT = 100;

// PostgREST query per category slug. Mirrors the predicates in
// getAllHeroesBySlug (src/lib/db/heroes/categories.ts) — this RN-free bundle
// can't import that module, so keep the two in sync when categories change.
// Values are raw PostgREST filter expressions; URLSearchParams percent-encodes
// them (parens, quotes, `*` wildcards, spaces all decode correctly server-side).
type CatQuery = { select: string; params: Array<[string, string]>; order: string };
const TAG_SELECT = 'id,name,hero_tags!inner(tag)';
const CATEGORY_QUERY: Record<string, CatQuery> = {
  popular: {
    select: 'id,name',
    params: [['category', 'eq.popular']],
    order: 'fame_score.desc.nullslast',
  },
  villain: {
    select: 'id,name',
    params: [
      ['alignment', 'eq.bad'],
      ['publisher', 'not.in.("Non-Fictional","In the Public Domain")'],
    ],
    order: 'fame_score.desc.nullslast',
  },
  xmen: {
    select: 'id,name',
    params: [['or', '(group_affiliation.ilike.*x-men*,group_affiliation.ilike.*xmen*)']],
    order: 'fame_score.desc.nullslast',
  },
  'anti-heroes': {
    select: 'id,name',
    params: [['alignment', 'ilike.*neutral*']],
    order: 'fame_score.desc.nullslast',
  },
  marvel: {
    select: 'id,name',
    params: [['publisher', 'ilike.*marvel*']],
    order: 'fame_score.desc.nullslast',
  },
  dc: {
    select: 'id,name',
    params: [['publisher', 'ilike.*dc*']],
    order: 'fame_score.desc.nullslast',
  },
  image: {
    select: 'id,name',
    params: [['publisher', 'ilike.*image*']],
    order: 'fame_score.desc.nullslast',
  },
  'dark-horse': {
    select: 'id,name',
    params: [['publisher', 'ilike.*dark horse*']],
    order: 'fame_score.desc.nullslast',
  },
  strongest: {
    select: 'id,name',
    params: [['strength', 'not.is.null']],
    order: 'strength.desc.nullslast',
  },
  'most-intelligent': {
    select: 'id,name',
    params: [['intelligence', 'not.is.null']],
    order: 'intelligence.desc.nullslast',
  },
  'most-iconic': {
    select: 'id,name',
    params: [['publisher', 'not.in.("Non-Fictional","In the Public Domain","Company-Licensed")']],
    order: 'fame_score.desc.nullslast',
  },
  'franchise-icons': {
    select: 'id,name',
    params: [['franchise', 'not.is.null']],
    order: 'issue_count.desc.nullslast',
  },
  anime: {
    select: TAG_SELECT,
    params: [['hero_tags.tag', 'eq.anime']],
    order: 'issue_count.desc.nullslast',
  },
  'video-games': {
    select: TAG_SELECT,
    params: [['hero_tags.tag', 'eq.video-game']],
    order: 'issue_count.desc.nullslast',
  },
  horror: {
    select: TAG_SELECT,
    params: [['hero_tags.tag', 'eq.horror-icon']],
    order: 'issue_count.desc.nullslast',
  },
};

/** Fetch the top HUB_LIMIT heroes for a hub query, id+name only. Fail-soft to
 *  [] so a hub with no results (or a transient error) becomes a noindex 404
 *  rather than a served 500. */
async function fetchHubHeroes(spec: CatQuery): Promise<RelatedLite[]> {
  try {
    const sp = new URLSearchParams();
    sp.set('select', spec.select);
    for (const [k, v] of spec.params) sp.append(k, v);
    sp.set('order', spec.order);
    sp.set('limit', String(HUB_LIMIT));
    const r = await fetch(`${SUPABASE_URL}/rest/v1/heroes?${sp.toString()}`, {
      headers: { apikey: SUPABASE_KEY },
    });
    if (!r.ok) return [];
    const rows = (await r.json()) as Array<{ id?: string; name?: string }>;
    return rows.filter((h): h is RelatedLite => !!h.id && !!h.name);
  } catch {
    return [];
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
  if (kind === 'category') {
    const slug = str(query.slug);
    const spec = CATEGORY_QUERY[slug];
    // Only render known slugs (CATEGORY_QUERY and CATEGORY_SEO share the set) —
    // an unknown slug becomes a noindex 404 instead of an empty hub.
    if (!spec || !CATEGORY_SEO[slug]) return null;
    const heroes = await fetchHubHeroes(spec);
    if (heroes.length === 0) return null;
    return buildCategoryBotPage(slug, heroes);
  }
  if (kind === 'universe') {
    // The param may arrive as a registry slug (app links: /universe/marvel) or a
    // raw publisher name (older/character-page links: /universe/Marvel Comics).
    // Resolve both to ONE canonical brand so the two forms collapse to a single
    // indexable URL (registered → stable slug; unregistered → the raw name).
    const param = str(query.slug).trim();
    if (!param) return null;
    const brand = universeBrandBySlug(param) ?? universeBrandForPublisher(param);
    const term = brand ? brand.query : param; // ILIKE term against `publisher`
    const name = brand ? brand.name : param; // display name / H1
    const slug = brand ? brand.slug : param; // canonical path segment
    const heroes = await fetchHubHeroes({
      select: 'id,name',
      params: [['publisher', `ilike.*${term}*`]],
      order: 'fame_score.desc.nullslast',
    });
    if (heroes.length === 0) return null;
    return buildUniverseBotPage(name, slug, heroes);
  }
  if (kind === 'franchise') {
    // Franchise is an exact `franchise` value (no registry); the param is the
    // URL-encoded raw name, matching how /franchise/[slug] resolves it.
    const name = str(query.slug).trim();
    if (!name) return null;
    const heroes = await fetchHubHeroes({
      select: 'id,name',
      params: [['franchise', `eq.${name}`]],
      order: 'fame_score.desc.nullslast',
    });
    if (heroes.length === 0) return null;
    return buildFranchiseBotPage(name, heroes);
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
