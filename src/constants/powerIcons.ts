// src/constants/powerIcons.ts

export interface PowerIconDef {
  icon: string;
  gradientStart: string;
  gradientEnd: string;
}

/**
 * Substring-keyed map of power name fragments → icon + gradient.
 * Keys are lowercase. Matching is case-insensitive substring.
 * Order matters — more specific keys should come before broader ones.
 */
export const POWER_ICONS: Record<string, PowerIconDef> = {
  // Physical
  strength: { icon: 'barbell', gradientStart: '#ff8a8a', gradientEnd: '#c0392b' },
  flight: { icon: 'airplane', gradientStart: '#a5f3fc', gradientEnd: '#0e7490' },
  fly: { icon: 'airplane', gradientStart: '#a5f3fc', gradientEnd: '#0e7490' },
  speed: { icon: 'flash', gradientStart: '#fde68a', gradientEnd: '#d97706' },
  agility: { icon: 'walk', gradientStart: '#fde68a', gradientEnd: '#b45309' },
  reflexes: { icon: 'flash', gradientStart: '#fde68a', gradientEnd: '#d97706' },
  stamina: { icon: 'fitness', gradientStart: '#6ee7b7', gradientEnd: '#047857' },
  claws: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f' },
  beast: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f' },
  animal: { icon: 'paw', gradientStart: '#d1a97f', gradientEnd: '#78350f' },

  // Defensive
  invulner: { icon: 'shield-checkmark', gradientStart: '#6ee7b7', gradientEnd: '#047857' },
  durability: { icon: 'shield', gradientStart: '#6ee7b7', gradientEnd: '#047857' },
  'force field': { icon: 'shield', gradientStart: '#6ee7b7', gradientEnd: '#065f46' },
  healing: { icon: 'medkit', gradientStart: '#86efac', gradientEnd: '#15803d' },
  regenerat: { icon: 'medkit', gradientStart: '#86efac', gradientEnd: '#15803d' },
  immortal: { icon: 'infinite', gradientStart: '#a5b4fc', gradientEnd: '#3730a3' },

  // Mental
  telepathy: { icon: 'pulse', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },
  telekinesis: { icon: 'planet', gradientStart: '#c4b5fd', gradientEnd: '#6d28d9' },
  'mind control': { icon: 'pulse', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },
  precognit: { icon: 'eye', gradientStart: '#c4b5fd', gradientEnd: '#6d28d9' },
  intelligence: { icon: 'library', gradientStart: '#93c5fd', gradientEnd: '#1e40af' },
  genius: { icon: 'library', gradientStart: '#93c5fd', gradientEnd: '#1e40af' },
  empathy: { icon: 'heart', gradientStart: '#fda4af', gradientEnd: '#be123c' },
  emotion: { icon: 'heart', gradientStart: '#fda4af', gradientEnd: '#be123c' },
  soul: { icon: 'heart', gradientStart: '#fda4af', gradientEnd: '#be123c' },

  // Energy
  'heat vision': { icon: 'eye', gradientStart: '#fed7aa', gradientEnd: '#c2410c' },
  laser: { icon: 'eye', gradientStart: '#fed7aa', gradientEnd: '#c2410c' },
  energy: { icon: 'nuclear', gradientStart: '#fde68a', gradientEnd: '#ca8a04' },
  radiation: { icon: 'nuclear', gradientStart: '#d9f99d', gradientEnd: '#4d7c0f' },
  fire: { icon: 'flame', gradientStart: '#fed7aa', gradientEnd: '#ea580c' },
  ice: { icon: 'snow', gradientStart: '#e0f2fe', gradientEnd: '#0284c7' },
  freeze: { icon: 'snow', gradientStart: '#e0f2fe', gradientEnd: '#0284c7' },
  cold: { icon: 'snow', gradientStart: '#e0f2fe', gradientEnd: '#0284c7' },
  electric: { icon: 'flash', gradientStart: '#fef08a', gradientEnd: '#ca8a04' },
  lightning: { icon: 'thunderstorm', gradientStart: '#fef08a', gradientEnd: '#a16207' },
  storm: { icon: 'thunderstorm', gradientStart: '#bae6fd', gradientEnd: '#0369a1' },
  weather: { icon: 'thunderstorm', gradientStart: '#bae6fd', gradientEnd: '#0369a1' },
  wind: { icon: 'wind', gradientStart: '#bae6fd', gradientEnd: '#0369a1' },
  magnetic: { icon: 'magnet', gradientStart: '#fca5a5', gradientEnd: '#dc2626' },
  gravity: { icon: 'planet', gradientStart: '#a5b4fc', gradientEnd: '#4338ca' },
  cosmic: { icon: 'planet', gradientStart: '#a5b4fc', gradientEnd: '#4338ca' },
  sonic: { icon: 'radio', gradientStart: '#fde68a', gradientEnd: '#d97706' },

  // Transformation
  shape: { icon: 'refresh', gradientStart: '#99f6e4', gradientEnd: '#0f766e' },
  transform: { icon: 'refresh', gradientStart: '#99f6e4', gradientEnd: '#0f766e' },
  size: { icon: 'resize', gradientStart: '#fde68a', gradientEnd: '#b45309' },
  giant: { icon: 'resize', gradientStart: '#fde68a', gradientEnd: '#b45309' },
  shrink: { icon: 'resize', gradientStart: '#fde68a', gradientEnd: '#b45309' },
  intangib: { icon: 'water', gradientStart: '#bae6fd', gradientEnd: '#0369a1' },

  // Sensory
  'x-ray': { icon: 'scan', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },
  sense: { icon: 'scan', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },
  sonar: { icon: 'radio', gradientStart: '#93c5fd', gradientEnd: '#1d4ed8' },

  // Mobility
  teleport: { icon: 'swap-horizontal', gradientStart: '#c4b5fd', gradientEnd: '#7c3aed' },
  invisib: { icon: 'eye-off', gradientStart: '#cbd5e1', gradientEnd: '#475569' },
  stealth: { icon: 'eye-off', gradientStart: '#cbd5e1', gradientEnd: '#475569' },
  underwater: { icon: 'water', gradientStart: '#a5f3fc', gradientEnd: '#0e7490' },
  aquatic: { icon: 'water', gradientStart: '#a5f3fc', gradientEnd: '#0e7490' },

  // Misc
  time: { icon: 'hourglass', gradientStart: '#a5b4fc', gradientEnd: '#3730a3' },
  magic: { icon: 'color-wand', gradientStart: '#fde68a', gradientEnd: '#d97706' },
  sorcery: { icon: 'color-wand', gradientStart: '#fde68a', gradientEnd: '#d97706' },
  web: { icon: 'git-network', gradientStart: '#d1a97f', gradientEnd: '#78350f' },
  symbiote: { icon: 'bug', gradientStart: '#cbd5e1', gradientEnd: '#1e293b' },
  technopathy: { icon: 'hardware-chip', gradientStart: '#a5b4fc', gradientEnd: '#4338ca' },
  cyber: { icon: 'hardware-chip', gradientStart: '#a5b4fc', gradientEnd: '#4338ca' },
  plant: { icon: 'leaf', gradientStart: '#bbf7d0', gradientEnd: '#15803d' },
  nature: { icon: 'leaf', gradientStart: '#bbf7d0', gradientEnd: '#15803d' },
  dark: { icon: 'moon', gradientStart: '#cbd5e1', gradientEnd: '#1e293b' },
  shadow: { icon: 'moon', gradientStart: '#cbd5e1', gradientEnd: '#334155' },
  light: { icon: 'sunny', gradientStart: '#fef08a', gradientEnd: '#ca8a04' },
  illumin: { icon: 'sunny', gradientStart: '#fef08a', gradientEnd: '#ca8a04' },
};

export const POWER_ICON_FALLBACK: PowerIconDef = {
  icon: 'star',
  gradientStart: '#fed7aa',
  gradientEnd: '#ea580c',
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
