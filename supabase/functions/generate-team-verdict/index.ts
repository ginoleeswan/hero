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

interface Req { teamAId: string; teamBId: string; teamA: string; teamB: string; splitA: number; splitB: number; }
const norm = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

function fallback(b: Req): string {
  if (b.splitA === b.splitB) return `${b.teamA} and ${b.teamB} are dead even.`;
  return `${b.splitA > b.splitB ? b.teamA : b.teamB} take it — synergy and stats favour them.`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
  try {
    const body: Req = await req.json();
    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const [keyA, keyB] = norm(body.teamAId, body.teamBId);

    const { data: cached } = await sb.from('team_verdicts').select('verdict')
      .eq('team_a_id', keyA).eq('team_b_id', keyB).maybeSingle();
    if (cached?.verdict) return json({ verdict: cached.verdict });

    let verdict = fallback(body);
    let generated = false; // only persist a real AI verdict, never the fallback
    if (GEMINI_KEY) {
      const prompt = `Two superhero teams clash. ${body.teamA} vs ${body.teamB}. ` +
        `Combined power favours ${body.splitA >= body.splitB ? body.teamA : body.teamB} ` +
        `(${Math.max(body.splitA, body.splitB)}%). In one punchy sentence (<=20 words), call the winner and why.`;
      try {
        const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (text) { verdict = text; generated = true; }
        }
      } catch { /* keep fallback */ }
    }
    // Cache only genuine AI output — caching the fallback on an outage would
    // poison the pair's verdict permanently (read-through returns it forever).
    if (generated) {
      await sb.from('team_verdicts').upsert({ team_a_id: keyA, team_b_id: keyB, verdict }, { onConflict: 'team_a_id,team_b_id' });
    }
    return json({ verdict });
  } catch (err) {
    console.error('[generate-team-verdict]', err);
    return json({ verdict: null }, 200);
  }
});
