import handler from '../../api/geo';

function run(headers: Record<string, string | string[] | undefined>) {
  const set: Record<string, string> = {};
  let body = '';
  handler({ headers }, { setHeader: (k, v) => (set[k] = v), send: (b) => (body = b) });
  return { set, json: JSON.parse(body) as Record<string, string | null> };
}

describe('api/geo', () => {
  it('echoes the coarse Vercel geo headers, URL-decoded', () => {
    const { set, json } = run({
      'x-vercel-ip-country': 'BR',
      'x-vercel-ip-country-region': 'SP',
      'x-vercel-ip-city': 'S%C3%A3o%20Paulo',
      'x-vercel-ip-timezone': 'America/Sao_Paulo',
    });
    expect(json).toEqual({
      country: 'BR',
      region: 'SP',
      city: 'São Paulo',
      timezone: 'America/Sao_Paulo',
    });
    // A per-visitor answer must never be cached in a shared layer.
    expect(set['cache-control']).toBe('private, no-store');
  });

  it('is all-null off Vercel and survives a malformed encoding', () => {
    expect(run({}).json).toEqual({ country: null, region: null, city: null, timezone: null });
    expect(run({ 'x-vercel-ip-city': '%E0%A4%A' }).json.city).toBe('%E0%A4%A');
  });
});
