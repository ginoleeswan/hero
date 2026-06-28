// supabase/functions/sync-new-comics/index.ts
//
// Weekly-comics ingest, VOLUME-ROSTER strategy. ComicVine's /issues LIST endpoint
// carries no character_credits, and the per-issue DETAIL endpoint is harshly
// rate-limited ("status 107 — slow down cowboy"). So we attribute an issue's
// characters from its SERIES (volume) roster, resolved ONCE per volume and cached
// in comic_volumes. Three phases per run:
//   1. list   — issues with a store_date in the window (cheap, paged).
//   2. resolve— for up to maxVolumes NEW volumes, fetch the roster, intersect with
//               the catalogue + fame, cache it. Stops on the first 107 (back off).
//   3. store  — upsert issues whose volume is cached+resolved, copying the volume's
//               top catalogue characters into comic_issue_appearances.
// Steady state (all volumes known) does zero detail calls. Idempotent; safe to run
// frequently — a no-op once the window's volumes are all cached.
//
// POST body: { days?: number (1-31, default 14), maxVolumes?: number (1-20, default 6),
//              triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const CV = 'https://comicvine.gamespot.com/api';
const KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const UA = { 'User-Agent': 'mythique/1.0 (weekly comics sync)' };
const ISSUE_FIELDS = 'id,issue_number,store_date,cover_date,image,volume';
const VOLUME_FIELDS = 'id,name,publisher,characters';
const MAX_PAGES = 4; // 400 issues/window cap (a week is ~150)
const TOP_CHARS = 8; // catalogue characters cached + attributed per volume

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const coverUrl = (image: Record<string, string> | null | undefined): string | null =>
  image?.original_url ?? image?.super_url ?? image?.medium_url ?? null;

class RateLimited extends Error {}

