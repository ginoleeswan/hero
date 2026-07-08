// Original mystery-character silhouettes — head-and-shoulder busts drawn from
// primitives (no franchise tracing; these are archetypes and 100% our IP).
// Used wherever the reels need "a character we can't show": the VS plates and
// the guess reveal. Solid ink fill with a subtle colored rim so they read as
// figures at thumbnail size, not blobs.
const BUSTS = {
  // Cowl: sharp pointed ears, low crown, jaw taper, caped shoulders (the
  // "knight" archetype).
  cowl: `M116 36 L134 64 C140 58 145 56 150 56 C155 56 160 58 166 64 L184 36 L190 70 C196 84 198 96 196 108 C194 124 186 138 174 146 L174 158 C204 164 228 176 244 194 C250 200 254 208 256 216 L256 232 L44 232 L44 216 C46 208 50 200 56 194 C72 176 96 164 126 158 L126 146 C114 138 106 124 104 108 C102 96 104 84 110 70 Z`,
  // Rounded hood over the head (the "mystic" archetype).
  hood: `M150 30 C186 30 214 62 218 104 C220 130 214 152 202 168 C228 178 246 194 256 214 L256 232 L44 232 L44 214 C54 194 72 178 98 168 C86 152 80 130 82 104 C86 62 114 30 150 30 Z M150 58 C128 58 112 78 110 104 C108 128 118 148 134 156 L166 156 C182 148 192 128 190 104 C188 78 172 58 150 58 Z`,
  // Jagged upswept hair + lean shoulders (the "saiyan" archetype).
  spikes: `M150 176 C132 176 118 168 108 156 C100 160 88 162 78 158 L92 146 C84 142 76 134 72 124 L90 126 C84 116 82 104 84 92 L100 102 C98 88 102 72 112 60 L122 76 C126 60 136 46 150 38 C164 46 174 60 178 76 L188 60 C198 72 202 88 200 102 L216 92 C218 104 216 116 210 126 L228 124 C224 134 216 142 208 146 L222 158 C212 162 200 160 192 156 C182 168 168 176 150 176 Z M100 178 C74 184 54 196 42 214 L42 232 L258 232 L258 214 C246 196 226 184 200 178 C186 188 170 194 150 194 C130 194 114 188 100 178 Z`,
};

/** A mystery bust as an inline SVG. `rim` tints the edge glow. */
export function silhouette(kind = 'cowl', { size = 220, rim = '#e0a83e', ink = '#0b1a24' } = {}) {
  const d = BUSTS[kind] ?? BUSTS.cowl;
  return `<svg width="${size}" height="${Math.round(size * 0.86)}" viewBox="30 20 240 220" xmlns="http://www.w3.org/2000/svg">
    <path d="${d}" fill="${ink}" stroke="${rim}" stroke-opacity="0.55" stroke-width="4"/>
  </svg>`;
}

export const SILHOUETTE_KINDS = Object.keys(BUSTS);
