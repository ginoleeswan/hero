// src/constants/powerIcons.ts

export type PowerCategory =
  | 'physical'
  | 'combat'
  | 'mental'
  | 'energy'
  | 'tech'
  | 'mystic'
  | 'other';

export interface PowerIconDef {
  icon: string;
  gradientStart: string;
  gradientEnd: string;
  category: PowerCategory;
}

// Display order + label + semantic accent colour per category (brand palette).
export const POWER_CATEGORY_ORDER: PowerCategory[] = [
  'physical',
  'combat',
  'mental',
  'energy',
  'tech',
  'mystic',
  'other',
];

export const POWER_CATEGORY_META: Record<PowerCategory, { label: string; color: string }> = {
  physical: { label: 'Physical', color: '#B5302B' },
  combat: { label: 'Combat & Skill', color: '#7A4A1E' },
  mental: { label: 'Mental', color: '#15A1AB' },
  energy: { label: 'Energy', color: '#E77333' },
  tech: { label: 'Tech', color: '#7c3aed' },
  mystic: { label: 'Mystic', color: '#A77A12' },
  other: { label: 'Other', color: '#7E7C74' },
};

/**
 * Substring-keyed map of power name fragments → icon + gradient + category.
 * Keys are lowercase. Matching is case-insensitive substring.
 * Order matters — more specific keys should come before broader ones.
 */
