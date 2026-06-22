/** Parse a comma-joined hero-id list from a URL query param into up to five ids. */
export function parseIds(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 5);
}
