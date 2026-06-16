#!/usr/bin/env bun
/**
 * Backfill AI-estimated powerstats + alignment for heroes that lack them.
 *
 * The ComicVine-ingested heroes (~2.4k) have no powerstats and no alignment,
 * so the compare/battle feature and alignment filters don't work for them.
 * This walks every hero with ai_stats_status = 'pending', asks Gemini to
 * estimate the six stats (0–100) and a moral alignment from its name/summary/
 * description/powers, and writes them back (stats_source='ai', status='done').
 *
 * Idempotent + resumable: only touches 'pending' rows, marks each 'done' or
 * 'failed', so re-running picks up where it left off.
 *
 * Usage:
 *   bun scripts/backfill-hero-stats.ts --limit 15        # test on 15
 *   bun scripts/backfill-hero-stats.ts --dry-run --limit 5
 *   bun scripts/backfill-hero-stats.ts --concurrency 8   # full run
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GOOGLE_AI_STUDIO_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_API_KEY) {
  console.error(
    'Missing env: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_AI_STUDIO_API_KEY',
  );
  process.exit(1);
}

const MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const arg = (flag: string): string | null =>
  process.argv.includes(flag) ? (process.argv[process.argv.indexOf(flag) + 1] ?? null) : null;
const has = (flag: string) => process.argv.includes(flag);

const LIMIT = arg('--limit') ? parseInt(arg('--limit')!, 10) : Infinity;
const CONCURRENCY = arg('--concurrency') ? parseInt(arg('--concurrency')!, 10) : 6;
const DRY_RUN = has('--dry-run');

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

type Row = {
  id: string;
  name: string;
  powers: string[] | null;
  summary: string | null;
  origin: string | null;
  description: string | null;
  alignment: string | null;
};

type Stats = {
  intelligence: number;
  strength: number;
  speed: number;
  durability: number;
  power: number;
  combat: number;
  alignment: 'good' | 'bad' | 'neutral';
};

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function validate(o: unknown): o is Stats {
  if (!o || typeof o !== 'object') return false;
  const r = o as Record<string, unknown>;
  const statKeys = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'] as const;
  const statsOk = statKeys.every(
    (k) =>
      typeof r[k] === 'number' &&
      Number.isInteger(r[k]) &&
      (r[k] as number) >= 0 &&
      (r[k] as number) <= 100,
  );
  const alignOk = r.alignment === 'good' || r.alignment === 'bad' || r.alignment === 'neutral';
  return statsOk && alignOk;
}

function buildPrompt(h: Row): string {
  const desc = h.description ? stripHtml(h.description).slice(0, 800) : '';
  const powers = Array.isArray(h.powers) ? h.powers.join(', ') : '';
  return `You are a comic book analyst. Estimate this character's combat stats (0–100) and moral alignment, using the data below TOGETHER WITH your own knowledge of the character.

Character: ${h.name}
Origin: ${h.origin ?? 'Unknown'}
Powers: ${powers || 'None listed'}
Summary: ${h.summary ?? 'None'}
Description: ${desc || 'None'}

Data caveat: the "Powers" list is sometimes wrong — copied from a related
character during data import (e.g. a normal journalist listed with Superman's
powers). If the listed powers clearly contradict who this character actually is,
trust the character's TRUE canonical abilities, not the erroneous list.

Reference anchors:
- Average human: strength 10, speed 10, durability 20, intelligence 50, power 5, combat 30
- Peak human (Batman, Captain America): strength 30, speed 35, durability 40, combat 85
- Street-level superhuman (Spider-Man): strength 55, speed 60, durability 50
- Cosmic-level (Superman, Thor): strength 100, speed 95, durability 100, power 95
- Intelligence 100 = Reed Richards, Lex Luthor level

IMPORTANT: Many of these are ordinary humans with NO superhuman powers
(reporters, civilians, detectives, sidekicks, comic-relief). For anyone without
clearly superhuman abilities in their data, keep strength/speed/durability near
the average-human anchors (5–25) and power at 0–10; only give combat above 40 if
they are an explicitly trained fighter. Reserve high physical stats strictly for
characters whose powers/summary describe genuine superhuman feats. When unsure,
estimate LOW rather than high.

Alignment is one of: "good" (hero), "bad" (villain), "neutral" (anti-hero or morally grey).

Return ONLY valid JSON with these exact keys, no explanation:
{"intelligence":0,"strength":0,"speed":0,"durability":0,"power":0,"combat":0,"alignment":"good"}`;
}

async function callGemini(prompt: string, retries = 2): Promise<Stats | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) return null;
      const parsed = JSON.parse(text);
      return validate(parsed) ? parsed : null;
    } catch {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

async function fetchPending(): Promise<Row[]> {
  const all: Row[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('heroes')
      .select('id, name, powers, summary, origin, description, alignment')
      .eq('ai_stats_status', 'pending')
      .order('issue_count', { ascending: false, nullsFirst: false })
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as Row[]));
    if (data.length < 1000) break;
    offset += 1000;
    if (all.length >= LIMIT) break;
  }
  return all.slice(0, LIMIT === Infinity ? undefined : LIMIT);
}

async function processOne(h: Row): Promise<'done' | 'failed'> {
  const stats = await callGemini(buildPrompt(h));
  if (!stats) {
    if (!DRY_RUN) await sb.from('heroes').update({ ai_stats_status: 'failed' }).eq('id', h.id);
    return 'failed';
  }
  if (DRY_RUN) {
    console.log(
      `  [dry] ${h.name}: INT${stats.intelligence} STR${stats.strength} SPD${stats.speed} DUR${stats.durability} POW${stats.power} CBT${stats.combat} · ${stats.alignment}`,
    );
    return 'done';
  }
  const update: Record<string, unknown> = {
    intelligence: stats.intelligence,
    strength: stats.strength,
    speed: stats.speed,
    durability: stats.durability,
    power: stats.power,
    combat: stats.combat,
    stats_source: 'ai',
    ai_stats_status: 'done',
  };
  // Only set alignment where it's missing — never clobber curated values.
  if (!h.alignment) update.alignment = stats.alignment;
  await sb.from('heroes').update(update).eq('id', h.id);
  return 'done';
}

async function main() {
  console.log(`Fetching pending heroes${LIMIT !== Infinity ? ` (limit ${LIMIT})` : ''}…`);
  const rows = await fetchPending();
  console.log(
    `${rows.length} to process · concurrency ${CONCURRENCY}${DRY_RUN ? ' · DRY RUN' : ''}\n`,
  );

  let done = 0;
  let failed = 0;
  let i = 0;
  async function worker() {
    while (i < rows.length) {
      const h = rows[i++];
      const result = await processOne(h);
      if (result === 'done') done++;
      else failed++;
      const n = done + failed;
      if (n % 25 === 0 || n === rows.length) {
        console.log(`  ${n}/${rows.length} (${done} ok, ${failed} failed)`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));

  console.log(`\nComplete: ${done} done, ${failed} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
