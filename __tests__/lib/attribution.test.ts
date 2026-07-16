import {
  parseUtm,
  deriveAttribution,
  attributionEventProps,
  recordAttribution,
  type Attribution,
} from '../../src/lib/attribution';

jest.mock('../../src/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));
jest.mock('../../src/lib/db/pageViews', () => ({
  getSessionId: () => 'sid-123',
  getReferrerHost: () => null,
}));

describe('parseUtm', () => {
  it('pulls all five UTM params from a query string', () => {
    expect(
      parseUtm(
        '?utm_source=tiktok&utm_medium=social&utm_campaign=bio&utm_content=v1&utm_term=goku',
      ),
    ).toEqual({
      source: 'tiktok',
      medium: 'social',
      campaign: 'bio',
      content: 'v1',
      term: 'goku',
    });
  });

  it('returns nulls for a query string with no UTM params', () => {
    expect(parseUtm('?foo=bar')).toEqual({
      source: null,
      medium: null,
      campaign: null,
      content: null,
      term: null,
    });
  });

  it('is null-safe on an empty query', () => {
    expect(parseUtm('').source).toBeNull();
  });

  it('trims whitespace and treats blank values as absent', () => {
    expect(parseUtm('?utm_source=%20%20&utm_campaign=%20villains%20').source).toBeNull();
    expect(parseUtm('?utm_campaign=%20villains%20').campaign).toBe('villains');
  });

  it('caps overly long values to 120 chars', () => {
    const long = 'x'.repeat(300);
    expect(parseUtm(`?utm_campaign=${long}`).campaign).toHaveLength(120);
  });
});

describe('deriveAttribution', () => {
  it('uses an explicit utm_source over the referrer', () => {
    const a = deriveAttribution('?utm_source=tiktok&utm_campaign=bio', 'l.instagram.com', '/');
    expect(a).toMatchObject({ source: 'tiktok', campaign: 'bio', referrer: 'l.instagram.com' });
  });

  it('leaves medium null when a utm_source has no explicit medium', () => {
    expect(deriveAttribution('?utm_source=tiktok', null, '/')?.medium).toBeNull();
  });

  it('falls back to the referrer host as a referral source when no UTM', () => {
    const a = deriveAttribution('', 'www.google.com', '/explore');
    expect(a).toMatchObject({ source: 'www.google.com', medium: 'referral', landing: '/explore' });
  });

  it('returns null for direct, untagged visits (no UTM, no referrer)', () => {
    expect(deriveAttribution('?foo=bar', null, '/')).toBeNull();
  });

  it('attributes on campaign alone even without a source', () => {
    expect(deriveAttribution('?utm_campaign=aquaman', null, '/')?.campaign).toBe('aquaman');
  });
});

describe('attributionEventProps', () => {
  it('is empty for null (direct) attribution', () => {
    expect(attributionEventProps(null)).toEqual({});
  });

  it('emits only the present, flat props', () => {
    const a: Attribution = {
      source: 'tiktok',
      medium: 'social',
      campaign: 'bio',
      content: null,
      term: null,
      referrer: null,
      landing: '/',
    };
    expect(attributionEventProps(a)).toEqual({
      utm_source: 'tiktok',
      utm_medium: 'social',
      utm_campaign: 'bio',
    });
  });

  it('omits keys whose values are null', () => {
    const a: Attribution = {
      source: 'www.google.com',
      medium: 'referral',
      campaign: null,
      content: null,
      term: null,
      referrer: 'www.google.com',
      landing: '/',
    };
    expect(attributionEventProps(a)).toEqual({
      utm_source: 'www.google.com',
      utm_medium: 'referral',
    });
  });
});

describe('recordAttribution', () => {
  const STORE_KEY = 'mythique_attr';
  const SENT_KEY = 'mythique_attr_sent';
  const firstTouch: Attribution = {
    source: 'tiktok',
    medium: 'paid-social',
    campaign: 'launch',
    content: null,
    term: null,
    referrer: 'tiktok.com',
    landing: '/explore',
  };
  const fetchMock = jest.fn();

  // recordAttribution is web-only: it early-returns unless window + localStorage
  // exist. This suite runs in the node env, so stub both.
  const store: Record<string, string> = {};
  const localStorageStub = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };

  beforeAll(() => {
    (global as Record<string, unknown>).window = {};
    (global as Record<string, unknown>).localStorage = localStorageStub;
  });
  afterAll(() => {
    delete (global as Record<string, unknown>).window;
    delete (global as Record<string, unknown>).localStorage;
  });

  beforeEach(() => {
    localStorageStub.clear();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_KEY = 'anon-key';
    localStorageStub.setItem(STORE_KEY, JSON.stringify(firstTouch));
  });

  const prefer = () =>
    (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.prefer;

  // THE REGRESSION: `resolution=ignore-duplicates` puts PostgREST on its upsert
  // (ON CONFLICT) path, which RLS rejects on this insert-only table (401/42501),
  // so every attribution write silently failed. See src/lib/attribution.ts.
  it('never sends resolution=ignore-duplicates (RLS rejects the upsert path)', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    await recordAttribution();
    expect(prefer()).not.toContain('resolution=ignore-duplicates');
    expect(prefer()).toBe('return=minimal');
  });

  it('posts the first-touch to session_attribution and marks it sent on 201', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    await recordAttribution();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/session_attribution');
    expect(JSON.parse((init as { body: string }).body)).toMatchObject({
      session_id: 'sid-123',
      utm_source: 'tiktok',
      utm_campaign: 'launch',
      referrer: 'tiktok.com',
      landing_path: '/explore',
    });
    expect(localStorageStub.getItem(SENT_KEY)).toBe('1');
  });

  it('treats 409 (row already exists for this session) as done', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409 });
    await recordAttribution();
    expect(localStorageStub.getItem(SENT_KEY)).toBe('1');
  });

  it('leaves the flag unset on failure so a later load retries', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 }); // e.g. before the migration lands
    await recordAttribution();
    expect(localStorageStub.getItem(SENT_KEY)).toBeNull();
  });

  it('writes once per browser — skips when already sent', async () => {
    localStorageStub.setItem(SENT_KEY, '1');
    await recordAttribution();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not write for direct visits (no stored first-touch)', async () => {
    localStorageStub.removeItem(STORE_KEY);
    await recordAttribution();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(recordAttribution()).resolves.toBeUndefined();
    expect(localStorageStub.getItem(SENT_KEY)).toBeNull();
  });
});
