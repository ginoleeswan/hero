// Nightly auto-pull of public post stats into social_post_results.
// Stage 1: Reddit — every post has public JSON (score + comments), no auth.
// Stage 2: Instagram — Graph API media insights, token stored (and refreshed
// in place) in platform_credentials rather than a static secret.
// Future: TikTok Display API once that app is approved.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type SeedRow = { post_id: string; post_url: string };

function seedsFor(rows: { post_id: string; post_url: string | null }[]) {
  const seeds = new Map<string, SeedRow>();
  for (const r of rows) {
    if (r.post_url && !seeds.has(r.post_id)) seeds.set(r.post_id, { post_id: r.post_id, post_url: r.post_url });
  }
  return [...seeds.values()].slice(0, 30);
}

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

async function pullReddit(): Promise<{ pulled: number; failures: string[] }> {
  const { data, error } = await supabase
    .from('social_post_results')
    .select('post_id, post_url')
    .eq('platform', 'reddit')
    .not('post_url', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(200);
  if (error) return { pulled: 0, failures: [error.message] };

  let pulled = 0;
  const failures: string[] = [];
  for (const seed of seedsFor(data ?? [])) {
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
      failures.push(`reddit ${seed.post_url}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 1100)); // stay polite with reddit
  }
  return { pulled, failures };
}

// Extract the Instagram media shortcode from a permalink
// (instagram.com/p/SHORTCODE/ or /reel/SHORTCODE/).
function igShortcode(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
    const m = /\/(p|reel)\/([^/]+)/.exec(u.pathname);
    return m?.[2] ?? null;
  } catch {
    return null;
  }
}

async function refreshIgTokenIfNeeded(cred: {
  access_token: string;
  expires_at: string | null;
}): Promise<string> {
  const expiresAt = cred.expires_at ? new Date(cred.expires_at).getTime() : 0;
  const daysLeft = (expiresAt - Date.now()) / 86400000;
  if (daysLeft > 7) return cred.access_token; // plenty of runway, skip
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${cred.access_token}`,
  );
  if (!res.ok) return cred.access_token; // keep using the current one; next run retries
  const json = await res.json();
  const newToken = json.access_token as string | undefined;
  if (!newToken) return cred.access_token;
  await supabase
    .from('platform_credentials')
    .update({
      access_token: newToken,
      expires_at: new Date(Date.now() + (json.expires_in ?? 5184000) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('platform', 'instagram');
  return newToken;
}

async function pullInstagram(): Promise<{ pulled: number; failures: string[] }> {
  const { data: cred } = await supabase
    .from('platform_credentials')
    .select('access_token, external_id, expires_at')
    .eq('platform', 'instagram')
    .maybeSingle();
  if (!cred) return { pulled: 0, failures: [] }; // not connected yet — silent no-op

  const token = await refreshIgTokenIfNeeded(cred);
  const { data, error } = await supabase
    .from('social_post_results')
    .select('post_id, post_url')
    .eq('platform', 'instagram')
    .not('post_url', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(200);
  if (error) return { pulled: 0, failures: [error.message] };

  let pulled = 0;
  const failures: string[] = [];
  for (const seed of seedsFor(data ?? [])) {
    const shortcode = igShortcode(seed.post_url);
    if (!shortcode) continue;
    try {
      // Resolve the shortcode to a media id via the account's recent media
      // (Instagram's Graph API has no direct shortcode→id lookup).
      const listRes = await fetch(
        `https://graph.instagram.com/v21.0/${cred.external_id}/media?fields=id,permalink&limit=50&access_token=${token}`,
      );
      if (!listRes.ok) throw new Error(`media list HTTP ${listRes.status}`);
      const list = await listRes.json();
      const media = (list.data ?? []).find((m: { permalink?: string }) =>
        m.permalink?.includes(shortcode),
      );
      if (!media) throw new Error('media not found in recent 50 — may have scrolled off');

      const insightsRes = await fetch(
        `https://graph.instagram.com/v21.0/${media.id}/insights?metric=reach,likes,comments,saved,shares&access_token=${token}`,
      );
      if (!insightsRes.ok) throw new Error(`insights HTTP ${insightsRes.status}`);
      const insights = await insightsRes.json();
      const val = (name: string) =>
        insights.data?.find((d: { name: string }) => d.name === name)?.values?.[0]?.value ?? null;

      const { error: insErr } = await supabase.from('social_post_results').insert({
        post_id: seed.post_id,
        platform: 'instagram',
        views: val('reach'),
        likes: val('likes'),
        comments: val('comments'),
        post_url: seed.post_url,
        source: 'auto',
        note: val('saved') != null ? `${val('saved')} saves, ${val('shares') ?? 0} shares` : null,
      });
      if (insErr) throw new Error(insErr.message);
      pulled++;
    } catch (e) {
      failures.push(`instagram ${seed.post_url}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { pulled, failures };
}

Deno.serve(async () => {
  const [reddit, instagram] = await Promise.all([pullReddit(), pullInstagram()]);
  return new Response(
    JSON.stringify({
      pulled: reddit.pulled + instagram.pulled,
      reddit,
      instagram,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
