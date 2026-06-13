// supabase/functions/comicvine-ping/index.ts
//
// Lightweight ComicVine health probe for the admin console. One cheap character
// call → reports whether ComicVine is healthy, rate-limited, or erroring, without
// exposing the API key to the browser.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const COMICVINE_API_KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const res = await fetch(
      `https://comicvine.gamespot.com/api/character/4005-1443/?api_key=${COMICVINE_API_KEY}&format=json&field_list=id`,
    );
    if (!res.ok) {
      const transient = res.status === 420 || res.status === 429 || res.status >= 500;
      return json({ status: transient ? 'limited' : 'error', http: res.status });
    }
    const body = await res.json();
    // 107 = ComicVine "Rate limit exceeded" (returned with HTTP 200); 1 = OK.
    if (body?.status_code === 107) return json({ status: 'limited' });
    if (body?.status_code === 1) return json({ status: 'ok' });
    return json({ status: 'error', code: body?.status_code ?? null });
  } catch (_err) {
    return json({ status: 'error' });
  }
});
