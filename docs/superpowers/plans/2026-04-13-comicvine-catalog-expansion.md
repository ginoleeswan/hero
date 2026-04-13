# ComicVine Catalog Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the hero catalog from 731 to ~5,000 characters using ComicVine as primary source, with Gemini 2.5 Flash-Lite generating powerstats for characters not in SuperheroAPI.

**Architecture:** DB migration adds `comicvine_id`, `stats_source`, `ai_stats_status` columns and a `cv_ingestion_state` singleton table. Two new edge functions handle ingestion and AI stat generation. Biography page intercepts ComicVine character links and navigates internally when the character exists in the DB.

**Tech Stack:** Supabase Edge Functions (Deno), Google AI SDK (`@google/genai`), Expo Router, React Native Web, TypeScript.

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260413120000_comicvine_expansion.sql`

- [ ] Create migration file:

```sql
-- comicvine_id: stable CV character ID (numeric portion of 4005-XXXX)
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS comicvine_id text UNIQUE;

-- stats_source: who provided the numeric stats
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS stats_source text
  CHECK (stats_source IN ('superheroapi', 'ai'));

-- ai_stats_status: generation queue state
ALTER TABLE heroes ADD COLUMN IF NOT EXISTS ai_stats_status text
  CHECK (ai_stats_status IN ('pending', 'done', 'failed'));

-- Ingestion progress tracker (singleton row)
CREATE TABLE IF NOT EXISTS cv_ingestion_state (
  id             integer PRIMARY KEY DEFAULT 1,
  last_offset    integer NOT NULL DEFAULT 0,
  total_ingested integer NOT NULL DEFAULT 0,
  target         integer NOT NULL DEFAULT 5000,
  status         text    NOT NULL DEFAULT 'idle'
                   CHECK (status IN ('idle', 'running', 'complete', 'error')),
  last_run_at    timestamptz,
  error          text
);
INSERT INTO cv_ingestion_state DEFAULT VALUES
  ON CONFLICT (id) DO NOTHING;

-- Backfill: existing heroes with powerstats came from SuperheroAPI
UPDATE heroes
SET stats_source = 'superheroapi'
WHERE intelligence IS NOT NULL
  AND strength IS NOT NULL
  AND stats_source IS NULL;
