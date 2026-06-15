// src/lib/home/rowStyle.ts
import { COLORS } from '../../constants/colors';

export interface RowStyle {
  tone: 'light' | 'dark';
  accent: string; // accent bar + label colour
  ranked: boolean; // overlay 1·2·3 chart numerals
  feature: boolean; // larger first-row card treatment
}

const DEFAULT: RowStyle = {
  tone: 'light',
  accent: COLORS.orange,
  ranked: false,
  feature: false,
};

// Per-category overrides keyed by the catalog `key` used in explore.tsx.
const MAP: Record<string, Partial<RowStyle>> = {
  campaign: { feature: true, accent: COLORS.orange },
  youruniverse: { feature: true, accent: COLORS.skin },
  onscreen: { feature: true, accent: COLORS.orange },
  comingsoon: { accent: COLORS.gold },
  streaming: { accent: COLORS.blue },
  iconic: { feature: true, ranked: true, accent: COLORS.orange },
  franchise: { feature: true, accent: COLORS.goldAccent },
  villains: { tone: 'dark', accent: COLORS.red },
  horror: { tone: 'dark', accent: COLORS.red },
  marvel: { accent: COLORS.red },
  dc: { accent: COLORS.blue },
  anti: { tone: 'dark', accent: COLORS.grey },
  strongest: { tone: 'dark', ranked: true, accent: COLORS.yellow },
  xmen: { accent: COLORS.purple },
  anime: { accent: COLORS.purple },
  games: { accent: COLORS.green },
  minds: { ranked: true, accent: COLORS.blue },
  new: { accent: COLORS.green },
};

/** Editorial style for a curated Explore row, keyed by its catalog key. */
export function rowStyle(key: string): RowStyle {
  return { ...DEFAULT, ...MAP[key] };
}
