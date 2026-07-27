const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md';

// Cloud name is public — it appears in every Cloudinary delivery URL.
const CLOUDINARY_CLOUD = 'dgrsb5o4p';
const CLOUDINARY_MARKER = `res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/`;

// ComicVine serves pre-scaled variants by swapping the path segment right after
// /uploads/ (scale_small ~280px, scale_medium ~480px, scale_large ~1000px,
// original = full res). Ingested URLs are all scale_large; grid cards don't need
// that many pixels, so we downshift them to scale_medium.
const COMICVINE_MARKER = 'comicvine.gamespot.com/a/uploads/';

// Delivered widths per context. q_auto handles compression; f_auto handles format.
const DETAIL_WIDTH = 900; // detail screens, banners, carousels
const GRID_WIDTH = 600; // grid / thumbnail cards (sharp on retina)
// The square_* variants are pre-cropped to 1:1 — which is what a circular cameo
// was going to crop to anyway — and are the only ones small enough for a 30–64pt
// slot. Measured on a real character: scale_large 120KB, square_tiny 160px/12KB,
// square_avatar 80px/4KB.
type ComicVineVariant =
  'square_avatar' | 'square_tiny' | 'scale_small' | 'scale_medium' | 'scale_large';

// CDN only has images for numeric SuperheroAPI IDs — ComicVine (cv-*) IDs will 404.
const isNumericId = (id: string | number) => /^\d+$/.test(String(id));

// Some ingested rows point at a "no image" placeholder (ComicVine's blank.png or
// the akabab no-portrait). Treat those as missing so cards fall back to their own
// empty/initial treatment instead of rendering a broken-looking grey placeholder.
const isPlaceholder = (url?: string | null): boolean =>
  !!url && (url.includes('blank.png') || url.includes('no-portrait'));

/**
 * Whether a hero has art worth showing, as opposed to a source's stand-in for
 * "no art" — ComicVine serves one grey "Blank!" burst for ~6,000 characters.
 * Callers that render their own empty treatment need to know the difference.
 */
export const hasRealArt = (url?: string | null): boolean => !!realUrl(url);

const realUrl = (url?: string | null): string | null =>
  url && url.startsWith('http') && !isPlaceholder(url) ? url : null;

/**
 * Inject f_auto,q_auto,w_<width> into a Cloudinary delivery URL's /upload/ segment.
 * Non-Cloudinary URLs (Supabase, akabab CDN, external) are returned unchanged.
 */
export function withCloudinaryTransform(url: string, width: number): string {
  if (!url.includes(CLOUDINARY_MARKER)) return url;
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const insertAt = i + marker.length;
  return `${url.slice(0, insertAt)}f_auto,q_auto,w_${width}/${url.slice(insertAt)}`;
}

/**
 * Swap a ComicVine delivery URL's size segment for a smaller pre-scaled variant.
 * Non-ComicVine URLs (Cloudinary, Supabase, akabab CDN, external) are returned
 * unchanged.
 */
export function withComicVineScale(url: string, variant: ComicVineVariant): string {
  const i = url.indexOf(COMICVINE_MARKER);
  if (i === -1) return url;
  const segStart = i + COMICVINE_MARKER.length;
  const rest = url.slice(segStart);
  const slash = rest.indexOf('/');
  if (slash === -1) return url;
  return `${url.slice(0, segStart)}${variant}${rest.slice(slash)}`;
}

/** Apply both host-specific resize transforms; each is a no-op off its host. */
function withResize(uri: string, cloudWidth: number, cvVariant: ComicVineVariant): string {
  return withComicVineScale(withCloudinaryTransform(uri, cloudWidth), cvVariant);
}

/**
 * Full-resolution source for detail screens, featured panels, and carousels.
 * Priority: Supabase portrait → external URL → CDN (numeric IDs only)
 */
export function heroImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
): { uri: string } {
  const uri =
    realUrl(portraitUrl) ?? realUrl(imageUrl) ?? (isNumericId(id) ? `${CDN_BASE}/${id}.jpg` : '');
  return { uri: withResize(uri, DETAIL_WIDTH, 'scale_large') };
}

/**
 * Grid card source — uses the medium image URL for smaller thumbnails,
 * falling back to the same priority chain as heroImageSource.
 */
export function heroGridImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
  imageMdUrl?: string | null,
  // Mobile 3-col grid cells are ~110pt (≈330px @3x) — the 600px desktop
  // derivative is ~2x the bytes needed there. Callers pass a tighter width.
  width: number = GRID_WIDTH,
): { uri: string } {
  const uri =
    realUrl(portraitUrl) ??
    realUrl(imageMdUrl) ??
    realUrl(imageUrl) ??
    (isNumericId(id) ? `${CDN_BASE}/${id}.jpg` : '');
  return { uri: withResize(uri, width, 'scale_medium') };
}

// Avatars are flat icon marks, so they stay legible far smaller than a portrait.
// 128px covers a 34pt node at 3x with headroom; the stored PNG is 1024px/~500KB,
// which must never reach a 30px slot.
const AVATAR_WIDTH = 128;

/**
 * Portrait source for a node-sized circular slot — family-tree cameos, roster
 * rows, picker rows.
 *
 * The Cloudinary transform alone leaves a ComicVine URL untouched, and every
 * ingested ComicVine URL is `scale_large` (~1000px, 30–120KB), so a hero with no
 * Cloudinary portrait was pulling a full-size JPEG into a 30px circle. Those are
 * also served straight off ComicVine's origin rather than a CDN we control,
 * which is why they were the slots visibly still loading.
 *
 * Two square variants because one doesn't fit both ends: 80px covers a 34pt row
 * at 2x, 160px covers a 54pt cameo at 3x. Going wider is not free in the other
 * direction — ComicVine *upscales* a small source to fill the variant, and a
 * 142px PNG comes back three times heavier at square_tiny than at scale_large.
 */
