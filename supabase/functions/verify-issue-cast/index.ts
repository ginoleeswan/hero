// verify-issue-cast — replace guessed issue casts with ComicVine's own credits,
// and strip the fabrications where it has none.
//
// sync-new-comics attributes characters from the SERIES roster (the /issues LIST
// endpoint carries no character_credits, and the per-issue DETAIL endpoint is
// rate-limited). Fine for a firehose of hundreds; wrong for the ~24 issues a week
// that actually get displayed, and outright fabrication for anthologies, whose
// roster is the union of every serial the magazine ever ran.
//
// Measured 2026-07-27 — Morning #2491, a Kodansha seinen magazine, had a cast of
// exactly "Joker, Batman", and max_fame 100 off those two invented links, which
// is what floated it over the >= 25 fame gate and into the Pulse ahead of
// Avengers: Doomsday.
//
// The detail endpoint IS affordable at display volume: ~24 issues/week at 1.5s
// spacing is under a minute. So for anything recent enough to surface, ask.
//
// Sampling 18 recent linked issues, 9 had real credits and 9 had none — and the
// empty half is NOT all junk (Action Comics #1100 is a real book whose credits
// ComicVine simply hasn't entered yet). So absence of credits can't mean "delete
// everything", or legitimate books get stripped for being new. Two paths:
//
//   credits present -> replace the cast outright. Ground truth wins.
//   credits absent  -> keep the roster guess but drop franchises incoherent with
//                      the publisher. That is precisely the anthology signature:
//                      a Japanese magazine carrying Batman.
//
// POST body: { limit?: number, days?: number, triggeredBy?: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type SB = ReturnType<typeof createClient>;

