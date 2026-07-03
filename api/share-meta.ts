// Bot-facing share meta. Link-preview crawlers (matched by user-agent rewrites
// in vercel.json) land here instead of the static SPA shell, so shared
// /character and /compare links unfurl with page-specific OG tags. Humans never
// hit this route; if they do, the meta-refresh sends them to the real page.
// Any lookup failure falls back to the site-wide card — never a broken unfurl.
import {
  buildMetaHtml,
  characterMeta,
  siteMeta,
  vsMeta,
  type HeroLite,
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
    id
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
    } else if (kind === 'vs') {
      const [a, b] = await Promise.all([fetchHero(str(req.query.a)), fetchHero(str(req.query.b))]);
      if (a && b) {
        const tally = await fetchTally(a.id, b.id);
        meta = vsMeta(a, b, tally.votes_a, tally.votes_b);
      }
    }
  } catch {
    // fall through to site meta
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // Crawler caches are short-lived anyway; a day at the edge keeps us cheap.
  res.setHeader('cache-control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(buildMetaHtml(meta));
}
