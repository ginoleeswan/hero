import { getIgdbToken } from '../../supabase/functions/_shared/igdb-auth';

describe('getIgdbToken', () => {
  it('exchanges client credentials for a bearer token', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok_123', expires_in: 5000 }),
    });
    const tok = await getIgdbToken('cid', 'secret', fetchFn as unknown as typeof fetch);
    expect(tok).toBe('tok_123');
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('id.twitch.tv/oauth2/token');
    expect(url).toContain('client_id=cid');
    expect(url).toContain('grant_type=client_credentials');
  });

  it('throws when Twitch responds non-OK', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => 'nope' });
    await expect(getIgdbToken('cid', 'secret', fetchFn as unknown as typeof fetch)).rejects.toThrow(
      /twitch/i,
    );
  });

  it('throws when access_token is absent from a 200 response', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ expires_in: 5000 }), // no access_token
    });
    await expect(getIgdbToken('cid', 'secret', fetchFn as unknown as typeof fetch)).rejects.toThrow(
      /twitch/i,
    );
  });
});
