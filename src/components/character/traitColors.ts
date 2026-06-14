import { COLORS } from '../../constants/colors';

// Each tag vocab category maps to one accent so the trait band reads at a glance:
// source = lineage, scope = power class, tone = mood, role = function, archetype = identity.
const CATEGORY_COLOR: Record<string, string> = {
  source: COLORS.purple,
  scope: COLORS.orange,
  tone: COLORS.red,
  role: COLORS.blue,
  archetype: COLORS.navy,
};

export function traitColor(category: string): string {
  return CATEGORY_COLOR[category] ?? COLORS.navy;
}

// Hex + alpha → 8-digit hex. Keeps tints derived from one source colour so a
// new category only needs a single entry above.
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
