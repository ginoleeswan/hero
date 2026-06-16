import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_KEY = Deno.env.get('GOOGLE_AI_STUDIO_API_KEY') ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface VerdictRequest {
  // Hero ids are optional for backwards compatibility with older app builds;
  // when both are present the verdict is read/written from the shared cache.
  heroAId?: string;
  heroBId?: string;
  heroA: string;
  heroB: string;
  winsA: number;
  winsB: number;
  statsA: Record<string, number>;
  statsB: Record<string, number>;
}

// Store/look up with the lexicographically smaller id first so A vs B and B vs A
// share a single row. Mirrors normalizeKey in src/lib/db/verdicts.ts.
function normalizeKey(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  try {
    const body: VerdictRequest = await req.json();
    const { heroAId, heroBId, heroA, heroB, winsA, winsB, statsA, statsB } = body;

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const canCache = Boolean(heroAId) && Boolean(heroBId);
    let keyA = '';
    let keyB = '';
    if (canCache) {
      [keyA, keyB] = normalizeKey(heroAId as string, heroBId as string);
      // Read-through: another client may have already generated this pair.
      const { data: cached } = await sb
        .from('verdicts')
        .select('verdict')
        .eq('hero_a_id', keyA)
        .eq('hero_b_id', keyB)
        .maybeSingle();
      if (cached?.verdict) return json({ verdict: cached.verdict });
    }

    const winner = winsA >= winsB ? heroA : heroB;
    const loser = winsA >= winsB ? heroB : heroA;
    const winnerWins = Math.max(winsA, winsB);
    const loserWins = Math.min(winsA, winsB);

    const winnerStats = winsA >= winsB ? statsA : statsB;
    const loserStats = winsA >= winsB ? statsB : statsA;

    const statNames = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'];
    const wonStats = statNames.filter((s) => (winnerStats[s] ?? 0) > (loserStats[s] ?? 0));
    const lostStats = statNames.filter((s) => (loserStats[s] ?? 0) > (winnerStats[s] ?? 0));

    const prompt =
      winsA === winsB
        ? `${heroA} and ${heroB} tied 3-3 in a superhero stat battle. Write one punchy sentence declaring it a draw. Be dramatic. Max 15 words. No hashtags. No emoji.`
        : `${winner} beat ${loser} ${winnerWins}-${loserWins} in a superhero stat battle. ${winner} won: ${wonStats.join(', ')}. ${loser} won: ${lostStats.join(', ') || 'none'}. Write one punchy sentence declaring ${winner} the winner. Be dramatic. Max 15 words. No hashtags. No emoji.`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 60, temperature: 0.9 },
      }),
    });

    if (!geminiRes.ok) throw new Error(`Gemini error: ${geminiRes.status}`);

    const geminiData = await geminiRes.json();
    const verdict: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!verdict) throw new Error('Empty Gemini response');

    // Persist to the shared cache (service_role bypasses RLS). Only successful
    // generations are cached — never the client-side fallback string.
    if (canCache) {
      await sb
        .from('verdicts')
        .upsert({ hero_a_id: keyA, hero_b_id: keyB, verdict }, { onConflict: 'hero_a_id,hero_b_id' });
    }

    return new Response(JSON.stringify({ verdict }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (err) {
    console.error('[generate-verdict]', err);
    return new Response(JSON.stringify({ verdict: null }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
