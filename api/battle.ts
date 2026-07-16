// /battle/:a/:b — the instant-paint ad landing (rewritten here by vercel.json).
// Serves the static vote page built in _lib/battlePage.ts: portraits, live
// tally, two vote buttons, CTA into /compare with the UTM tags passed through.
// Any lookup failure 302s to the real compare page — a paid link must never
// dead-end.
import {
  buildBattleHtml,
  compareHref,
  sanitizeUtmQuery,
  type BattleHero,
  type BattleTally,
} from './_lib/battlePage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

// Minimal req/res typing — avoids a dependency on @vercel/node just for types.
type Req = { query: Record<string, string | string[] | undefined> };
type Res = {
  setHeader: (k: string, v: string) => void;
  redirect: (code: number, url: string) => void;
  status: (code: number) => { send: (body: string) => void };
};

async function fetchHero(id: string): Promise<BattleHero | null> {
  const url = `${SUPABASE_URL}/rest/v1/heroes?id=eq.${encodeURIComponent(
    id,
  )}&select=id,name,publisher,portrait_url,image_url`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!r.ok) return null;
  const rows = (await r.json()) as BattleHero[];
  return rows[0] ?? null;
}

// Aggregate tally via the anon-granted v2 RPC (no voter key — counts only).
async function fetchTally(a: string, b: string): Promise<BattleTally> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_matchup_tally_v2`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_a: a, p_b: b, p_voter_key: null }),
    });
    if (!r.ok) return { votesA: 0, votesB: 0, total: 0 };
    const t = (await r.json()) as { votes_a?: number; votes_b?: number; total?: number };
    return { votesA: t.votes_a ?? 0, votesB: t.votes_b ?? 0, total: t.total ?? 0 };
  } catch {
    return { votesA: 0, votesB: 0, total: 0 };
  }
}

function str(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

export default async function handler(req: Req, res: Res) {
  const aId = str(req.query.a);
  const bId = str(req.query.b);
  const utmQuery = sanitizeUtmQuery(req.query);
  const fallback = aId && bId ? compareHref(aId, bId, utmQuery) : '/';

  try {
    const [a, b, tally] = await Promise.all([fetchHero(aId), fetchHero(bId), fetchTally(aId, bId)]);
    if (!a || !b) {
      res.redirect(302, fallback);
      return;
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    // Short edge cache: the tally may drift a minute — fine for a teaser count.
    res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=600');
    res.status(200).send(
      buildBattleHtml({
        a,
        b,
        tally,
        utmQuery,
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_KEY,
      }),
    );
  } catch {
    res.redirect(302, fallback);
  }
}
