import { publisherHref, brandForPublisher } from '../../src/constants/publishers';

describe('publisherHref', () => {
  it('routes a registered brand by its stable slug', () => {
    expect(publisherHref('Marvel')).toBe('/publisher/marvel');
    // Resolves through substring matching too ("Marvel Comics" → marvel brand).
    expect(publisherHref('Marvel Comics')).toBe('/publisher/marvel');
  });

  it('routes an unregistered universe by its url-encoded raw name', () => {
    expect(publisherHref('NetherRealm Studios')).toBe('/publisher/NetherRealm%20Studios');
    expect(publisherHref('Avatar: The Last Airbender')).toBe(
      '/publisher/Avatar%3A%20The%20Last%20Airbender',
    );
  });

  it('returns null for category buckets and absent values', () => {
    expect(publisherHref('Company-Licensed')).toBeNull();
    expect(publisherHref('Non-Fictional')).toBeNull();
    expect(publisherHref('In the Public Domain')).toBeNull();
    expect(publisherHref(null)).toBeNull();
    expect(publisherHref(undefined)).toBeNull();
    expect(publisherHref('')).toBeNull();
  });
});

describe('brandForPublisher', () => {
  it('does not resolve a brand for category buckets', () => {
    expect(brandForPublisher('Company-Licensed')).toBeUndefined();
    expect(brandForPublisher('NetherRealm Studios')).toBeUndefined();
  });
});