// One ComicVine GET. Throws RateLimited on status_code 107 so callers can back off.
async function cvGet(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const body = await res.json();
  if (body?.status_code === 107) throw new RateLimited('comicvine rate limit');
  return body;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface WindowIssue {
  id: number;
  issue_number: string | null;
  store_date: string;
  cover_date: string | null;
  cover_url: string | null;
  volume_id: number;
  volume_name: string | null;
}

// Phase 1 — every issue with a store_date in [start, end], paged until exhausted.
async function listWindowIssues(start: string, end: string): Promise<WindowIssue[]> {
  const out: WindowIssue[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * 100;
    const url =
      `${CV}/issues/?api_key=${KEY}&format=json&sort=store_date:desc&limit=100&offset=${offset}` +
      `&field_list=${ISSUE_FIELDS}&filter=store_date:${start}|${end}`;
    let body: any;
    try {
      body = await cvGet(url);
    } catch (_e) {
      break; // transient/rate-limit on the list — take what we have
    }
    const results = (body.results ?? []) as any[];
    for (const r of results) {
      if (!r.store_date || !r.volume?.id) continue;
      out.push({
        id: r.id,
        issue_number: r.issue_number ?? null,
        store_date: r.store_date,
        cover_date: r.cover_date ?? null,
        cover_url: coverUrl(r.image),
        volume_id: r.volume.id,
        volume_name: r.volume?.name ?? null,
      });
    }
    const total = typeof body.number_of_total_results === 'number' ? body.number_of_total_results : 0;
    if (offset + results.length >= total || results.length === 0) break;
    await sleep(250);
  }
  return out;
}

interface CatalogueHero {
  id: string;
  name: string;
  fame: number;
}

// catalogue heroes for a set of ComicVine character ids (chunked .in lookups).
async function catalogueFor(sb: SB, cvCharIds: string[]): Promise<Map<string, CatalogueHero>> {
  const map = new Map<string, CatalogueHero>();
  for (const ids of chunk(cvCharIds, 300)) {
    const { data } = await sb
      .from('heroes')
      .select('id, name, comicvine_id, fame_score')
      .in('comicvine_id', ids);
    for (const h of (data ?? []) as Array<{ id: string; name: string; comicvine_id: string; fame_score: number | null }>) {
      if (h.comicvine_id) map.set(h.comicvine_id, { id: h.id, name: h.name, fame: h.fame_score ?? 0 });
    }
  }
  return map;
}

// Normalize a series/character name for title matching: lowercase, strip
// punctuation, drop common imprint/branding words, collapse whitespace.
const NAME_NOISE = /\b(absolute|ultimate|amazing|spectacular|all new|all star|the|vol|volume)\b/g;
const normName = (s: string) =>
  ` ${s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(NAME_NOISE, ' ').replace(/\s+/g, ' ').trim()} `;

// Phase 2 — resolve up to `cap` NEW volumes' rosters into comic_volumes. Returns
// counts; stops early on a rate-limit.
async function resolveVolumes(
  sb: SB,
  volumeIds: number[],
  cap: number,
): Promise<{ resolved: number; pending: number; rateLimited: boolean }> {
  // Which of these volumes do we already know?
  const known = new Set<number>();
  for (const ids of chunk(volumeIds, 500)) {
    const { data } = await sb.from('comic_volumes').select('volume_id').in('volume_id', ids);
    for (const v of (data ?? []) as Array<{ volume_id: number }>) known.add(v.volume_id);
  }
  const unknown = volumeIds.filter((v) => !known.has(v));
  let resolved = 0;
  let rateLimited = false;
  for (const vid of unknown.slice(0, cap)) {
    let body: any;
    try {
      body = await cvGet(`${CV}/volume/4050-${vid}/?api_key=${KEY}&format=json&field_list=${VOLUME_FIELDS}`);
    } catch (e) {
      if (e instanceof RateLimited) {
        rateLimited = true;
        break; // back off — leave the rest for the next run
      }
      continue; // transient; try again next run
    }
    const r = body.results ?? {};
    const roster = (r.characters ?? []) as Array<{ id: number; count?: number }>;
    const catalogue = await catalogueFor(sb, roster.map((c) => String(c.id)));
    // The roster lists every character that ever appeared in the series, with an
    // appearance `count` and our fame_score per catalogue hero. max_fame (highest
    // fame in the roster) feeds the permissive display gate only.
    const countById = new Map<string, number>();
    for (const c of roster) countById.set(String(c.id), typeof c.count === 'number' ? c.count : 0);
    const all = [...catalogue.entries()].map(([cvId, h]) => ({
      heroId: h.id,
      name: h.name,
      fame: h.fame,
      count: countById.get(cvId) ?? 0,
    }));
    const maxFame = all.reduce((m, x) => Math.max(m, x.fame), 0);
    // The roster's `count` is often a flat 1, so centrality alone can't pick the
    // lead — a famous guest (Batman in a Superman book) would win on fame. The
    // reliable signal is the SERIES NAME: an ongoing title is named for its star.
    // Find the catalogue hero whose name the volume name contains (longest wins);
    // that's the lead. Team books (no name match) fall back to centrality/fame.
    const volNorm = normName(r.name ?? '');
    let titleLead: (typeof all)[number] | null = null;
    for (const e of all) {
      const hn = normName(e.name);
      if (hn.length > 4 && volNorm.includes(hn)) {
        if (!titleLead || hn.length > normName(titleLead.name).length) titleLead = e;
      }
    }
    const byCentrality = all.slice().sort((a, b) => b.count - a.count || b.fame - a.fame);
    const ordered = titleLead
      ? [titleLead, ...byCentrality.filter((e) => e.heroId !== titleLead!.heroId)]
      : byCentrality;
    const ranked = ordered.slice(0, TOP_CHARS);

    await sb.from('comic_volumes').insert({
      volume_id: vid,
      name: r.name ?? null,
      publisher: r.publisher?.name ?? null,
      character_ids: ranked.map((x) => x.heroId),
      lead_hero_id: ranked[0]?.heroId ?? null,
      max_fame: ranked.length > 0 ? maxFame : null,
      status: ranked.length > 0 ? 'resolved' : 'no_catalogue',
      resolved_at: new Date().toISOString(),
    });
    resolved++;
    await sleep(1500); // gentle on the throttle
  }
  return { resolved, pending: Math.max(0, unknown.length - cap), rateLimited };
}

interface ResolvedVolume {
  publisher: string | null;
  character_ids: string[];
  lead_hero_id: string | null;
  max_fame: number | null;
}

// Phase 3 — upsert issues whose volume is cached + resolved.
async function storeIssues(sb: SB, issues: WindowIssue[]): Promise<number> {
  const volIds = [...new Set(issues.map((i) => i.volume_id))];
  const vol = new Map<number, ResolvedVolume>();
  for (const ids of chunk(volIds, 500)) {
    const { data } = await sb
      .from('comic_volumes')
      .select('volume_id, publisher, character_ids, lead_hero_id, max_fame, status')
      .in('volume_id', ids)
      .eq('status', 'resolved');
    for (const v of (data ?? []) as Array<ResolvedVolume & { volume_id: number; status: string }>) {
      vol.set(v.volume_id, v);
    }
  }
  let stored = 0;
  for (const i of issues) {
    const v = vol.get(i.volume_id);
    if (!v || v.character_ids.length === 0) continue;
    const issueId = `cvi:${i.id}`;
    const { error: upErr } = await sb.from('comic_issues').upsert(
      {
        id: issueId,
        comicvine_id: String(i.id),
        volume_name: i.volume_name,
        volume_id: i.volume_id,
        issue_number: i.issue_number,
        cover_url: i.cover_url,
        store_date: i.store_date,
        cover_date: i.cover_date,
        publisher: v.publisher,
        lead_hero_id: v.lead_hero_id,
        max_fame: v.max_fame,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (upErr) {
      console.error('[sync-new-comics] issue upsert failed', issueId, upErr.message);
      continue;
    }
    await sb
      .from('comic_issue_appearances')
      .upsert(
        v.character_ids.map((hid) => ({ issue_id: issueId, hero_id: hid })),
        { onConflict: 'issue_id,hero_id', ignoreDuplicates: true },
      );
    stored++;
  }
  return stored;
}

// ComicVine descriptions are HTML — strip tags + decode the few entities that
// show up, collapse whitespace, cap length.
function cleanHtml(html: unknown): string | null {
  if (typeof html !== 'string' || !html) return null;
  let t = html.replace(/<[^>]+>/g, ' ');
  t = t
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 1200) t = `${t.slice(0, 1197).trimEnd()}…`;
  return t || null;
}

// Phase 4 — backfill issue synopses. The per-issue DETAIL endpoint is the only
// source of `description` and is rate-limited, so do a few per run (famous issues
// first) and stop on the first 107. Issues with no synopsis are marked '' so they
// aren't retried forever.
async function enrichDescriptions(sb: SB, cap: number): Promise<{ enriched: number; rateLimited: boolean }> {
  const { data } = await sb
    .from('comic_issues')
    .select('id, comicvine_id')
    .is('description', null)
    .order('max_fame', { ascending: false, nullsFirst: false })
    .limit(cap);
  const rows = (data ?? []) as Array<{ id: string; comicvine_id: string }>;
  let enriched = 0;
  let rateLimited = false;
  for (const r of rows) {
    let body: any;
    try {
      body = await cvGet(`${CV}/issue/4000-${r.comicvine_id}/?api_key=${KEY}&format=json&field_list=id,description`);
    } catch (e) {
      if (e instanceof RateLimited) {
        rateLimited = true;
        break;
      }
      continue;
    }
    const desc = cleanHtml((body.results ?? {}).description);
    await sb.from('comic_issues').update({ description: desc ?? '' }).eq('id', r.id);
    if (desc) enriched++;
    await sleep(1500);
  }
  return { enriched, rateLimited };
}

async function runSync(
  sb: SB,
  days: number,
  maxVolumes: number,
  maxEnrich: number,
): Promise<{
  fetched: number;
  resolved: number;
  pending: number;
  stored: number;
  enriched: number;
  rateLimited: boolean;
}> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const issues = await listWindowIssues(isoDate(start), isoDate(end));
  if (issues.length === 0) {
    return { fetched: 0, resolved: 0, pending: 0, stored: 0, enriched: 0, rateLimited: false };
  }

  const volumeIds = [...new Set(issues.map((i) => i.volume_id))];
  const vol = await resolveVolumes(sb, volumeIds, maxVolumes);
  const stored = await storeIssues(sb, issues);
  // Only spend the rate-limited detail calls on synopses if volume resolution
  // didn't already hit the throttle this run.
  const enr = vol.rateLimited ? { enriched: 0, rateLimited: true } : await enrichDescriptions(sb, maxEnrich);
  return {
    fetched: issues.length,
    resolved: vol.resolved,
    pending: vol.pending,
    stored,
    enriched: enr.enriched,
    rateLimited: vol.rateLimited || enr.rateLimited,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  let days = 14;
  let maxVolumes = 6;
  let maxEnrich = 8;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.days === 'number') days = Math.min(Math.max(1, b.days), 31);
    if (typeof b?.maxVolumes === 'number') maxVolumes = Math.min(Math.max(1, b.maxVolumes), 20);
    if (typeof b?.maxEnrich === 'number') maxEnrich = Math.min(Math.max(0, b.maxEnrich), 25);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const out = await runSync(sb, days, maxVolumes, maxEnrich);
    const units = out.resolved + out.enriched;
    if (units > 0) await sb.from('api_usage').insert({ api: 'comicvine', endpoint: 'sync-new-comics', units });
    return json({ ...out, triggeredBy, message: out.stored === 0 ? 'nothing stored yet' : 'ok' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
