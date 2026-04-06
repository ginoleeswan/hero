import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface VerdictRequest {
  heroA: string;
  heroB: string;
  winsA: number;
  winsB: number;
  statsA: Record<string, number>;
  statsB: Record<string, number>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const body: VerdictRequest = await req.json();
    const { heroA, heroB, winsA, winsB, statsA, statsB } = body;

    const winner = winsA >= winsB ? heroA : heroB;
    const loser  = winsA >= winsB ? heroB : heroA;
    const winnerWins = Math.max(winsA, winsB);
    const loserWins  = Math.min(winsA, winsB);

    const winnerStats = winsA >= winsB ? statsA : statsB;
    const loserStats  = winsA >= winsB ? statsB : statsA;

    const statNames = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'];
    const wonStats  = statNames.filter((s) => (winnerStats[s] ?? 0) > (loserStats[s] ?? 0));
    const lostStats = statNames.filter((s) => (loserStats[s] ?? 0) > (winnerStats[s] ?? 0));

    const prompt = winsA === winsB
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
    const verdict: string =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    if (!verdict) throw new Error('Empty Gemini response');

    return new Response(JSON.stringify({ verdict }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('[generate-verdict]', err);
    return new Response(JSON.stringify({ verdict: null }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
