// On-demand Instagram sync: lists recent IG media + insights and auto-matches
// each to a queue post BY CAPTION (we generate distinctive captions and the
// user copies them verbatim), then writes social_post_results rows. No manual
// linking needed — pressing "Sync Instagram" in the Insights tab is enough.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Normalize a caption to a comparable key: lowercase, letters+digits only,
// first 40 chars. Robust to emoji, punctuation, and trailing hashtags.
const capKey = (s: string | null | undefined) =>
  (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);

Deno.serve(async () => {
  const { data: cred } = await supabase
    .from('platform_credentials')
    .select('access_token, external_id')
    .eq('platform', 'instagram')
    .maybeSingle();
  if (!cred) return Response.json({ error: 'instagram not connected' }, { status: 400 });

  // Queue posts keyed by caption prefix (only those with a caption).
  const { data: posts } = await supabase.from('social_posts').select('id, caption');
  const byCap = new Map<string, string>();
  for (const p of posts ?? []) {
    const k = capKey(p.caption);
    if (k.length >= 12 && !byCap.has(k)) byCap.set(k, p.id);
  }

  // Recent media (paginate two pages = up to 100).
  const media: { id: string; permalink: string; caption?: string }[] = [];
  let url =
    `https://graph.instagram.com/v21.0/${cred.external_id}/media` +
    `?fields=id,permalink,caption&limit=50&access_token=${cred.access_token}`;
  for (let page = 0; page < 2 && url; page++) {
    const res = await fetch(url);
    if (!res.ok) return Response.json({ error: `media list HTTP ${res.status}` }, { status: 502 });
    const json = await res.json();
    media.push(...(json.data ?? []));
    url = json.paging?.next ?? '';
  }

  let matched = 0;
  const unmatched: string[] = [];
  const failures: string[] = [];
  for (const m of media) {
    const postId = byCap.get(capKey(m.caption));
    if (!postId) {
      unmatched.push(m.permalink);
      continue;
    }
    try {
      const insRes = await fetch(
        `https://graph.instagram.com/v21.0/${m.id}/insights?metric=reach,likes,comments,saved,shares&access_token=${cred.access_token}`,
      );
      if (!insRes.ok) throw new Error(`insights HTTP ${insRes.status}`);
      const ins = await insRes.json();
      const val = (name: string) =>
        ins.data?.find((d: { name: string }) => d.name === name)?.values?.[0]?.value ?? null;
      const { error } = await supabase.from('social_post_results').insert({
        post_id: postId,
        platform: 'instagram',
        views: val('reach'),
        likes: val('likes'),
        comments: val('comments'),
        post_url: m.permalink,
        source: 'auto',
        note: val('saved') != null ? `${val('saved')} saves, ${val('shares') ?? 0} shares` : null,
      });
      if (error) throw new Error(error.message);
      matched++;
    } catch (e) {
      failures.push(`${m.permalink}: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  return Response.json({ scanned: media.length, matched, unmatched: unmatched.length, failures });
});
