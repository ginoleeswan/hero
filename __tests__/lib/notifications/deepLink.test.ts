// The tap payload is untrusted input — a push body is authored server-side but
// arrives through the OS, and an unchecked `url` is an open redirect out of the
// app. safePath is not exported (the hook owns it), so this asserts the rule it
// encodes against the same cases.
function safePath(data: unknown): string | null {
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== 'string') return null;
  if (!url.startsWith('/') || url.startsWith('//')) return null;
  return url;
}

describe('notification deep-link payloads', () => {
  it('accepts a rooted in-app path', () => {
    expect(safePath({ url: '/play' })).toBe('/play');
    expect(safePath({ url: '/compare/a/b?debate=1' })).toBe('/compare/a/b?debate=1');
  });

  it('refuses anything that leaves the app', () => {
    expect(safePath({ url: 'https://evil.test' })).toBeNull();
    expect(safePath({ url: '//evil.test' })).toBeNull();
    expect(safePath({ url: 'javascript:alert(1)' })).toBeNull();
    expect(safePath({ url: 'mythique://x' })).toBeNull();
  });

  it('refuses a missing or non-string url', () => {
    expect(safePath({})).toBeNull();
    expect(safePath(null)).toBeNull();
    expect(safePath({ url: 42 })).toBeNull();
  });
});
