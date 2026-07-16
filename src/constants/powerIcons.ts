// src/constants/powerIcons.ts

export type PowerCategory =
  'physical' | 'combat' | 'mental' | 'energy' | 'tech' | 'mystic' | 'other';

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
 *
 * Icons are MaterialCommunityIcons glyph names — its 7k set carries the
 * thematic powers (arm-flex, spider-web, sword-cross, lightning-bolt…) that
 * Ionicons could only approximate.
 */
export const POWER_ICONS: Record<string, PowerIconDef> = {
  // Physical
  strength: {
    icon: 'arm-flex',
    gradientStart: '#ff8a8a',
    gradientEnd: '#c0392b',
    category: 'physical',
  },
  flight: {
    icon: 'feather',
    gradientStart: '#a5f3fc',
    gradientEnd: '#0e7490',
    category: 'physical',
  },
  fly: { icon: 'feather', gradientStart: '#a5f3fc', gradientEnd: '#0e7490', category: 'physical' },
  speed: {
    icon: 'run-fast',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'physical',
  },
  agility: { icon: 'run', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'physical' },
  reflexes: {
    icon: 'flash',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'physical',
  },
  stamina: {
    icon: 'weight-lifter',
    gradientStart: '#6ee7b7',
    gradientEnd: '#047857',
    category: 'physical',
  },
  claws: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'physical' },
  beast: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'physical' },
  animal: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'physical' },
  acrobat: { icon: 'yoga', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'physical' },
  underwater: {
    icon: 'swim',
    gradientStart: '#a5f3fc',
    gradientEnd: '#0e7490',
    category: 'physical',
  },
  aquatic: {
    icon: 'swim',
    gradientStart: '#a5f3fc',
    gradientEnd: '#0e7490',
    category: 'physical',
  },

  // Defensive (physical)
  invulner: {
    icon: 'shield-check',
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
    icon: 'medical-bag',
    gradientStart: '#86efac',
    gradientEnd: '#15803d',
    category: 'physical',
  },
  regenerat: {
    icon: 'heart-pulse',
    gradientStart: '#86efac',
    gradientEnd: '#15803d',
    category: 'physical',
  },

  // Sensory (physical)
  'x-ray': {
    icon: 'magnify-scan',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'physical',
  },
  sense: { icon: 'eye', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'physical' },
  sonar: { icon: 'radar', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'physical' },

  // Size (physical)
  size: {
    icon: 'arrow-expand-all',
    gradientStart: '#fde68a',
    gradientEnd: '#b45309',
    category: 'physical',
  },
  giant: {
    icon: 'arrow-expand-all',
    gradientStart: '#fde68a',
    gradientEnd: '#b45309',
    category: 'physical',
  },
  shrink: {
    icon: 'arrow-expand-all',
    gradientStart: '#fde68a',
    gradientEnd: '#b45309',
    category: 'physical',
  },

  // Mental
  telepathy: {
    icon: 'head-sync',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'mental',
  },
  telekinesis: {
    icon: 'auto-fix',
    gradientStart: '#c4b5fd',
    gradientEnd: '#6d28d9',
    category: 'mental',
  },
  'mind control': {
    icon: 'head-cog',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'mental',
  },
  precognit: {
    icon: 'crystal-ball',
    gradientStart: '#c4b5fd',
    gradientEnd: '#6d28d9',
    category: 'mental',
  },
  intelligence: {
    icon: 'brain',
    gradientStart: '#93c5fd',
    gradientEnd: '#1e40af',
    category: 'mental',
  },
  genius: { icon: 'brain', gradientStart: '#93c5fd', gradientEnd: '#1e40af', category: 'mental' },
  empathy: { icon: 'heart', gradientStart: '#fda4af', gradientEnd: '#be123c', category: 'mental' },
  emotion: { icon: 'heart', gradientStart: '#fda4af', gradientEnd: '#be123c', category: 'mental' },

  // Energy
  'force field': {
    icon: 'shield-sun',
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
  energy: { icon: 'atom', gradientStart: '#fde68a', gradientEnd: '#ca8a04', category: 'energy' },
  radiation: {
    icon: 'radioactive',
    gradientStart: '#d9f99d',
    gradientEnd: '#4d7c0f',
    category: 'energy',
  },
  fire: { icon: 'fire', gradientStart: '#fed7aa', gradientEnd: '#ea580c', category: 'energy' },
  ice: { icon: 'snowflake', gradientStart: '#e0f2fe', gradientEnd: '#0284c7', category: 'energy' },
  freeze: {
    icon: 'snowflake',
    gradientStart: '#e0f2fe',
    gradientEnd: '#0284c7',
    category: 'energy',
  },
  cold: { icon: 'snowflake', gradientStart: '#e0f2fe', gradientEnd: '#0284c7', category: 'energy' },
  electric: {
    icon: 'lightning-bolt',
    gradientStart: '#fef08a',
    gradientEnd: '#ca8a04',
    category: 'energy',
  },
  lightning: {
    icon: 'lightning-bolt',
    gradientStart: '#fef08a',
    gradientEnd: '#a16207',
    category: 'energy',
  },
  storm: {
    icon: 'weather-lightning',
    gradientStart: '#bae6fd',
    gradientEnd: '#0369a1',
    category: 'energy',
  },
  weather: {
    icon: 'weather-lightning',
    gradientStart: '#bae6fd',
    gradientEnd: '#0369a1',
    category: 'energy',
  },
  wind: {
    icon: 'weather-windy',
    gradientStart: '#bae6fd',
    gradientEnd: '#0369a1',
    category: 'energy',
  },
  magnetic: {
    icon: 'magnet',
    gradientStart: '#fca5a5',
    gradientEnd: '#dc2626',
    category: 'energy',
  },
  gravity: { icon: 'orbit', gradientStart: '#a5b4fc', gradientEnd: '#4338ca', category: 'energy' },
  cosmic: {
    icon: 'star-four-points',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'energy',
  },
  sonic: {
    icon: 'volume-high',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'energy',
  },
  light: {
    icon: 'white-balance-sunny',
    gradientStart: '#fef08a',
    gradientEnd: '#ca8a04',
    category: 'energy',
  },
  illumin: {
    icon: 'white-balance-sunny',
    gradientStart: '#fef08a',
    gradientEnd: '#ca8a04',
    category: 'energy',
  },

  // Tech
  technopathy: {
    icon: 'chip',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'tech',
  },
  cyber: {
    icon: 'chip',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'tech',
  },

  // Mystic / transformation / exotic
  immortal: {
    icon: 'infinity',
    gradientStart: '#a5b4fc',
    gradientEnd: '#3730a3',
    category: 'mystic',
  },
  soul: { icon: 'ghost', gradientStart: '#fda4af', gradientEnd: '#be123c', category: 'mystic' },
  shape: { icon: 'shimmer', gradientStart: '#99f6e4', gradientEnd: '#0f766e', category: 'mystic' },
  transform: {
    icon: 'shimmer',
    gradientStart: '#99f6e4',
    gradientEnd: '#0f766e',
    category: 'mystic',
  },
  intangib: {
    icon: 'ghost-outline',
    gradientStart: '#bae6fd',
    gradientEnd: '#0369a1',
    category: 'mystic',
  },
  teleport: {
    icon: 'swap-horizontal',
    gradientStart: '#c4b5fd',
    gradientEnd: '#7c3aed',
    category: 'mystic',
  },
  invisib: {
    icon: 'incognito',
    gradientStart: '#cbd5e1',
    gradientEnd: '#475569',
    category: 'mystic',
  },
  time: {
    icon: 'timer-sand',
    gradientStart: '#a5b4fc',
    gradientEnd: '#3730a3',
    category: 'mystic',
  },
  magic: {
    icon: 'magic-staff',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'mystic',
  },
  sorcery: {
    icon: 'magic-staff',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'mystic',
  },
  dark: {
    icon: 'weather-night',
    gradientStart: '#cbd5e1',
    gradientEnd: '#1e293b',
    category: 'mystic',
  },
  shadow: {
    icon: 'weather-night',
    gradientStart: '#cbd5e1',
    gradientEnd: '#334155',
    category: 'mystic',
  },

  // Other / misc
  web: { icon: 'spider-web', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'other' },
  symbiote: { icon: 'bug', gradientStart: '#cbd5e1', gradientEnd: '#1e293b', category: 'other' },
  plant: { icon: 'sprout', gradientStart: '#bbf7d0', gradientEnd: '#15803d', category: 'other' },
  nature: { icon: 'sprout', gradientStart: '#bbf7d0', gradientEnd: '#15803d', category: 'other' },

  // Skills & training (checked last — only catch what the specific keys above miss)
  intellect: {
    icon: 'brain',
    gradientStart: '#93c5fd',
    gradientEnd: '#1e40af',
    category: 'mental',
  },
  detective: {
    icon: 'magnify',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'mental',
  },
  martial: {
    icon: 'karate',
    gradientStart: '#fca5a5',
    gradientEnd: '#b91c1c',
    category: 'combat',
  },
  combat: {
    icon: 'sword-cross',
    gradientStart: '#fca5a5',
    gradientEnd: '#b91c1c',
    category: 'combat',
  },
  marksman: {
    icon: 'crosshairs',
    gradientStart: '#cbd5e1',
    gradientEnd: '#475569',
    category: 'combat',
  },
  weapon: {
    icon: 'crosshairs',
    gradientStart: '#cbd5e1',
    gradientEnd: '#475569',
    category: 'combat',
  },
  gun: { icon: 'crosshairs', gradientStart: '#cbd5e1', gradientEnd: '#475569', category: 'combat' },
  tactic: { icon: 'flag', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'combat' },
  strateg: { icon: 'flag', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'combat' },
  leader: { icon: 'flag', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'combat' },
  stealth: {
    icon: 'eye-off',
    gradientStart: '#cbd5e1',
    gradientEnd: '#475569',
    category: 'combat',
  },
  gadget: { icon: 'tools', gradientStart: '#a5b4fc', gradientEnd: '#4338ca', category: 'tech' },
  master: { icon: 'medal', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'combat' },
  expert: { icon: 'medal', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'combat' },
  trained: { icon: 'medal', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'combat' },

  // ── Extended map ──────────────────────────────────────────────────────────
  // Appended last so the specific keys above always win. Keyed on distinctive
  // substrings (e.g. `vampir`, never `bat` — "bat" hides in "com*bat*").

  // Physical — senses, body, mobility
  sword: { icon: 'sword', gradientStart: '#cbd5e1', gradientEnd: '#475569', category: 'combat' },
  hearing: {
    icon: 'ear-hearing',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'physical',
  },
  smell: { icon: 'scent', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'physical' },
  sight: { icon: 'eye', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'physical' },
  feral: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'physical' },
  cling: { icon: 'spider', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'physical' },
  mariner: {
    icon: 'anchor',
    gradientStart: '#a5f3fc',
    gradientEnd: '#0e7490',
    category: 'physical',
  },
  levitat: {
    icon: 'arrow-up-bold',
    gradientStart: '#a5f3fc',
    gradientEnd: '#0e7490',
    category: 'physical',
  },
  elastic: {
    icon: 'arrow-expand-horizontal',
    gradientStart: '#fde68a',
    gradientEnd: '#b45309',
    category: 'physical',
  },
  density: {
    icon: 'weight',
    gradientStart: '#6ee7b7',
    gradientEnd: '#047857',
    category: 'physical',
  },
  bone: { icon: 'bone', gradientStart: '#e5e7eb', gradientEnd: '#6b7280', category: 'physical' },
  adaptive: { icon: 'dna', gradientStart: '#6ee7b7', gradientEnd: '#047857', category: 'physical' },
  mutation: { icon: 'dna', gradientStart: '#6ee7b7', gradientEnd: '#047857', category: 'physical' },
  genetic: { icon: 'dna', gradientStart: '#6ee7b7', gradientEnd: '#047857', category: 'physical' },

  // Combat & skill
  track: {
    icon: 'map-marker-path',
    gradientStart: '#93c5fd',
    gradientEnd: '#1d4ed8',
    category: 'combat',
  },
  escape: {
    icon: 'lock-open-variant',
    gradientStart: '#cbd5e1',
    gradientEnd: '#475569',
    category: 'combat',
  },

  // Mental & psychic
  astral: {
    icon: 'meditation',
    gradientStart: '#c4b5fd',
    gradientEnd: '#6d28d9',
    category: 'mental',
  },
  psychic: { icon: 'brain', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'mental' },
  psionic: { icon: 'brain', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8', category: 'mental' },
  psychometr: {
    icon: 'history',
    gradientStart: '#c4b5fd',
    gradientEnd: '#6d28d9',
    category: 'mental',
  },
  postcognit: {
    icon: 'history',
    gradientStart: '#c4b5fd',
    gradientEnd: '#6d28d9',
    category: 'mental',
  },
  lingual: {
    icon: 'translate',
    gradientStart: '#93c5fd',
    gradientEnd: '#1e40af',
    category: 'mental',
  },
  hypnos: {
    icon: 'eye-circle-outline',
    gradientStart: '#c4b5fd',
    gradientEnd: '#6d28d9',
    category: 'mental',
  },
  mesmer: {
    icon: 'eye-circle-outline',
    gradientStart: '#c4b5fd',
    gradientEnd: '#6d28d9',
    category: 'mental',
  },

  // Energy & elemental
  blast: { icon: 'flare', gradientStart: '#fde68a', gradientEnd: '#ca8a04', category: 'energy' },
  heat: { icon: 'fire', gradientStart: '#fed7aa', gradientEnd: '#ea580c', category: 'energy' },
  flame: { icon: 'fire', gradientStart: '#fed7aa', gradientEnd: '#ea580c', category: 'energy' },
  water: { icon: 'water', gradientStart: '#bae6fd', gradientEnd: '#0369a1', category: 'energy' },
  earth: { icon: 'terrain', gradientStart: '#d1a97f', gradientEnd: '#78350f', category: 'energy' },
  sand: { icon: 'beach', gradientStart: '#fde68a', gradientEnd: '#b45309', category: 'energy' },
  vibrat: {
    icon: 'sine-wave',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'energy',
  },
  construct: {
    icon: 'cube-outline',
    gradientStart: '#6ee7b7',
    gradientEnd: '#065f46',
    category: 'energy',
  },
  absor: {
    icon: 'tray-arrow-down',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'energy',
  },
  magnet: { icon: 'magnet', gradientStart: '#fca5a5', gradientEnd: '#dc2626', category: 'energy' },

  // Tech
  chemical: { icon: 'flask', gradientStart: '#a5b4fc', gradientEnd: '#4338ca', category: 'tech' },
  suit: { icon: 'robot', gradientStart: '#a5b4fc', gradientEnd: '#4338ca', category: 'tech' },
  implant: { icon: 'chip', gradientStart: '#a5b4fc', gradientEnd: '#4338ca', category: 'tech' },
  hologra: {
    icon: 'cube-scan',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'tech',
  },
  electronic: {
    icon: 'power-plug',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'tech',
  },

  // Mystic & exotic
  illusion: {
    icon: 'drama-masks',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'mystic',
  },
  necro: { icon: 'skull', gradientStart: '#cbd5e1', gradientEnd: '#1e293b', category: 'mystic' },
  death: { icon: 'skull', gradientStart: '#cbd5e1', gradientEnd: '#1e293b', category: 'mystic' },
  vampir: { icon: 'bat', gradientStart: '#cbd5e1', gradientEnd: '#1e293b', category: 'mystic' },
  duplicat: {
    icon: 'content-duplicate',
    gradientStart: '#99f6e4',
    gradientEnd: '#0f766e',
    category: 'mystic',
  },
  mimic: {
    icon: 'content-copy',
    gradientStart: '#99f6e4',
    gradientEnd: '#0f766e',
    category: 'mystic',
  },
  chameleon: {
    icon: 'palette',
    gradientStart: '#99f6e4',
    gradientEnd: '#0f766e',
    category: 'mystic',
  },
  phas: {
    icon: 'ghost-outline',
    gradientStart: '#bae6fd',
    gradientEnd: '#0369a1',
    category: 'mystic',
  },
  possess: { icon: 'ghost', gradientStart: '#cbd5e1', gradientEnd: '#1e293b', category: 'mystic' },
  probab: {
    icon: 'dice-multiple',
    gradientStart: '#a5b4fc',
    gradientEnd: '#3730a3',
    category: 'mystic',
  },
  reality: {
    icon: 'cube-outline',
    gradientStart: '#a5b4fc',
    gradientEnd: '#3730a3',
    category: 'mystic',
  },
  dimension: {
    icon: 'cube-outline',
    gradientStart: '#a5b4fc',
    gradientEnd: '#3730a3',
    category: 'mystic',
  },
  divine: {
    icon: 'star-shooting',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'mystic',
  },
  animat: {
    icon: 'creation',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'mystic',
  },
  longevity: {
    icon: 'clock-outline',
    gradientStart: '#a5b4fc',
    gradientEnd: '#3730a3',
    category: 'mystic',
  },

  // Other / misc
  siphon: {
    icon: 'water-pump',
    gradientStart: '#a5b4fc',
    gradientEnd: '#4338ca',
    category: 'mystic',
  },
  item: {
    icon: 'diamond-stone',
    gradientStart: '#fde68a',
    gradientEnd: '#d97706',
    category: 'mystic',
  },
  rich: {
    icon: 'cash-multiple',
    gradientStart: '#bbf7d0',
    gradientEnd: '#15803d',
    category: 'other',
  },
  eating: {
    icon: 'food-drumstick',
    gradientStart: '#fed7aa',
    gradientEnd: '#ea580c',
    category: 'other',
  },
  blood: { icon: 'blood-bag', gradientStart: '#fca5a5', gradientEnd: '#b91c1c', category: 'other' },
  pheromone: {
    icon: 'flower',
    gradientStart: '#fbcfe8',
    gradientEnd: '#be185d',
    category: 'other',
  },
};

export const POWER_ICON_FALLBACK: PowerIconDef = {
  icon: 'star-four-points',
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
