const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md';

// CDN only has images for numeric SuperheroAPI IDs — ComicVine (cv-*) IDs will 404.
const isNumericId = (id: string | number) => /^\d+$/.test(String(id));

/**
 * Full-resolution source for detail screens, featured panels, and carousels.
 * Priority: Supabase portrait → external URL → CDN (numeric IDs only)
 */
export function heroImageSource(
  id: string | number,
  imageUrl?: string | null,
  portraitUrl?: string | null,
): { uri: string } {
  if (portraitUrl) return { uri: portraitUrl };
  if (imageUrl?.startsWith('http')) return { uri: imageUrl };
  if (isNumericId(id)) return { uri: `${CDN_BASE}/${id}.jpg` };
  return { uri: '' };
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
  if (portraitUrl) return { uri: portraitUrl };
  if (imageMdUrl?.startsWith('http')) return { uri: imageMdUrl };
  if (imageUrl?.startsWith('http')) return { uri: imageUrl };
  if (isNumericId(id)) return { uri: `${CDN_BASE}/${id}.jpg` };
  return { uri: '' };
}
