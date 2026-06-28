import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COMICVINE_API_KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

const OK = { ok: true };
const FAIL = { ok: false };

interface ImageRow {
  hero_id: string;
  url: string;
  source: string;
  caption: string | null;
  issue_id: string | null;
  sort_order: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { heroId, comicvineId } = (await req.json()) as {
      heroId: string;
      comicvineId: string;
    };
    if (!heroId || !comicvineId) {
      return json({ error: 'heroId and comicvineId required' }, 400);
    }

    const numericId = comicvineId.replace(/^4005-/, '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // One character call: primary image + every issue credit ({id, name, api_detail_url}).
    const charParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      field_list: 'image,issue_credits',
    });
    const charRes = await fetch(`${COMICVINE_BASE}/character/4005-${numericId}/?${charParams}`);
    const charJson = charRes.ok ? await charRes.json() : {};
    const results = charJson.results ?? {};

    const rows: ImageRow[] = [];

    // Primary character image → the lead "artwork of the character".
    const primaryUrl: string | null =
      ((results.image as Record<string, unknown>)?.super_url as string) ??
      ((results.image as Record<string, unknown>)?.original_url as string) ??
      null;
    if (primaryUrl) {
      rows.push({
        hero_id: heroId,
        url: primaryUrl,
        source: 'comicvine_primary',
        caption: null,
        issue_id: null,
        sort_order: 0,
      });
    }

    // Cover art from the first 40 appearances.
    const credits: Array<Record<string, unknown>> = Array.isArray(results.issue_credits)
      ? results.issue_credits
      : [];
    const first40 = credits.slice(0, 40);
    const covers = await Promise.all(
      first40.map(async (credit, i) => {
        const apiDetailUrl =
          typeof credit.api_detail_url === 'string' ? credit.api_detail_url : null;
        if (!apiDetailUrl) return null;
        try {
          const params = new URLSearchParams({
            api_key: COMICVINE_API_KEY,
            format: 'json',
            field_list: 'image,name,issue_number,cover_date',
          });
          const res = await fetch(`${apiDetailUrl}?${params}`);
          if (!res.ok) return null;
          const data = (await res.json()).results ?? {};
          const img = data.image as Record<string, unknown> | undefined;
          const url: string | null =
            ((img?.original_url as string) ?? (img?.medium_url as string)) ?? null;
          if (!url) return null;
          return {
            hero_id: heroId,
            url,
            source: 'comicvine_cover',
            caption: typeof data.name === 'string' ? data.name : null,
            issue_id: credit.id != null ? String(credit.id) : null,
            sort_order: i + 1,
          } as ImageRow;
        } catch {
          return null;
        }
      }),
    );
    for (const c of covers) if (c) rows.push(c);

    if (rows.length > 0) {
      await supabase.from('hero_images').upsert(rows, {
        onConflict: 'hero_id,url',
        ignoreDuplicates: true,
      });
    }

    // Sentinel so this runs once per hero, even when there were no images.
    await supabase
      .from('heroes')
      .update({ gallery_enriched_at: new Date().toISOString() })
      .eq('id', heroId);

    return json(OK);
  } catch (err) {
    console.error('[get-hero-gallery]', err);
    return json(FAIL, 500);
  }
});
