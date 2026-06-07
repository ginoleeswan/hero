const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md';

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
 * Full-resolution source for detail screens, featured panels, and carousels.
 * Priority: Supabase portrait → external URL → CDN (numeric IDs only)
 */
export function heroImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
): { uri: string } {
  return { uri: realUrl(portraitUrl) ?? realUrl(imageUrl) ?? (isNumericId(id) ? `${CDN_BASE}/${id}.jpg` : '') };
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
  return {
    uri:
      realUrl(portraitUrl) ??
      realUrl(imageMdUrl) ??
      realUrl(imageUrl) ??
      (isNumericId(id) ? `${CDN_BASE}/${id}.jpg` : ''),
  };
}