export function heroCameoSource(url: string, size: number): { uri: string } {
  const width = Math.max(96, Math.round(size * 3));
  return { uri: withResize(url, width, size <= 40 ? 'square_avatar' : 'square_tiny') };
}

/**
 * Source for the flat icon avatar (heroes.avatar_url — transparent PNG on
 * Cloudinary). Returns null when the hero has no avatar, which is the common
 * case: they're only generated for the most famous heroes, so every call site
 * needs a fallback to its existing portrait/monogram treatment.
 */
export function heroAvatarSource(
  avatarUrl?: string | null,
  width: number = AVATAR_WIDTH,
): { uri: string } | null {
  const uri = realUrl(avatarUrl);
  return uri ? { uri: withAlphaSafeTransform(uri, width) } : null;
}

/**
 * Deliver a transparent PNG without wrecking its edges.
 *
 * `f_auto` picks PNG8 for these images, and a 256-colour palette cannot hold a
 * smooth alpha ramp: measured on Batman, the avatar comes back with 29 distinct
 * alpha levels instead of 73, which is exactly the crunchy, stair-stepped
 * silhouette you see against a dark background. Explicit WebP keeps the full
 * ramp AND is about half the bytes of what f_auto was choosing, so this is
 * cheaper and better at once. Only matters for cut-out art — opaque portraits
 * are fine on the normal transform.
 */
export function withAlphaSafeTransform(url: string, width: number): string {
  if (!url.includes(CLOUDINARY_MARKER)) return url;
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const insertAt = i + marker.length;
  return `${url.slice(0, insertAt)}f_webp,q_auto,w_${width}/${url.slice(insertAt)}`;
}

// The margin is load-bearing: the universe scene's faction halo fades to nothing
// by ~90% of a sprite's half-extent, so a full-bleed disc hides it completely.
const DISC_INSET = 0.78;

/**
 * Portrait → circular head disc, padded inside a transparent square.
 *
 * `g_north` because portraits are 2:3 head-and-shoulders, so the top square
 * lands the face; `g_face` is unreliable on illustrated art. Desaturated so a
 * portrait's own coloured ground can't impersonate a faction tint.
 */
export function withHeadDiscTransform(url: string, width: number): string {
  if (!url.includes(CLOUDINARY_MARKER)) return url;
  const marker = '/upload/';
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const insertAt = i + marker.length;
  const disc = Math.round(width * DISC_INSET);
  return (
    `${url.slice(0, insertAt)}` +
    `ar_1:1,c_fill,g_north,r_max,w_${disc}/` +
    `c_lpad,w_${width},h_${width},b_transparent/` +
    `e_saturation:-30,f_webp,q_auto/` +
    `${url.slice(insertAt)}`
  );
}

/**
 * Texture source for a WebGL universe node: cut-out avatar, else the portrait as
 * a head disc, else null for the caller's monogram.
 *
 * ComicVine `image_url` can't be a third tier — that host sends no CORS header
 * and WebGL refuses a cross-origin texture without one, so it could only fail
 * back to the monogram. It would need mirroring through Cloudinary first.
 */
export function heroNodeTextureSource(
  avatarUrl?: string | null,
  portraitUrl?: string | null,
  width: number = AVATAR_WIDTH,
): { uri: string; tier: 'avatar' | 'portrait' } | null {
  const avatar = realUrl(avatarUrl);
  if (avatar) return { uri: withAlphaSafeTransform(avatar, width), tier: 'avatar' };
  // Off-Cloudinary portraits can't be cropped, and an uncropped rectangle would
  // read as a floating card among the heads. All 3,896 are Cloudinary today.
  const portrait = realUrl(portraitUrl);
  if (portrait && portrait.includes(CLOUDINARY_MARKER)) {
    return { uri: withHeadDiscTransform(portrait, width), tier: 'portrait' };
  }
  return null;
}

/**
 * True when there's a usable portrait for this hero. When false, surfaces should
 * render the monogram fallback (see HeroImage) instead of a blank Image.
 */
export function hasHeroImage(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
  imageMdUrl?: string | null,
): boolean {
  return !!(realUrl(portraitUrl) || realUrl(imageMdUrl) || realUrl(imageUrl) || isNumericId(id));
}

/**
 * Up to two initials for a hero's monogram fallback. Uses the first letters of
 * the first two alphanumeric words; falls back to "?" for empty/symbolic names.
 */
export function heroInitials(name?: string | null): string {
  if (!name) return '?';
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Dark, saturated palette — beige initials stay legible on every one. Indexed by
// a stable hash of the hero id so each hero keeps the same colour across surfaces.
const MONOGRAM_COLORS = [
  '#293C43', // navy
  '#0b1820', // deepNavy
  '#502314', // brown
  '#7c3aed', // purple
  '#b07d00', // gold
  '#15A1AB', // blue
  '#63A936', // green
  '#B5302B', // red
] as const;

/** Deterministic monogram background colour for a hero id. */
export function monogramColor(id: string | number): string {
  const str = String(id);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return MONOGRAM_COLORS[Math.abs(hash) % MONOGRAM_COLORS.length];
}
