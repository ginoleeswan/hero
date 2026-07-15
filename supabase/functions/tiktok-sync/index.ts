// On-demand TikTok sync: lists your recent videos + their public metrics via
// the TikTok Display API and auto-matches each to a queue post BY CAPTION (the
// same caption-key match ig-sync uses), then writes social_post_results rows
// with platform='tiktok'. Pressing "Pull TikTok content" in the Insights tab
// is enough — no manual linking.
//
// PREREQUISITE (one-time, on the TikTok developer portal — cannot be done from
// here): an APPROVED TikTok app with Login Kit + the `video.list` and
// `user.info.basic` scopes, then a completed OAuth so a row exists in
// platform_credentials with platform='tiktok' (access_token, refresh_token,
// external_id = open_id). Set TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET as
// function secrets for the token refresh below. Until then this returns
// { error: 'TikTok not connected' } — same graceful shape as ig-sync.
//
// SCOPE: read-only analytics. TikTok has NO official reply-to-comments write
// API for third-party apps — comment reply is a separate, triage-only feature.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

// Same caption normalisation ig-sync uses: lowercase, letters+digits only,
// first 40 chars — robust to emoji, punctuation, trailing hashtags.
const capKey = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);

// TikTok access tokens live ~24h; refresh in place (refresh token lasts ~1yr)
// and persist the new pair so subsequent syncs keep working unattended.
async function freshToken(cred: {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}): Promise<string> {
  const notExpired = cred.expires_at && new Date(cred.expires_at).getTime() > Date.now() + 60_000;
  if (notExpired || !cred.refresh_token) return cred.access_token;

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: Deno.env.get('TIKTOK_CLIENT_KEY') ?? '',
      client_secret: Deno.env.get('TIKTOK_CLIENT_SECRET') ?? '',
      grant_type: 'refresh_token',
      refresh_token: cred.refresh_token,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) return cred.access_token; // fall back; the list call will surface the auth error
  await supabase
    .from('platform_credentials')
    .update({
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? cred.refresh_token,
      expires_at: new Date(Date.now() + (body.expires_in ?? 86_400) * 1000).toISOString(),
    })
    .eq('platform', 'tiktok');
  return body.access_token;
}

interface TikTokVideo {
  id: string;
  title?: string;
  video_description?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const { data: cred } = await supabase
      .from('platform_credentials')
      .select('access_token, refresh_token, expires_at, external_id')
      .eq('platform', 'tiktok')
      .maybeSingle();
    if (!cred) return json({ error: 'TikTok not connected' }, 400);

    const token = await freshToken(cred);

    // Queue posts keyed by caption prefix (only those with a caption).
    const { data: posts } = await supabase.from('social_posts').select('id, caption');
    const byCap = new Map<string, string>();
    for (const p of posts ?? []) {
      const k = capKey(p.caption);
      if (k.length >= 12 && !byCap.has(k)) byCap.set(k, p.id);
    }

    // Display API: list recent videos with their public metrics. Fields go in
    // the query string; pagination via cursor in the JSON body (two pages).
    const FIELDS =
      'id,title,video_description,view_count,like_count,comment_count,share_count';
    const videos: TikTokVideo[] = [];
    let cursor: number | undefined;
    for (let page = 0; page < 2; page++) {
      const res = await fetch(
        `https://open.tiktokapis.com/v2/video/list/?fields=${FIELDS}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
        },
      );
      const body = await res.json();
      if (!res.ok || body.error?.code !== 'ok') {
        return json({ error: `TikTok video.list: ${body.error?.message ?? res.status}` }, 502);
      }
      videos.push(...(body.data?.videos ?? []));
      if (!body.data?.has_more) break;
      cursor = body.data?.cursor;
    }

    let matched = 0;
    const unmatched: string[] = [];
    const failures: string[] = [];
    for (const v of videos) {
      const caption = v.title || v.video_description;
      const postId = byCap.get(capKey(caption));
      const permalink = `https://www.tiktok.com/@${cred.external_id ?? 'me'}/video/${v.id}`;
      if (!postId) {
        unmatched.push(permalink);
        continue;
      }
      try {
        const { error } = await supabase.from('social_post_results').insert({
          post_id: postId,
          platform: 'tiktok',
          views: v.view_count ?? null,
          likes: v.like_count ?? null,
          comments: v.comment_count ?? null,
          post_url: permalink,
          source: 'auto',
          note: v.share_count != null ? `${v.share_count} shares` : null,
        });
        if (error) throw new Error(error.message);
        matched++;
      } catch (e) {
        failures.push(`${permalink}: ${e instanceof Error ? e.message : e}`);
      }
    }

    return json({ scanned: videos.length, matched, unmatched: unmatched.length, failures });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'tiktok-sync failed' }, 500);
  }
});
