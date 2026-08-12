// Bot-facing share meta. Link-preview crawlers (matched by user-agent rewrites
// in vercel.json) land here instead of the static SPA shell, so shared
// /character and /compare links unfurl with page-specific OG tags. Humans never
// hit this route; if they do, the meta-refresh sends them to the real page.
// Any lookup failure falls back to the site-wide card — never a broken unfurl.
import {
  buildMetaHtml,
  characterMeta,
  debateMeta,
  eventMeta,
  houseMeta,
  siteMeta,
  titleMeta,
  universeMeta,
  vsMeta,
  type EventLite,
  type HeroLite,
  type HouseLite,
  type TitleLite,
} from './_lib/shareMeta';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

// Minimal req/res typing — avoids a dependency on @vercel/node just for types.
type Req = { query: Record<string, string | string[] | undefined> };
type Res = {
  setHeader: (k: string, v: string) => void;
  status: (code: number) => { send: (body: string) => void };
};

async function fetchHero(id: string): Promise<HeroLite | null> {
  const url = `${SUPABASE_URL}/rest/v1/heroes?id=eq.${encodeURIComponent(
    id,
  )}&select=id,name,publisher`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!r.ok) return null;
  const rows = (await r.json()) as HeroLite[];
  return rows[0] ?? null;
}

async function fetchTally(a: string, b: string): Promise<{ votes_a: number; votes_b: number }> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_matchup_tally`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_a: a, p_b: b }),
    });
    if (!r.ok) return { votes_a: 0, votes_b: 0 };
    const t = (await r.json()) as { votes_a?: number; votes_b?: number };
    return { votes_a: t.votes_a ?? 0, votes_b: t.votes_b ?? 0 };
  } catch {
    return { votes_a: 0, votes_b: 0 };
  }
}

// Just the headline number for the description. A failure here costs a phrase,
// never the unfurl, so it degrades to 0 and the sentence drops the count.
async function fetchConnectionCount(id: string): Promise<number> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_hero_neighborhood`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_hero_id: id, p_limit: 24 }),
    });
    if (!r.ok) return 0;
    const j = (await r.json()) as { nodes?: unknown[] };
    return Math.max(0, (j.nodes?.length ?? 0) - 1);
  } catch {
    return 0;
  }
}

async function fetchHouse(slug: string): Promise<HouseLite | null> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/houses?slug=eq.${encodeURIComponent(
        slug,
      )}&select=slug,name,universe,house_members(count)`,
      { headers: { apikey: SUPABASE_KEY } },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as {
      slug: string;
      name: string;
      universe: string | null;
      house_members: { count: number }[] | null;
    }[];
    const row = rows[0];
    if (!row) return null;
    return {
      slug: row.slug,
      name: row.name,
      universe: row.universe,
      memberCount: row.house_members?.[0]?.count ?? 0,
    };
  } catch {
    return null;
  }
}

async function fetchEvent(slug: string): Promise<EventLite | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_event_dossier`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_slug: slug }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { event?: Record<string, unknown> } | null;
    const e = j?.event;
    if (!e || typeof e.slug !== 'string' || typeof e.headline !== 'string') return null;
    return {
      slug: e.slug,
      headline: e.headline,
      blurb: typeof e.blurb === 'string' ? e.blurb : null,
      ongoing: e.ongoing === true,
    };
  } catch {
    return null;
  }
}

async function fetchTitle(id: string): Promise<TitleLite | null> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/titles?id=eq.${encodeURIComponent(
        id,
      )}&select=id,title,year,media_type`,
      { headers: { apikey: SUPABASE_KEY } },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as {
      id: string;
      title: string;
      year: number | null;
      media_type: string | null;
    }[];
    const t = rows[0];
    if (!t) return null;
    return { id: t.id, title: t.title, year: t.year, mediaType: t.media_type };
  } catch {
    return null;
  }
}

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

export default async function handler(req: Req, res: Res) {
  let meta = siteMeta();
  try {
    const kind = str(req.query.kind);
    if (kind === 'character') {
      const hero = await fetchHero(str(req.query.id));
      if (hero) meta = characterMeta(hero);
    } else if (kind === 'universe') {
      const hero = await fetchHero(str(req.query.id));
      if (hero) meta = universeMeta(hero, await fetchConnectionCount(hero.id));
    } else if (kind === 'vs' || kind === 'debate') {
      const [a, b] = await Promise.all([fetchHero(str(req.query.a)), fetchHero(str(req.query.b))]);
      if (a && b) {
        const tally = await fetchTally(a.id, b.id);
        meta =
          kind === 'debate'
            ? debateMeta(a, b, tally.votes_a, tally.votes_b)
            : vsMeta(a, b, tally.votes_a, tally.votes_b);
      }
    } else if (kind === 'house') {
      const house = await fetchHouse(str(req.query.slug));
      if (house) meta = houseMeta(house);
    } else if (kind === 'event') {
      const event = await fetchEvent(str(req.query.slug));
      if (event) meta = eventMeta(event);
    } else if (kind === 'title') {
      const t = await fetchTitle(str(req.query.id));
      if (t) meta = titleMeta(t);
    }
  } catch {
    // fall through to site meta
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // Crawler caches are short-lived anyway; a day at the edge keeps us cheap.
  res.setHeader('cache-control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(buildMetaHtml(meta));
}