```

- [ ] Apply via Supabase MCP: `mcp__supabase__apply_migration`
- [ ] Regenerate TypeScript types: `mcp__supabase__generate_typescript_types`
- [ ] Write updated types to `src/types/database.generated.ts`
- [ ] Commit: `git commit -m "feat(db): add comicvine_id, stats_source, ai_stats_status columns"`

---

### Task 2: Update `get-comicvine-hero` to write `comicvine_id`

**Files:**
- Modify: `supabase/functions/get-comicvine-hero/index.ts`

- [ ] In the DB update at the end of the function, add `comicvine_id: String(result.id)` to the `.update({...})` call. `result.id` is the ComicVine character numeric ID already fetched from the list endpoint.
- [ ] Commit: `git commit -m "feat(cv): store comicvine_id on enrichment"`

---

### Task 3: `seed-comicvine-characters` Edge Function

**Files:**
- Create: `supabase/functions/seed-comicvine-characters/index.ts`

- [ ] Create the function:

```ts
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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Read ingestion state
  const { data: state, error: stateErr } = await sb
    .from('cv_ingestion_state')
    .select('*')
    .eq('id', 1)
    .single();
  if (stateErr || !state) return json({ error: 'Failed to read ingestion state' }, 500);

  if (state.status === 'complete') return json({ message: 'Already complete', state });
  if (state.total_ingested >= state.target) {
    await sb.from('cv_ingestion_state').update({ status: 'complete' }).eq('id', 1);
    return json({ message: 'Target reached', state });
  }

  // Fetch batch from ComicVine
  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    sort: 'count_of_issue_appearances:desc',
    offset: String(state.last_offset),
    limit: '100',
    field_list: 'id,name,deck,publisher,image,count_of_issue_appearances',
  });
  const cvRes = await fetch(`${COMICVINE_BASE}/characters/?${params}`);
  if (!cvRes.ok) return json({ error: `ComicVine error: ${cvRes.status}` }, 502);

  const cvJson = await cvRes.json();
  const characters: Array<{
    id: number;
    name: string;
    deck: string | null;
    publisher: { name: string } | null;
    image: { medium_url: string } | null;
    count_of_issue_appearances: number;
  }> = cvJson.results ?? [];

  // Load existing comicvine_ids and names for dedup
  const { data: existing } = await sb
    .from('heroes')
    .select('id, name, comicvine_id');
  const existingCvIds = new Set((existing ?? []).map((h) => String(h.comicvine_id)).filter(Boolean));
  const existingByNorm = new Map((existing ?? []).map((h) => [norm(h.name), h.id]));

  let inserted = 0;
  let merged = 0;

  for (const char of characters) {
    const cvId = String(char.id);

    // Skip if already seeded by CV ID
    if (existingCvIds.has(cvId)) continue;

    const normalised = norm(char.name);
    const existingId = existingByNorm.get(normalised);

    if (existingId) {
      // Merge: write comicvine_id to existing hero
      await sb.from('heroes').update({ comicvine_id: cvId }).eq('id', existingId);
      merged++;
    } else {
      // Insert new character
      await sb.from('heroes').insert({
        id: `cv-${cvId}`,
        name: char.name,
        comicvine_id: cvId,
        summary: char.deck ?? null,
        image_url: char.image?.medium_url ?? null,
        publisher: char.publisher?.name ?? null,
        issue_count: char.count_of_issue_appearances ?? null,
        ai_stats_status: 'pending',
        enriched_at: new Date().toISOString(),
      });
      inserted++;
    }
  }

  const newTotal = state.total_ingested + inserted;
  const newOffset = state.last_offset + 100;
  const newStatus = newTotal >= state.target ? 'complete' : 'idle';

  await sb.from('cv_ingestion_state').update({
    last_offset: newOffset,
    total_ingested: newTotal,
    status: newStatus,
    last_run_at: new Date().toISOString(),
    error: null,
  }).eq('id', 1);

  return json({ inserted, merged, total_ingested: newTotal, status: newStatus });
});
```

- [ ] Deploy: `mcp__supabase__deploy_edge_function`
- [ ] Commit: `git commit -m "feat(cv): seed-comicvine-characters edge function"`

---

### Task 4: `generate-hero-stats` Edge Function

**Files:**
- Create: `supabase/functions/generate-hero-stats/index.ts`

- [ ] Create the function:

```ts
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const { heroId } = (await req.json()) as { heroId: string };
  if (!heroId) return json({ error: 'heroId required' }, 400);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: hero } = await sb
    .from('heroes')
    .select('id, name, powers, summary, origin, description, ai_stats_status, stats_source')
    .eq('id', heroId)
    .single();

  if (!hero) return json({ error: 'Hero not found' }, 404);
  if (hero.stats_source != null) return json({ message: 'Stats already exist', stats_source: hero.stats_source });
  if (hero.ai_stats_status === 'done') return json({ message: 'Already done' });

  const powers = Array.isArray(hero.powers) ? hero.powers.join(', ') : '';
  const description = hero.description ? stripHtml(hero.description) : '';

  const prompt = `You are a comic book analyst. Based only on the character data below, estimate their combat stats on a scale of 0–100.

Character: ${hero.name}
Origin: ${hero.origin ?? 'Unknown'}
Powers: ${powers || 'Unknown'}
Summary: ${hero.summary ?? 'Unknown'}
Description: ${description || 'No description available'}

Reference anchors:
- Average human: strength 10, speed 10, durability 20, intelligence 50, power 5, combat 30
- Peak human (Batman, Captain America): strength 30, speed 35, durability 40, combat 85
- Street-level superhuman (Spider-Man): strength 55, speed 60, durability 50
- Cosmic-level (Superman, Thor): strength 100, speed 95, durability 100, power 95
- Intelligence 100 = Reed Richards, Lex Luthor level

Return ONLY valid JSON with these exact keys, no explanation:
{"intelligence":0,"strength":0,"speed":0,"durability":0,"power":0,"combat":0}`;

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const raw = response.text ?? '';
    const stats = JSON.parse(raw) as Record<string, unknown>;

    const keys = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'];
    const valid = keys.every((k) => typeof stats[k] === 'number' && stats[k] >= 0 && stats[k] <= 100);
    if (!valid) throw new Error('Invalid stats shape');

    await sb.from('heroes').update({
      intelligence: stats.intelligence as number,
      strength: stats.strength as number,
      speed: stats.speed as number,
      durability: stats.durability as number,
      power: stats.power as number,
      combat: stats.combat as number,
      stats_source: 'ai',
      ai_stats_status: 'done',
    }).eq('id', heroId);

    return json({ stats, stats_source: 'ai' });
  } catch (err) {
    console.error('[generate-hero-stats]', err);
    await sb.from('heroes').update({ ai_stats_status: 'failed' }).eq('id', heroId);
    return json({ error: 'Generation failed' }, 500);
  }
});
```

- [ ] Add `GEMINI_API_KEY` to Supabase project secrets
- [ ] Deploy: `mcp__supabase__deploy_edge_function`
- [ ] Commit: `git commit -m "feat(ai): generate-hero-stats edge function using Gemini 2.5 Flash-Lite"`

---

### Task 5: DB Helper + Biography Link Interception

**Files:**
- Modify: `src/lib/db/heroes.ts`
- Modify: `app/biography/[id].web.tsx`

- [ ] Add to `src/lib/db/heroes.ts`:

```ts
export async function getHeroByComicvineId(cvId: string): Promise<Pick<Hero, 'id' | 'name'> | null> {
  const { data } = await supabase
    .from('heroes')
    .select('id, name')
    .eq('comicvine_id', cvId)
    .single();
  return data ?? null;
}
```

- [ ] In `app/biography/[id].web.tsx`, import `getHeroByComicvineId` and add a `useRef` + `useEffect` for link interception:

```ts
import { useEffect, useRef, useState } from 'react';
import { getHeroByComicvineId } from '../../src/lib/db/heroes';
```

Add ref to content div and click handler:

```tsx
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = contentRef.current;
  if (!el) return;
  const handleClick = (e: MouseEvent) => {
    const anchor = (e.target as Element).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    const charMatch = href.match(/\/[^/]+\/4005-(\d+)\//);
    if (charMatch) {
      e.preventDefault();
      getHeroByComicvineId(charMatch[1]).then((hero) => {
        if (hero) {
          router.push(`/character/${hero.id}`);
        } else {
          window.open(`https://comicvine.gamespot.com${href}`, '_blank');
        }
      });
      return;
    }
    // All other CV relative links — open externally
    if (href.startsWith('/') && href.match(/\/\d{4}-\d+\//)) {
      e.preventDefault();
      window.open(`https://comicvine.gamespot.com${href}`, '_blank');
    }
  };
  el.addEventListener('click', handleClick);
  return () => el.removeEventListener('click', handleClick);
}, [processedHtml, router]);
```

Attach ref to the content div:

```tsx
<div ref={contentRef} dangerouslySetInnerHTML={{ __html: processedHtml }} />
```

- [ ] `yarn tsc --noEmit --skipLibCheck` — no new errors
- [ ] Commit: `git commit -m "feat(biography): intercept CV character links for in-app navigation"`

---

### Task 6: UI — AI Stats Badge + Loading State + Compare Guard

**Files:**
- Modify: `app/character/[id].web.tsx`

- [ ] In the character web screen, after `data` loads, check `data.stats_source` (needs to come from the hero row via `heroRowToCharacterData`). Update `heroRowToCharacterData` in `src/lib/db/heroes.ts` to include `stats_source` in the returned `CharacterData`.

Add to `src/types/index.ts` — `CharacterData.statsSource`:

```ts
export interface CharacterData {
  stats: HeroStats;
  details: HeroDetails;
  firstIssue: FirstIssue | null;
  statsSource?: 'superheroapi' | 'ai' | null;
}
```

Update `heroRowToCharacterData`:

```ts
// at the end of the returned object
statsSource: (hero.stats_source as 'superheroapi' | 'ai' | null) ?? null,
```

- [ ] In the Power Stats card header in `app/character/[id].web.tsx`, render the badge when `data.statsSource === 'ai'`:

```tsx
{data.statsSource === 'ai' ? (
  <View style={styles.aiBadge}>
    <Text style={styles.aiBadgeText}>AI</Text>
  </View>
) : null}
```

Add to StyleSheet:

```ts
aiBadge: {
  backgroundColor: 'rgba(41,60,67,0.08)',
  borderRadius: 4,
  paddingHorizontal: 6,
  paddingVertical: 2,
  marginLeft: 8,
},
aiBadgeText: {
  fontFamily: 'FlameSans-Regular',
  fontSize: 10,
  color: COLORS.grey,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
},
```

- [ ] For null stats + `ai_stats_status = 'pending'`: fire `generate-hero-stats` from the character page, show skeleton. In `WebCharacterScreen`, after hero loads with no stats:

```ts
useEffect(() => {
  if (!data) return;
  const hero = data as typeof data & { statsSource?: string | null; aiStatsStatus?: string | null };
  if (hero.statsSource == null && (hero as unknown as Record<string,unknown>).aiStatsStatus === 'pending') {
    supabase.functions.invoke('generate-hero-stats', { body: { heroId: id } })
      .then(({ data: statsData }) => {
        if (statsData?.stats) {
          setData((prev) => prev ? { ...prev, stats: { ...prev.stats, powerstats: statsData.stats }, statsSource: 'ai' } : prev);
        }
      })
      .catch(() => {});
  }
}, [data, id]);
```

- [ ] `yarn tsc --noEmit --skipLibCheck` — no new errors
- [ ] Commit: `git commit -m "feat(ui): AI stats badge and lazy generation trigger on character page"`
