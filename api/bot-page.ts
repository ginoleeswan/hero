// Search-crawler content pages. Search engines (matched by user-agent rewrites
// in vercel.json) land here instead of the static SPA shell and get fully
// rendered, internally-linked HTML for /character pages — the SPA renders
// nothing without JS, so this route is what makes the catalogue indexable.
// Social preview bots stay on /api/share-meta; humans never hit either.
import {
  buildCharacterBotPage,
  buildNotFoundPage,
  type BotHero,
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
      body: JSON.stringify({ p_hero_id: heroId, p_kind: kind, p_limit: 12, p_same_universe: false }),
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

export default async function handler(req: Req, res: Res) {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  try {
    const kind = str(req.query.kind);
    const id = str(req.query.id);
    if (kind === 'character' && id) {
      const hero = await fetchHero(id);
      if (hero) {
        const [allies, enemies, teammates] = await Promise.all([
          fetchRelated(hero.id, 'ally'),
          fetchRelated(hero.id, 'enemy'),
          fetchRelated(hero.id, 'teammate'),
        ]);
        // A day at the edge + a week stale: crawl bursts never hammer Supabase,
        // and catalogue edits still surface within a day.
        res.setHeader('cache-control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        res.status(200).send(buildCharacterBotPage(hero, { allies, enemies, teammates }));
        return;
      }
    }
  } catch {
    // fall through to the noindex 404 — never serve a crawler a 500
  }
  res.setHeader('cache-control', 'public, s-maxage=3600');
  res.status(404).send(buildNotFoundPage());
}
