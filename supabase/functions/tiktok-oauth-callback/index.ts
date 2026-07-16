// One-time manual helper: completes the TikTok Login Kit OAuth code exchange
// and upserts the result into platform_credentials (platform='tiktok'), same
// row shape tiktok-sync expects (access_token, refresh_token, external_id).
//
// Usage (once per environment — sandbox now, production after approval):
// 1. Register this function's URL as the app's redirect URI on the TikTok
//    developer portal (Login Kit settings), matching the environment you're
//    testing (sandbox vs production have separate redirect URI lists).
// 2. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_OAUTH_STATE as
//    function secrets (the state value is just a shared secret you invent —
//    it stops randoms who find this URL from linking their own account).
// 3. Open the authorize URL in a browser logged into the target TikTok
//    account, approve, and this endpoint does the rest.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const page = (body: string, ok: boolean) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>TikTok connect</title>
     <body style="font-family:sans-serif;padding:2rem">
       <h1>${ok ? 'Connected' : 'Failed'}</h1><p>${body}</p>
       ${ok ? '<p>You can close this tab.</p>' : ''}
     </body>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html' } },
  );

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const err = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (err) return page(`TikTok returned an error: ${err}`, false);
  if (state !== Deno.env.get('TIKTOK_OAUTH_STATE')) {
    return page('State mismatch — refusing to proceed.', false);
  }
  if (!code) return page('Missing authorization code.', false);

  const redirectUri = `${url.origin}${url.pathname}`;
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: Deno.env.get('TIKTOK_CLIENT_KEY') ?? '',
      client_secret: Deno.env.get('TIKTOK_CLIENT_SECRET') ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    return page(`Token exchange failed: ${JSON.stringify(body)}`, false);
  }

  const { error } = await supabase.from('platform_credentials').upsert(
    {
      platform: 'tiktok',
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? null,
      external_id: body.open_id ?? null,
      expires_at: new Date(Date.now() + (body.expires_in ?? 86_400) * 1000).toISOString(),
    },
    { onConflict: 'platform' },
  );
  if (error) return page(`Saved token but DB write failed: ${error.message}`, false);

  return page(`open_id ${body.open_id} connected. Try "Pull TikTok" in the Command Center now.`, true);
});
