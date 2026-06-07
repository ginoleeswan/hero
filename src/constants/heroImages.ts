const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md';

// Cloud name is public — it appears in every Cloudinary delivery URL.
const CLOUDINARY_CLOUD = 'dgrsb5o4p';
const CLOUDINARY_MARKER = `res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/`;

// Delivered widths per context. q_auto handles compression; f_auto handles format.
const DETAIL_WIDTH = 900; // detail screens, banners, carousels
const GRID_WIDTH = 600; // grid / thumbnail cards (sharp on retina)

// CDN only has images for numeric SuperheroAPI IDs — ComicVine (cv-*) IDs will 404.
const isNumericId = (id: string | number) => /^\d+$/.test(String(id));

// Some ingested rows point at a "no image" placeholder (ComicVine's blank.png or
// the akabab no-portrait). Treat those as missing so cards fall back to their own
// empty/initial treatment instead of rendering a broken-looking grey placeholder.
const isPlaceholder = (url?: string | null): boolean =>
  !!url && (url.includes('blank.png') || url.includes('no-portrait'));

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
  return { uri: withCloudinaryTransform(uri, DETAIL_WIDTH) };
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
): { uri: string } {
  const uri =
    realUrl(portraitUrl) ??
    realUrl(imageMdUrl) ??
    realUrl(imageUrl) ??
    (isNumericId(id) ? `${CDN_BASE}/${id}.jpg` : '');
  return { uri: withCloudinaryTransform(uri, GRID_WIDTH) };
}
