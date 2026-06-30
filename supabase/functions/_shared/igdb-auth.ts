// Twitch OAuth client-credentials exchange for IGDB access. No top-level
// Deno.env / https imports so Jest can import it; the caller passes creds + an
// optional fetch (defaults to global fetch, present in both Deno and Node 18+).

export async function getIgdbToken(
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });
  const res = await fetchFn(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Twitch token error: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Twitch token error: no access_token in response');
  return json.access_token;
}
