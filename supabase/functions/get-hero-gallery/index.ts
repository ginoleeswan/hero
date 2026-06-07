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

const NULL_RESPONSE = { galleryImages: null, issueCovers: null };

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

    // Strip any "4005-" prefix — the images endpoint just needs the numeric id
    const numericId = comicvineId.replace(/^4005-/, '');

    // ── Character art images ──────────────────────────────────────────────────
    let galleryImages: Array<{ url: string; tags: string | null }> | null = null;
    const artParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      filter: `object_type:character,object_id:${numericId}`,
      field_list: 'image,image_tags',
      limit: '12',
    });
    const artRes = await fetch(`${COMICVINE_BASE}/images/?${artParams}`);
    if (artRes.ok) {
      const artJson = await artRes.json();
      const items: Array<{ url: string; tags: string | null }> = (artJson.results ?? [])
        .map((r: unknown) => {
          const row = r as Record<string, unknown>;
          const img = row.image as Record<string, unknown> | undefined;
          const url: string | null = (img?.medium_url as string) ?? null;
          const tags: string | null =
            typeof row.image_tags === 'string' ? row.image_tags : null;
          return url ? { url, tags } : null;
        })
        .filter(
          (x: { url: string; tags: string | null } | null): x is { url: string; tags: string | null } =>
            x !== null,
        );
      galleryImages = items.length > 0 ? items : null;
    }

    // ── Issue covers ──────────────────────────────────────────────────────────
    let issueCovers: Array<{
      url: string;
      name: string | null;
      issueNumber: string | null;
      year: string | null;
    }> | null = null;

    const creditsParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      field_list: 'issue_credits',
    });
    const creditsRes = await fetch(
      `${COMICVINE_BASE}/character/4005-${numericId}/?${creditsParams}`,
    );
    if (creditsRes.ok) {
      const creditsJson = await creditsRes.json();
      const rawCredits: Array<Record<string, unknown>> = Array.isArray(
        creditsJson.results?.issue_credits,
      )
        ? creditsJson.results.issue_credits
        : [];

      const first20 = rawCredits.slice(0, 20);

      const covers = await Promise.all(
        first20.map(async (credit) => {
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
            const url: string | null =
              ((data.image as Record<string, unknown>)?.medium_url as string) ?? null;
            if (!url) return null;
            const coverDate: string | null =
              typeof data.cover_date === 'string' ? data.cover_date : null;
            return {
              url,
              name: typeof data.name === 'string' ? data.name : null,
              issueNumber: data.issue_number != null ? String(data.issue_number) : null,
              year: coverDate ? coverDate.slice(0, 4) : null,
            };
          } catch {
            return null;
          }
        }),
      );

      const validCovers = covers.filter(
        (
          c,
        ): c is { url: string; name: string | null; issueNumber: string | null; year: string | null } =>
          c !== null,
      );
      issueCovers = validCovers.length > 0 ? validCovers : null;
    }

    // ── Persist to DB ─────────────────────────────────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    await supabase
      .from('heroes')
      .update({
        gallery_images: galleryImages as unknown as Record<string, unknown>[] | null,
        issue_covers: issueCovers as unknown as Record<string, unknown>[] | null,
        gallery_enriched_at: new Date().toISOString(),
      })
      .eq('id', heroId);

    return json({ galleryImages, issueCovers });
  } catch (err) {
    console.error('[get-hero-gallery]', err);
    return json(NULL_RESPONSE, 500);
  }
});