const CV_API_KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const CV = 'https://comicvine.gamespot.com/api';
const UA = { 'User-Agent': 'mythique/1.0 (https://mythique.app)' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── coherence guard, used ONLY when ComicVine has no credits ─────────────────
// Deliberately narrow. Publisher mismatch on its own is NOT evidence of junk —
// most mismatches in this data are legitimate, because heroes.publisher is a
// franchise label rather than the printing house: Image prints Transformers
// (Hasbro), IDW prints TMNT, Viz is Shueisha's US arm, Marvel prints Star Wars.
// Blanket publisher matching would have deleted all of those.
//
// What IS reliable is that a Japanese manga magazine does not carry Western
// superhero/Hollywood franchises. Every observed fabrication fits that shape:
// Morning -> DC, Weekly Young Jump -> DC, Weekly Shonen Magazine -> Marvel +
// RKO Pictures, Big Comic -> Star Wars + Indiana Jones, 2000 AD -> DC + Disney.
const MANGA_PUBLISHERS = new Set(
  [
    'shueisha',
    'kodansha',
    'shogakukan',
    'coamix',
    'kadokawa',
    'hakusensha',
    'akita shoten',
    'futabasha',
    'square enix',
  ].map((s) => s),
);
const WESTERN_FRANCHISES = new Set([
  'dc comics',
  'marvel',
  'image',
  'dark horse comics',
  'valiant',
  'star wars',
  'disney',
  'hanna-barbera',
  'looney tunes',
  'indiana jones',
  'rko pictures',
  'archie comics',
]);
// 2000 AD is a British weekly anthology with the same failure mode.
const ANTHOLOGY_PUBLISHERS = new Set(['rebellion']);

/** True when this hero cannot plausibly belong to this volume's publisher. */
function incoherent(issuePublisher: string | null, heroPublisher: string | null): boolean {
  if (!issuePublisher || !heroPublisher) return false;
  const p = issuePublisher.trim().toLowerCase();
  const h = heroPublisher.trim().toLowerCase();
  if (p === h) return false;
  const japanese = MANGA_PUBLISHERS.has(p);
  const anthology = ANTHOLOGY_PUBLISHERS.has(p);
  return (japanese || anthology) && WESTERN_FRANCHISES.has(h);
}

// The franchise filter alone isn't enough, and the first run showed why: it
// stripped Batman from Weekly Young Jump but left Godzilla, so the magazine still
// carried max_fame 98 and stayed in the rail. Toho isn't a "western" franchise,
// yet Godzilla is no more the cast of this week's Young Jump than Batman was.
//
// For a periodical ANTHOLOGY the volume roster is meaningless in whole, not in
// part — every serial the magazine ever ran, unioned. So when ComicVine has no
// per-issue credits for one, drop the entire guess rather than filtering it.
//
// Detected by name pattern or by issue number, which separates cleanly in this
// data: the anthologies run 1663-3963 (Big Comic, Morning, Young Jump, 2000 AD,
// Shonen Magazine/Sunday) while the longest-running single series here are
// Action Comics #1100 and Detective Comics #1111.
const ANTHOLOGY_NAME = /(weekly|monthly|magazine|megazine|\bjump\b|2000 ad|corocoro|big comic)/i;
const ANTHOLOGY_ISSUE_NO = 1500;

function isAnthology(volumeName: string | null, issueNumber: string | null): boolean {
  if (volumeName && ANTHOLOGY_NAME.test(volumeName)) return true;
  const n = Number.parseInt((issueNumber ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n >= ANTHOLOGY_ISSUE_NO;
}

interface IssueRow {
  id: string;
  volume_name: string | null;
  issue_number: string | null;
  publisher: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (!CV_API_KEY) return json({ skipped: 'COMICVINE_API_KEY not set' });

  let limit = 40;
  let days = 30;
  let triggeredBy = 'cron';
  try {
    const b = await req.json().catch(() => ({}));
    if (typeof b?.limit === 'number') limit = Math.min(Math.max(1, b.limit), 200);
    if (typeof b?.days === 'number') days = Math.min(Math.max(1, b.days), 365);
    if (typeof b?.triggeredBy === 'string') triggeredBy = b.triggeredBy;
  } catch {
    /* empty body ok */
  }

  const sb: SB = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('comic_issues')
    .select('id, volume_name, issue_number, publisher')
    .gte('store_date', since)
    .order('cast_verified_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) return json({ error: error.message }, 500);
  const issues = (data ?? []) as unknown as IssueRow[];

  let verified = 0;
  let filtered = 0;
  let emptied = 0;
  let rateLimited = 0;
  let linksAdded = 0;
  let linksRemoved = 0;
  const changed: string[] = [];

  for (const iss of issues) {
    const cvId = iss.id.replace(/^cvi:/, '');
    try {
      const res = await fetch(
        `${CV}/issue/4000-${cvId}/?api_key=${CV_API_KEY}&format=json` +
          `&field_list=id,issue_number,character_credits`,
        { headers: UA },
      );
      if (!res.ok) {
        await sleep(1500);
        continue;
      }
      const body = await res.json();
      // 107 is ComicVine's "slow down cowboy". Back off and leave the row
      // unstamped so the next run retries it first.
      if (body.status_code === 107) {
        rateLimited++;
        await sleep(6000);
        continue;
      }
      const credits = (body.results?.character_credits ?? []) as Array<{ id: number }>;

      if (credits.length > 0) {
        // ── ground truth ────────────────────────────────────────────────────
        const cvIds = credits.map((c) => String(c.id));
        const heroIds = new Set<string>();
        for (let i = 0; i < cvIds.length; i += 300) {
          const { data: hs } = await sb
            .from('heroes')
            .select('id, comicvine_id')
            .in('comicvine_id', cvIds.slice(i, i + 300));
          for (const h of (hs ?? []) as Array<{ id: string }>) heroIds.add(h.id);
        }
        const { data: before } = await sb
          .from('comic_issue_appearances')
          .select('hero_id')
          .eq('issue_id', iss.id);
        const had = new Set(((before ?? []) as Array<{ hero_id: string }>).map((r) => r.hero_id));

        // Replace wholesale: the roster guess has no authority next to this.
        await sb.from('comic_issue_appearances').delete().eq('issue_id', iss.id);
        if (heroIds.size > 0) {
          await sb
            .from('comic_issue_appearances')
            .upsert(
              [...heroIds].map((hid) => ({ issue_id: iss.id, hero_id: hid })),
              { onConflict: 'issue_id,hero_id', ignoreDuplicates: true },
            );
        }
        linksAdded += [...heroIds].filter((h) => !had.has(h)).length;
        linksRemoved += [...had].filter((h) => !heroIds.has(h)).length;
        await sb.rpc('recompute_issue_max_fame', { p_issue_id: iss.id });
        await sb
          .from('comic_issues')
          .update({
            cast_source: heroIds.size > 0 ? 'issue' : 'none',
            cast_verified_at: new Date().toISOString(),
          })
          .eq('id', iss.id);
        if (heroIds.size === 0) emptied++;
        else verified++;
        if (had.size !== heroIds.size) changed.push(`${iss.volume_name} #${iss.issue_number}`);
      } else {
        // ── no evidence: keep the guess, minus incoherent franchises ────────
        const { data: links } = await sb
          .from('comic_issue_appearances')
          .select('hero_id, heroes!inner(publisher)')
          .eq('issue_id', iss.id);
        const rows = (links ?? []) as unknown as Array<{
          hero_id: string;
          heroes: { publisher: string | null };
        }>;
        // An anthology's whole roster is noise; anything else, only the
        // franchises that can't belong.
        const anthology = isAnthology(iss.volume_name, iss.issue_number);
        const junk = anthology
          ? rows
          : rows.filter((r) => incoherent(iss.publisher, r.heroes?.publisher));
        if (junk.length > 0) {
          await sb
            .from('comic_issue_appearances')
            .delete()
            .eq('issue_id', iss.id)
            .in(
              'hero_id',
              junk.map((r) => r.hero_id),
            );
          linksRemoved += junk.length;
          filtered++;
          changed.push(`${iss.volume_name} #${iss.issue_number} (-${junk.length})`);
        }
        await sb.rpc('recompute_issue_max_fame', { p_issue_id: iss.id });
        const left = rows.length - junk.length;
        await sb
          .from('comic_issues')
          .update({
            cast_source: left === 0 ? 'none' : junk.length > 0 ? 'volume_filtered' : 'volume',
            cast_verified_at: new Date().toISOString(),
          })
          .eq('id', iss.id);
        if (left === 0 && rows.length > 0) emptied++;
      }
    } catch (err) {
      console.error('[verify-issue-cast] threw', iss.id, err);
    }
    // ComicVine throttles hard; this job is never urgent.
    await sleep(1500);
  }

  if (issues.length > 0) {
    await sb
      .from('api_usage')
      .insert({ api: 'comicvine', endpoint: 'issue-cast', units: issues.length });
  }
  return json({
    checked: issues.length,
    verified,
    filtered,
    emptied,
    rateLimited,
    linksAdded,
    linksRemoved,
    changed: changed.slice(0, 20),
    triggeredBy,
  });
});
