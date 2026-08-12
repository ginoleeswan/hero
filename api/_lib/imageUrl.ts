// Image-URL narrowing for the OG card renderer. Pure, and in _lib rather than
// inside api/og/index.tsx, for the same reason shareMeta.ts lives here: it is
// testable under jest, and the edge module is not (it imports @vercel/og).
//
// Both helpers exist because satori fetches and decodes every image inline
// while it streams the response, and a large enough source kills the render
// PART WAY THROUGH — after `200 image/png` has already gone out, so the failure
// surfaces as an EMPTY body rather than reaching the catch that redirects to
// the static brand card. Every character and VS unfurl served a blank image
// once for exactly this reason.

/** Cloudinary: ask for a card-sized derivative instead of the original. */
export function cloudinarySized(url: string, w = 720): string {
  return url.includes('/upload/') ? url.replace('/upload/', `/upload/w_${w},q_auto/`) : url;
}

export type TmdbBucket = 'w780' | 'w500' | 'w342';

/**
 * TMDB: swap the size bucket in the path.
 *
 * The catalogue stores backdrops at `w1280`, comfortably inside the range that
 * kills the renderer, and TMDB is not Cloudinary so `cloudinarySized` passes
 * those URLs straight through. The buckets are path segments, so downsizing is
 * a swap.
 *
 * The host is matched by PARSING, not by `includes('image.tmdb.org')`. A
 * substring test matches anywhere in the string — `https://evil.test/?x=image.
 * tmdb.org` passes it — and this function's answer is what decides whether a
 * URL is treated as a known image host whose paths we rewrite. Anything that is
 * not exactly that host, or is not a parseable absolute URL, comes back
 * untouched.
 */
export function tmdbSized(url: string, bucket: TmdbBucket): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.hostname !== 'image.tmdb.org') return url;
  u.pathname = u.pathname.replace(/^\/t\/p\/(w\d+|original)\//, `/t/p/${bucket}/`);
  return u.toString();
}
