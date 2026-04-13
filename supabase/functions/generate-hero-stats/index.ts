import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI } from 'https://esm.sh/@google/genai@1';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

/** Strip HTML tags and collapse whitespace */
const stripHtml = (html: string): string =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

interface HeroStats {
  intelligence: number;
  strength: number;
  speed: number;
  durability: number;
  power: number;
  combat: number;
}

function isValidStats(obj: unknown): obj is HeroStats {
  if (!obj || typeof obj !== 'object') return false;
  const keys: (keyof HeroStats)[] = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'];
  return keys.every((k) => {
    const v = (obj as Record<string, unknown>)[k];
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { heroId } = (await req.json()) as { heroId: string };
    if (!heroId) return json({ error: 'heroId required' }, 400);

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Fetch hero row
    const { data: hero, error: heroErr } = await sb
      .from('heroes')
      .select('name, powers, summary, origin, description, intelligence, ai_stats_status')
      .eq('id', heroId)
      .single();

    if (heroErr || !hero) return json({ error: 'Hero not found' }, 404);

    // Idempotency guard
    if (hero.ai_stats_status === 'done' || hero.ai_stats_status === 'failed') {
      return json({
        intelligence: hero.intelligence,
        message: `Already processed (${hero.ai_stats_status})`,
      });
    }

    // Build prompt
    const descriptionSnippet = hero.description
      ? stripHtml(hero.description).slice(0, 800)
      : '';
    const powersText = Array.isArray(hero.powers) ? (hero.powers as string[]).join(', ') : '';

    const prompt = `You are a comic book analyst. Based only on the character data below, estimate their combat stats on a scale of 0–100.

Character: ${hero.name}
Origin: ${hero.origin ?? 'Unknown'}
Powers: ${powersText || 'None listed'}
Summary: ${hero.summary ?? 'None'}
Description: ${descriptionSnippet || 'None'}

Reference anchors:
- Average human: strength 10, speed 10, durability 20, intelligence 50, power 5, combat 30
- Peak human (Batman, Captain America): strength 30, speed 35, durability 40, combat 85
- Street-level superhuman (Spider-Man): strength 55, speed 60, durability 50
- Cosmic-level (Superman, Thor): strength 100, speed 95, durability 100, power 95
- Intelligence 100 = Reed Richards, Lex Luthor level

Return ONLY valid JSON with these exact keys, no explanation:
{"intelligence":0,"strength":0,"speed":0,"durability":0,"power":0,"combat":0}`;

    // Call Gemini
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const rawText = result.text?.trim() ?? '';
    let stats: unknown;
    try {
      stats = JSON.parse(rawText);
    } catch {
      await sb.from('heroes').update({ ai_stats_status: 'failed' }).eq('id', heroId);
      return json({ error: 'Invalid JSON from Gemini', raw: rawText }, 502);
    }

    if (!isValidStats(stats)) {
      await sb.from('heroes').update({ ai_stats_status: 'failed' }).eq('id', heroId);
      return json({ error: 'Stats validation failed', stats }, 502);
    }

    // Write to DB
    await sb.from('heroes').update({
      intelligence: stats.intelligence,
      strength: stats.strength,
      speed: stats.speed,
      durability: stats.durability,
      power: stats.power,
      combat: stats.combat,
      stats_source: 'ai',
      ai_stats_status: 'done',
    }).eq('id', heroId);

    return json(stats);
  } catch (err) {
    console.error('[generate-hero-stats]', err);
    return json({ error: 'Internal error' }, 500);
  }
});
