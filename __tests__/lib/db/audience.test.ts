import {
  fetchAudienceBreakdown,
  fetchAudienceSessions,
  countryName,
} from '../../../src/lib/db/audience';

const mockRpc = jest.fn();
jest.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: (...a: unknown[]) => mockRpc(...a) },
}));

describe('fetchAudienceBreakdown', () => {
  beforeEach(() => mockRpc.mockReset());

  it('passes the window and defaults every missing list to empty', async () => {
    mockRpc.mockResolvedValue({
      data: {
        authorized: true,
        rangeDays: 7,
        totals: {
          sessions: 12,
          signedIn: 3,
          bounced: 5,
          avgViews: 2.4,
          avgMinutes: 1.5,
          countries: 4,
        },
        countries: [{ code: 'DE', visitors: 6, views: 20 }],
      },
      error: null,
    });
    const b = await fetchAudienceBreakdown(7);
    expect(mockRpc).toHaveBeenCalledWith('admin_audience_breakdown', { p_days: 7 });
    expect(b?.countries[0].code).toBe('DE');
    expect(b?.cities).toEqual([]);
    expect(b?.hours).toEqual([]);
    expect(b?.newVsReturning).toEqual({ new: 0, returning: 0 });
    expect(b?.totals.sessions).toBe(12);
  });

  it('returns null when not authorised', async () => {
    mockRpc.mockResolvedValue({ data: { authorized: false }, error: null });
    expect(await fetchAudienceBreakdown()).toBeNull();
  });
});

describe('fetchAudienceSessions', () => {
  beforeEach(() => mockRpc.mockReset());

  const sess = (lastAt: string) => ({
    sessionId: `s-${lastAt}`,
    firstAt: lastAt,
    lastAt,
    views: 3,
    signedIn: false,
    displayName: null,
    country: 'DE',
    region: null,
    city: 'Berlin',
    device: 'mobile',
    browser: 'Safari',
    os: 'iOS',
    lang: 'de-DE',
    timezone: 'Europe/Berlin',
    screenW: 390,
    screenH: 844,
    source: 'reddit.com',
    medium: 'referral',
    campaign: null,
    landing: '/',
    returning: false,
    trail: undefined,
  });

  it('maps filters to RPC args, defaults a missing trail, and cursors on lastAt', async () => {
    mockRpc.mockResolvedValue({
      data: {
        authorized: true,
        sessions: [sess('2026-09-15T10:00:00Z'), sess('2026-09-15T09:00:00Z')],
      },
      error: null,
    });
    const page = await fetchAudienceSessions({
      days: 28,
      limit: 2,
      filters: { country: 'DE', device: 'mobile' },
    });
    expect(mockRpc).toHaveBeenCalledWith('admin_audience_sessions', {
      p_days: 28,
      p_before: undefined,
      p_limit: 2,
      p_country: 'DE',
      p_device: 'mobile',
      // Omitted filters go out as undefined so the RPC's parameter defaults apply.
      p_browser: undefined,
      p_source: undefined,
    });
    expect(page?.sessions[0].trail).toEqual([]);
    expect(page?.nextBefore).toBe('2026-09-15T09:00:00Z');
  });

  it('ends pagination on a short page', async () => {
    mockRpc.mockResolvedValue({
      data: { authorized: true, sessions: [sess('2026-09-15T10:00:00Z')] },
      error: null,
    });
    const page = await fetchAudienceSessions({ limit: 25 });
    expect(page?.nextBefore).toBeNull();
  });
});

describe('countryName', () => {
  it('resolves ISO codes and falls back cleanly', () => {
    expect(countryName('DE')).toBe('Germany');
    expect(countryName('unknown')).toBe('Unknown');
    expect(countryName(null)).toBe('Unknown');
  });
});
