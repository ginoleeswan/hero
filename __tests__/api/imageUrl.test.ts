import { cloudinarySized, tmdbSized } from '../../api/_lib/imageUrl';

describe('cloudinarySized', () => {
  it('asks for a width-limited derivative', () => {
    expect(cloudinarySized('https://res.cloudinary.com/x/image/upload/v1/a.jpg', 720)).toBe(
      'https://res.cloudinary.com/x/image/upload/w_720,q_auto/v1/a.jpg',
    );
  });

  it('leaves non-Cloudinary sources alone', () => {
    expect(cloudinarySized('https://example.test/a.jpg')).toBe('https://example.test/a.jpg');
  });
});

describe('tmdbSized', () => {
  it('swaps the size bucket in the path', () => {
    expect(tmdbSized('https://image.tmdb.org/t/p/w1280/abc.jpg', 'w780')).toBe(
      'https://image.tmdb.org/t/p/w780/abc.jpg',
    );
    expect(tmdbSized('https://image.tmdb.org/t/p/original/abc.jpg', 'w500')).toBe(
      'https://image.tmdb.org/t/p/w500/abc.jpg',
    );
  });

  // The CodeQL finding this helper shipped with: `includes('image.tmdb.org')`
  // matches the host ANYWHERE in the string, and this function's answer decides
  // whether a URL is treated as a known image host whose path we rewrite.
  it('does not treat a foreign host as TMDB because the name appears in it', () => {
    const evil = 'https://evil.test/t/p/w1280/x.jpg?ref=image.tmdb.org';
    expect(tmdbSized(evil, 'w780')).toBe(evil);

    const subdomainish = 'https://image.tmdb.org.evil.test/t/p/w1280/x.jpg';
    expect(tmdbSized(subdomainish, 'w780')).toBe(subdomainish);
  });

  it('only rewrites a bucket at the start of the path', () => {
    const nested = 'https://image.tmdb.org/other/t/p/w1280/x.jpg';
    expect(tmdbSized(nested, 'w780')).toBe(nested);
  });

  it('hands back anything unparseable', () => {
    expect(tmdbSized('not a url', 'w780')).toBe('not a url');
    expect(tmdbSized('', 'w780')).toBe('');
  });
});
