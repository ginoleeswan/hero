// enrich-blurhash-batch: backfill heroes.portrait_blurhash with a BlurHash LQIP
// for each portrait, so cards/banners/detail art show an instant blurred preview
// instead of a blank box that pops in. Prioritised by fame_score (above-the-fold
// heroes first); drained by repeated invocation. Idempotent: only touches rows
// where portrait_blurhash IS NULL.
//
// POST body: { limit?: number (1-50, default 20) }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts';
import { encode } from 'https://esm.sh/blurhash@2.0.5';

type SB = ReturnType<typeof createClient>;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isPlaceholder = (url: string) => url.includes('blank.png') || url.includes('no-portrait');

// Smallest sensible variant to decode — we only need ~32px for a BlurHash, so
// pull the cheapest bytes each host offers (mirrors withCloudinaryTransform /
// withComicVineScale in src/constants/heroImages.ts).
function smallVariant(url: string): string {
  if (url.includes('res.cloudinary.com')) {
    const i = url.indexOf('/upload/');
    if (i !== -1) {
      const at = i + '/upload/'.length;
      return `${url.slice(0, at)}f_jpg,q_auto:low,w_64/${url.slice(at)}`;
    }
  }
  const cv = url.indexOf('comicvine.gamespot.com/a/uploads/');
  if (cv !== -1) {
    const segStart = cv + 'comicvine.gamespot.com/a/uploads/'.length;
    const rest = url.slice(segStart);
    const slash = rest.indexOf('/');
    if (slash !== -1) return `${url.slice(0, segStart)}square_small${rest.slice(slash)}`;
  }
  return url;
}

async function hashFor(url: string): Promise<string | null> {
  const res = await fetch(smallVariant(url));
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const img = await Image.decode(bytes);
  // Downscale to a tiny canvas — BlurHash only captures coarse colour/structure.
  img.resize(32, 32);
  const pixels = Uint8ClampedArray.from(img.bitmap); // RGBA
  return encode(pixels, img.width, img.height, 4, 3);
}

async function runBackfill(sb: SB, limit: number): Promise<{ done: number; failed: number }> {
  const { data, error } = await sb
    .from('heroes')
    .select('id, portrait_url, image_url')
    .is('portrait_blurhash', null)
    .or('portrait_url.not.is.null,image_url.not.is.null')
    .order('fame_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    id: string;
    portrait_url: string | null;
    image_url: string | null;
  }>;

  const deadline = Date.now() + 50_000;
  let done = 0;
  let failed = 0;
  for (const h of rows) {
    if (Date.now() > deadline) break;
    const url = h.portrait_url ?? h.image_url ?? '';
    // No real URL (or a known placeholder): stamp '' so we don't reselect it.
    if (!url.startsWith('http') || isPlaceholder(url)) {
      await sb.from('heroes').update({ portrait_blurhash: '' }).eq('id', h.id);
      continue;
    }
    try {
      const hash = await hashFor(url);
      // Empty-string sentinel on failure (falsy → no placeholder) so a broken or
      // undecodable image isn't reprocessed every run.
      await sb.from('heroes').update({ portrait_blurhash: hash ?? '' }).eq('id', h.id);
      if (hash) done++;
      else failed++;
    } catch (err) {
      console.error('[enrich-blurhash-batch] failed', h.id, err);
      await sb.from('heroes').update({ portrait_blurhash: '' }).eq('id', h.id);
      failed++;
    }
    await sleep(50);
  }
  return { done, failed };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let limit = 20;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.limit === 'number') limit = Math.min(Math.max(1, body.limit), 50);
  } catch {
    /* empty body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  try {
    const { done, failed } = await runBackfill(sb, limit);
    return json({ done, failed, message: done + failed === 0 ? 'nothing to do' : 'ok' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
