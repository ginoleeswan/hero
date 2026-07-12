// Nightly auto-pull of public post stats into social_post_results.
// Stage 1: Reddit — every post has public JSON (score + comments), no auth.
// Future stages write the same rows: IG Graph (dev-mode) and TikTok Display
// API once those accounts/apps are connected.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type SeedRow = { post_id: string; post_url: string };

// Normalize a reddit share link to its canonical comments URL, .json-ready.
function redditJsonUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!/(^|\.)reddit\.com$/.test(u.hostname)) return null;
    const path = u.pathname.replace(/\/+$/, '');
    return `https://www.reddit.com${path}.json`;
  } catch {
    return null;
  }
}

Deno.serve(async () => {
  // Seed set: the latest manual row per (post, reddit) that carries a URL.
  const { data, error } = await supabase
    .from('social_post_results')
    .select('post_id, post_url, platform, recorded_at')
    .eq('platform', 'reddit')
    .not('post_url', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(200);
  if (error) return new Response(error.message, { status: 500 });

  const seeds = new Map<string, SeedRow>();
  for (const r of data ?? []) {
    if (!seeds.has(r.post_id)) seeds.set(r.post_id, { post_id: r.post_id, post_url: r.post_url! });
  }

  let pulled = 0;
  const failures: string[] = [];
  for (const seed of [...seeds.values()].slice(0, 30)) {
    const jsonUrl = redditJsonUrl(seed.post_url);
    if (!jsonUrl) continue;
    try {
      const res = await fetch(jsonUrl, {
        headers: { 'User-Agent': 'mythique-stats-bot/1.0 (by u/ginoleeswan)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const post = json?.[0]?.data?.children?.[0]?.data;
      if (!post) throw new Error('unexpected shape');
      const { error: insErr } = await supabase.from('social_post_results').insert({
        post_id: seed.post_id,
        platform: 'reddit',
        likes: post.score ?? null,
        comments: post.num_comments ?? null,
        views: null, // reddit does not expose views publicly
        post_url: seed.post_url,
        source: 'auto',
        note: post.upvote_ratio ? `upvote ratio ${post.upvote_ratio}` : null,
      });
      if (insErr) throw new Error(insErr.message);
      pulled++;
    } catch (e) {
      failures.push(`${seed.post_url}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 1100)); // stay polite with reddit
  }

  return new Response(JSON.stringify({ pulled, failures }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
