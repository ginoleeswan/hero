// supabase/functions/repair-igdb-collisions/index.ts
// One-shot repair for the ComicVine cross-franchise collisions (issue #65's
// historical debt). ~82 IGDB game characters were wrongly matched to same-name
// COMIC characters by the old ungated matcher, then flagged `needs_review`.
// They aren't comic characters, so the fix isn't "find the right comic" — it's
// restore their authoritative IGDB identity (art + summary + studio publisher)
// and drop the comic link.
//
// SQL alone can't do this: the correct mugshot must be re-fetched from the IGDB
// API (we only stored igdb_id, not the image id). This function does that per
// row, in batches, then repairs each row to match a clean IGDB record:
//   image_url ← IGDB mugshot (was the wrong comic character's art)
//   summary   ← IGDB description
//   publisher ← the franchise's studio (map below, verified against clean rows)
//   comic fields (powers/enemies/friends/movies/first_issue/…) ← null
//   comicvine_status ← 'unmatched'; comicvine_id ← null
//
// Self-contained (inlines the small IGDB token+query helpers + the studio map)
// so it deploys as one file. Service-role, one-off; verify_jwt true.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Franchise → studio publisher. Derived from the ~1,000 clean (uncorrupted)
// IGDB rows already in the catalogue, and matches _shared/igdb-allowlist.ts.
const STUDIO: Record<string, string> = {
  Diablo: 'Blizzard Entertainment',
  Fallout: 'Bethesda',
  'Final Fantasy': 'Square Enix',
  'God of War': 'PlayStation Studios',
  Halo: 'Xbox Game Studios',
  'Kingdom Hearts': 'Square Enix',
  'Mass Effect': 'Electronic Arts',
  'Metal Gear': 'Konami',
  NieR: 'Square Enix',
  Persona: 'Atlus',
  'The Elder Scrolls': 'Bethesda',
  'The Witcher': 'CD Projekt Red',
  'Tomb Raider': 'Square Enix',
  'Mortal Kombat': 'NetherRealm Studios',
};

// Every comic-sourced field the bad match wrote — nulled so no wrong comic data
// survives. IGDB-restored fields (image_url, summary, publisher) are set below.
const COMIC_SCRUB = {
  comicvine_id: null,
  comicvine_enriched_at: null,
  powers: null,
  enemies: null,
  friends: null,
  creators: null,
  teams: null,
  movies: null,
  movie_count: null,
  issue_count: null,
  description: null,
  origin: null,
  first_issue_image_url: null,
  first_issue_id: null,
  first_issue_data: null,
} as const;

const mugShotUrl = (imageId?: string | null): string | null =>
  imageId ? `https://images.igdb.com/igdb/image/upload/t_720p/${imageId}.jpg` : null;

interface IgdbCharacter {
  id: number;
  name: string;
  description?: string | null;
  mug_shot?: { image_id?: string } | null;
}
interface Row {
  id: string;
  igdb_id: string | null;
  franchise: string | null;
}

async function igdbToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch token error: ${res.status} ${await res.text().catch(() => '')}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error('Twitch token error: no access_token');
  return j.access_token;
}

async function igdbCharacters(
  clientId: string,
  token: string,
  ids: string[],
): Promise<IgdbCharacter[]> {
  const res = await fetch('https://api.igdb.com/v4/characters', {
    method: 'POST',
    headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}`, Accept: 'application/json' },
    body: `fields id, name, description, mug_shot.image_id; where id = (${ids.join(',')}); limit ${ids.length};`,
  });
  if (!res.ok) throw new Error(`IGDB characters error: ${res.status} ${await res.text().catch(() => '')}`);
  return (await res.json()) as IgdbCharacter[];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: rows } = await sb
      .from('heroes')
      .select('id, igdb_id, franchise')
      .eq('comicvine_status', 'needs_review');
    const all = (rows ?? []) as Row[];
    if (all.length === 0) return json({ message: 'queue empty', repaired: 0 });

    const clientId = Deno.env.get('IGDB_CLIENT_ID') ?? '';
    const token = await igdbToken(clientId, Deno.env.get('IGDB_CLIENT_SECRET') ?? '');

    // Batch-fetch IGDB mugshot + description for every row that has an igdb_id.
    const withIgdb = all.filter((r) => r.igdb_id);
    const charById = new Map<string, IgdbCharacter>();
    for (let i = 0; i < withIgdb.length; i += 100) {
      const ids = withIgdb.slice(i, i + 100).map((r) => r.igdb_id as string);
      const chars = await igdbCharacters(clientId, token, ids);
      for (const c of chars) charById.set(String(c.id), c);
      await sleep(300); // IGDB ~4 req/s
    }

    let repaired = 0;
    let artRestored = 0;
    let noArt = 0;
    let noIgdb = 0;
    const failures: string[] = [];

    for (const r of all) {
      const studio = (r.franchise && STUDIO[r.franchise]) || null;
      const c = r.igdb_id ? charById.get(r.igdb_id) : undefined;
      const art = c ? mugShotUrl(c.mug_shot?.image_id) : null;

      const patch: Record<string, unknown> = {
        ...COMIC_SCRUB,
        comicvine_status: 'unmatched',
        ...(studio ? { publisher: studio } : {}),
        image_url: art, // restored IGDB art, or null (never keep the wrong comic image)
        summary: c ? (c.description ?? null) : null,
        ...(c ? { igdb_status: 'enriched' } : {}),
      };

      if (art) artRestored++;
      else if (!r.igdb_id) noIgdb++;
      else noArt++;

      const { error } = await sb.from('heroes').update(patch).eq('id', r.id);
      if (error) failures.push(`${r.id}: ${error.message}`);
      else repaired++;
    }

    return json({
      queue: all.length,
      repaired,
      artRestored,
      noArt,
      noIgdb,
      failures: failures.length,
      failureDetail: failures.slice(0, 5),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'repair failed' }, 500);
  }
});