export const POWER_ICONS: Record<string, PowerIconDef> = {
  // Physical
  strength: {
    icon: 'barbell',
    gradientStart: '#ff8a8a',
    gradientEnd: '#c0392b',
    category: 'physical',
  },
  flight: {
    icon: 'airplane',
    gradientStart: '#a5f3fc',
    gradientEnd: '#0e7490',
    category: 'physical',
  },
  fly: { icon: 'airplane', gradientStart: '#a5f3fc', gradientEnd: '#0e7490', category: 'physical' },
  speed: { icon: 'flash', gradientStart: '#fde68a', gradientEnd: '#d97706', category: 'physical' },
  agility: { icon: 'walk', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'physical' },
  reflexes: {
    icon: 'flash',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'physical',
  },
  stamina: {
    icon: 'fitness',
    gradientStart: '#6ee7b7',
    gradientEnd: '#047857',
    category: 'physical',
  },
  claws: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'physical' },
  beast: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'physical' },
  animal: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'physical' },
  acrobat: { icon: 'walk', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'physical' },
  underwater: {
    icon: 'water',
    gradientStart: '#a5f3fc',
    gradientEnd: '#0e7490',
    category: 'physical',
  },
  aquatic: {
    icon: 'water',
    gradientStart: '#a5f3fc',
    gradientEnd: '#0e7490',
    category: 'physical',
  },

  // Defensive (physical)
  invulner: {
    icon: 'shield-checkmark',
    gradientStart: '#6ee7b7',
    gradientEnd: '#047857',
    category: 'physical',
  },
  durability: {
    icon: 'shield',
    gradientStart: '#6ee7b7',
    gradientEnd: '#047857',
    category: 'physical',
  },
  healing: {
    icon: 'medkit',
    gradientStart: '#86efac',
    gradientEnd: '#15803d',
    category: 'physical',
  },
  regenerat: {
    icon: 'medkit',
    gradientStart: '#86efac',
    gradientEnd: '#15803d',
    category: 'physical',
  },

  // Sensory (physical)
  'x-ray': { icon: 'scan', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'physical' },
  sense: { icon: 'scan', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'physical' },
  sonar: { icon: 'radio', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'physical' },

  // Size (physical)
  size: { icon: 'resize', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'physical' },
  giant: { icon: 'resize', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'physical' },
  shrink: {
    icon: 'resize',
    gradientStart: '#fde68a',
    gradientEnd: '#b45309',
    category: 'physical',
  },

  // Mental
  telepathy: {
    icon: 'pulse',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'mental',
  },
  telekinesis: {
    icon: 'planet',
    gradientStart: '#c4b5fd',
    gradientEnd: '#6d28d9',
    category: 'mental',
  },
  'mind control': {
    icon: 'pulse',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'mental',
  },
  precognit: { icon: 'eye', gradientStart: '#c4b5fd', gradientEnd: '#6d28d9', category: 'mental' },
  intelligence: {
    icon: 'library',
    gradientStart: '#93c5fd',
    gradientEnd: '#1e40af',
    category: 'mental',
  },
  genius: { icon: 'library', gradientStart: '#93c5fd', gradientEnd: '#1e40af', category: 'mental' },
  empathy: { icon: 'heart', gradientStart: '#fda4af', gradientEnd: '#be123c', category: 'mental' },
  emotion: { icon: 'heart', gradientStart: '#fda4af', gradientEnd: '#be123c', category: 'mental' },

  // Energy
  'force field': {
    icon: 'shield',
    gradientStart: '#6ee7b7',
    gradientEnd: '#065f46',
    category: 'energy',
  },
  'heat vision': {
    icon: 'eye',
    gradientStart: '#fed7aa',
    gradientEnd: '#c2410c',
    category: 'energy',
  },
  laser: { icon: 'eye', gradientStart: '#fed7aa', gradientEnd: '#c2410c', category: 'energy' },
  energy: { icon: 'nuclear', gradientStart: '#fde68a', gradientEnd: '#ca8a04', category: 'energy' },
  radiation: {
    icon: 'nuclear',
    gradientStart: '#d9f99d',
    gradientEnd: '#4d7c0f',
    category: 'energy',
  },
  fire: { icon: 'flame', gradientStart: '#fed7aa', gradientEnd: '#ea580c', category: 'energy' },
  ice: { icon: 'snow', gradientStart: '#e0f2fe', gradientEnd: '#0284c7', category: 'energy' },
  freeze: { icon: 'snow', gradientStart: '#e0f2fe', gradientEnd: '#0284c7', category: 'energy' },
  cold: { icon: 'snow', gradientStart: '#e0f2fe', gradientEnd: '#0284c7', category: 'energy' },
  electric: { icon: 'flash', gradientStart: '#fef08a', gradientEnd: '#ca8a04', category: 'energy' },
  lightning: {
    icon: 'thunderstorm',
    gradientStart: '#fef08a',
    gradientEnd: '#a16207',
    category: 'energy',
  },
  storm: {
    icon: 'thunderstorm',
    gradientStart: '#bae6fd',
    gradientEnd: '#0369a1',
    category: 'energy',
  },
  weather: {
    icon: 'thunderstorm',
    gradientStart: '#bae6fd',
    gradientEnd: '#0369a1',
    category: 'energy',
  },
  wind: { icon: 'cloud', gradientStart: '#bae6fd', gradientEnd: '#0369a1', category: 'energy' },
  magnetic: {
    icon: 'magnet',
    gradientStart: '#fca5a5',
    gradientEnd: '#dc2626',
    category: 'energy',
  },
  gravity: { icon: 'planet', gradientStart: '#a5b4fc', gradientEnd: '#4338ca', category: 'energy' },
  cosmic: { icon: 'planet', gradientStart: '#a5b4fc', gradientEnd: '#4338ca', category: 'energy' },
  sonic: { icon: 'radio', gradientStart: '#fde68a', gradientEnd: '#d97706', category: 'energy' },
  light: { icon: 'sunny', gradientStart: '#fef08a', gradientEnd: '#ca8a04', category: 'energy' },
  illumin: { icon: 'sunny', gradientStart: '#fef08a', gradientEnd: '#ca8a04', category: 'energy' },

  // Tech
  technopathy: {
    icon: 'hardware-chip',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'tech',
  },
  cyber: {
    icon: 'hardware-chip',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'tech',
  },

  // Mystic / transformation / exotic
  immortal: {
    icon: 'infinite',
    gradientStart: '#a5b4fc',
    gradientEnd: '#3730a3',
    category: 'mystic',
  },
  soul: { icon: 'heart', gradientStart: '#fda4af', gradientEnd: '#be123c', category: 'mystic' },
  shape: { icon: 'refresh', gradientStart: '#99f6e4', gradientEnd: '#0f766e', category: 'mystic' },
  transform: {
    icon: 'refresh',
    gradientStart: '#99f6e4',
    gradientEnd: '#0f766e',
    category: 'mystic',
  },
  intangib: { icon: 'water', gradientStart: '#bae6fd', gradientEnd: '#0369a1', category: 'mystic' },
  teleport: {
    icon: 'swap-horizontal',
    gradientStart: '#c4b5fd',
    gradientEnd: '#7c3aed',
    category: 'mystic',
  },
  invisib: {
    icon: 'eye-off',
    gradientStart: '#cbd5e1',
    gradientEnd: '#475569',
    category: 'mystic',
  },
  time: { icon: 'hourglass', gradientStart: '#a5b4fc', gradientEnd: '#3730a3', category: 'mystic' },
  magic: {
    icon: 'color-wand',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'mystic',
  },
  sorcery: {
    icon: 'color-wand',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'mystic',
  },
  dark: { icon: 'moon', gradientStart: '#cbd5e1', gradientEnd: '#1e293b', category: 'mystic' },
  shadow: { icon: 'moon', gradientStart: '#cbd5e1', gradientEnd: '#334155', category: 'mystic' },

  // Other / misc
  web: { icon: 'git-network', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'other' },
  symbiote: { icon: 'bug', gradientStart: '#cbd5e1', gradientEnd: '#1e293b', category: 'other' },
  plant: { icon: 'leaf', gradientStart: '#bbf7d0', gradientEnd: '#15803d', category: 'other' },
  nature: { icon: 'leaf', gradientStart: '#bbf7d0', gradientEnd: '#15803d', category: 'other' },

  // Skills & training (checked last — only catch what the specific keys above miss)
  intellect: { icon: 'bulb', gradientStart: '#93c5fd', gradientEnd: '#1e40af', category: 'mental' },
  detective: {
    icon: 'search',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'mental',
  },
  martial: {
    icon: 'hand-left',
    gradientStart: '#fca5a5',
    gradientEnd: '#b91c1c',
    category: 'combat',
  },
  combat: {
    icon: 'hand-left',
    gradientStart: '#fca5a5',
    gradientEnd: '#b91c1c',
    category: 'combat',
  },
  marksman: {
    icon: 'locate',
    gradientStart: '#cbd5e1',
    gradientEnd: '#475569',
    category: 'combat',
  },
  weapon: { icon: 'locate', gradientStart: '#cbd5e1', gradientEnd: '#475569', category: 'combat' },
  gun: { icon: 'locate', gradientStart: '#cbd5e1', gradientEnd: '#475569', category: 'combat' },
  tactic: { icon: 'flag', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'combat' },
  strateg: { icon: 'flag', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'combat' },
  leader: { icon: 'flag', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'combat' },
  stealth: {
    icon: 'eye-off',
    gradientStart: '#cbd5e1',
    gradientEnd: '#475569',
    category: 'combat',
  },
  gadget: { icon: 'construct', gradientStart: '#a5b4fc', gradientEnd: '#4338ca', category: 'tech' },
  master: { icon: 'ribbon', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'combat' },
  expert: { icon: 'ribbon', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'combat' },
  trained: { icon: 'ribbon', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'combat' },
};

