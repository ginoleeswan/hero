import {
  parseUtm,
  deriveAttribution,
  attributionEventProps,
  type Attribution,
} from '../../src/lib/attribution';

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
