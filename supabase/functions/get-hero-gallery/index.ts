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

const NULL_RESPONSE = { issueCovers: null };

interface Cover {
  url: string;
  name: string | null;
  issueNumber: string | null;
  year: string | null;
  /** ComicVine issue id — lets the cover open the /issue/[id] read-through page. */
  id: string | null;
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

    // Strip any "4005-" prefix — the character endpoint just needs the numeric id
    const numericId = comicvineId.replace(/^4005-/, '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // The character's issue credits — one cheap call carrying {id, name} per issue.
    const creditsParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      field_list: 'issue_credits',
    });
    const creditsRes = await fetch(`${COMICVINE_BASE}/character/4005-${numericId}/?${creditsParams}`);
    let credits: Array<Record<string, unknown>> = [];
    if (creditsRes.ok) {
      const creditsJson = await creditsRes.json();
      credits = Array.isArray(creditsJson.results?.issue_credits)
        ? creditsJson.results.issue_credits
        : [];
    }
    const idByName = new Map<string, string>();
    for (const c of credits) {
      const nm = typeof c.name === 'string' ? c.name : null;
      if (nm && c.id != null && !idByName.has(nm)) idByName.set(nm, String(c.id));
    }

    // Existing cached covers — if present, we only need to backfill their ids
    // (cheap, no per-issue refetch). If absent, do the full first-time fetch.
    const { data: heroRow } = await supabase
      .from('heroes')
      .select('issue_covers')
      .eq('id', heroId)
      .maybeSingle();
    const existing = (heroRow?.issue_covers as Cover[] | null) ?? null;

    let issueCovers: Cover[] | null = null;

    if (existing && existing.length > 0) {
      // ── Backfill path: keep the covers, add ids by name match. ───────────────
      issueCovers = existing.map((c) => ({
        url: c.url,
        name: c.name ?? null,
        issueNumber: c.issueNumber ?? null,
        year: c.year ?? null,
        id: c.id ?? (c.name ? idByName.get(c.name) ?? null : null),
      }));
    } else {
      // ── First-time path: fetch the first 20 appearances' cover images. ───────
      const first20 = credits.slice(0, 20);
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
              id: credit.id != null ? String(credit.id) : null,
            } as Cover;
          } catch {
            return null;
          }
        }),
      );
      const valid = covers.filter((c): c is Cover => c !== null);
      issueCovers = valid.length > 0 ? valid : null;
    }

    // Persist. gallery_enriched_at is the sentinel so heroes with no covers don't
    // re-trigger this on every visit. Never null out covers we already have.
    const patch: Record<string, unknown> = { gallery_enriched_at: new Date().toISOString() };
    if (issueCovers && issueCovers.length > 0) patch.issue_covers = issueCovers;
    await supabase.from('heroes').update(patch).eq('id', heroId);

    return json({ issueCovers });
  } catch (err) {
    console.error('[get-hero-gallery]', err);
    return json(NULL_RESPONSE, 500);
  }
});
