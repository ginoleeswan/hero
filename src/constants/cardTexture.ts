// src/constants/cardTexture.ts — the shared "printed comic" overlay that sits
// over the vignette and under the content on every share card. Two quiet layers:
//   1. a warm radial glow blooming from the top-centre (behind the logo lockup)
//   2. a halftone dot field, radially masked so dots frame the edges and dissolve
//      out of the centre where portraits + text live.
// One SVG source keeps satori (OG `<img>`), the web canvases (drawImage) and
// native (react-native-svg, src/components/ui/CardTexture.tsx) identical. Pure
// data, no RN imports — `api/` may import it.

export const TEXTURE = {
  /** Halftone dots — beige on the dark stage. */
  dotColor: '#f5ebdc',
  dotRadius: 2.4,
  dotTile: 16,
  dotOpacity: 0.06,
  /** Warm top-centre bloom. */
  glowColor: '#CE9B33',
  glowOpacity: 0.1,
} as const;

/**
 * A full-card texture SVG at `w × h`. `glow` overrides the bloom colour (e.g. the
 * card's accent). Uses stop-opacity (not rgba) so resvg — the rasteriser behind
 * @vercel/og — renders the gradients reliably.
 */
export const cardTextureSvg = (w: number, h: number, glow: string = TEXTURE.glowColor): string => {
  const t = TEXTURE.dotTile;
  const c = t / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="10%" r="72%">
      <stop offset="0%" stop-color="${glow}" stop-opacity="${TEXTURE.glowOpacity}"/>
      <stop offset="60%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="${t}" height="${t}" patternUnits="userSpaceOnUse">
      <circle cx="${c}" cy="${c}" r="${TEXTURE.dotRadius}" fill="${TEXTURE.dotColor}"/>
    </pattern>
    <radialGradient id="edge" cx="50%" cy="42%" r="75%">
      <stop offset="34%" stop-color="#000"/>
      <stop offset="100%" stop-color="#fff"/>
    </radialGradient>
    <mask id="frame"><rect width="${w}" height="${h}" fill="url(#edge)"/></mask>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <g mask="url(#frame)"><rect width="${w}" height="${h}" fill="url(#dots)" opacity="${TEXTURE.dotOpacity}"/></g>
</svg>`;
};

/** A `data:image/svg+xml` URI of the texture (satori `<img>` + canvas `Image`). */
export const cardTextureDataUri = (w: number, h: number, glow?: string): string =>
  `data:image/svg+xml,${encodeURIComponent(cardTextureSvg(w, h, glow))}`;