export const POWER_ICON_FALLBACK: PowerIconDef = {
  icon: 'sparkles',
  gradientStart: '#fed7aa',
  gradientEnd: '#ea580c',
  category: 'other',
};

/**
 * Returns the icon definition for a given ComicVine power name.
 * Case-insensitive substring match. First match wins.
 * Falls back to POWER_ICON_FALLBACK for unmapped powers.
 */
export function getPowerIcon(powerName: string): PowerIconDef {
  const lower = powerName.toLowerCase();
  for (const [key, def] of Object.entries(POWER_ICONS)) {
    if (lower.includes(key)) return def;
  }
  return POWER_ICON_FALLBACK;
}

export interface PowerGroup {
  category: PowerCategory;
  label: string;
  color: string;
  items: { name: string; icon: string }[];
}

/**
 * Bucket a list of power names into categories (shared by native + web).
 * Preserves order within each group, drops empty categories, and orders the
 * groups by POWER_CATEGORY_ORDER for consistency across heroes.
 */
export function groupPowers(powers: string[]): PowerGroup[] {
  const buckets = new Map<PowerCategory, { name: string; icon: string }[]>();
  for (const name of powers) {
    const def = getPowerIcon(name);
    const arr = buckets.get(def.category) ?? [];
    arr.push({ name, icon: def.icon });
    buckets.set(def.category, arr);
  }
  return POWER_CATEGORY_ORDER.filter((c) => buckets.has(c)).map((c) => ({
    category: c,
    label: POWER_CATEGORY_META[c].label,
    color: POWER_CATEGORY_META[c].color,
    items: buckets.get(c)!,
  }));
}
