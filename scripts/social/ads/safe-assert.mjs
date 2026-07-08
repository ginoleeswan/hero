// The ad-safety hard gate. Every ad renderer passes its final HTML through
// this before writing an asset: if a portrait / remote image sneaks in, the
// render FAILS instead of producing an unsafe creative. Data: URIs (fonts,
// grain, inline SVG) are always fine — only remote imagery is banned.
const RULES = [
  [/<img[^>]+src=["'](?:(?:https?:)?\/\/|https?:)/i, 'remote image tag'],
  [/srcset=["'](?:(?:https?:)?\/\/|https?:)/i, 'remote srcset attribute'],
  [/res\.cloudinary\.com/i, 'cloudinary image reference'],
  [/comicvine\.gamespot\.com/i, 'comicvine image reference'],
  [/portrait_url|image_md_url|["']image_url["']/i, 'portrait field reference'],
  [/url\(\s*(?:["'])?(?:https?:)?\/\/|url\(\s*(?:["'])?https?:/i, 'remote css image'],
];

export function assertNoPortrait(html, label = 'ad asset') {
  for (const [re, why] of RULES) {
    if (re.test(html)) throw new Error(`[safe-assert] ${label}: ${why} — ad creative must be portrait-free`);
  }
}
