import { publisherHref, brandForPublisher } from '../../src/constants/publishers';

describe('publisherHref', () => {
  it('routes a registered brand by its stable slug', () => {
    expect(publisherHref('Marvel')).toBe('/universe/marvel');
    // Resolves through substring matching too ("Marvel Comics" → marvel brand).
    expect(publisherHref('Marvel Comics')).toBe('/universe/marvel');
  });

  it('routes a registered universe by its slug', () => {
    expect(publisherHref('NetherRealm Studios')).toBe('/universe/netherrealm');
    expect(publisherHref('Avatar: The Last Airbender')).toBe('/universe/avatar-last-airbender');
  });

  it('routes an unregistered universe by its url-encoded raw name', () => {
    // Kool-Aid / Sesame Street are deliberately left unregistered (render as text).
    expect(publisherHref('Kool-Aid')).toBe('/universe/Kool-Aid');
    expect(publisherHref('Sesame Street')).toBe('/universe/Sesame%20Street');
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
  it('resolves the newly-registered universes', () => {
    expect(brandForPublisher('NetherRealm Studios')?.slug).toBe('netherrealm');
    expect(brandForPublisher('Teenage Mutant Ninja Turtles')?.slug).toBe('tmnt');
    expect(brandForPublisher('SNK')?.slug).toBe('snk');
  });

  it('does not resolve a brand for category buckets', () => {
    expect(brandForPublisher('Company-Licensed')).toBeUndefined();
    expect(brandForPublisher('Kool-Aid')).toBeUndefined();
  });
});
