// Single source of truth for social-content IP risk. A hero's TIER (S/A/B/C)
// governs what it may depict in a PAID AD. Organic posting is never restricted.
// Design: docs/superpowers/specs/2026-07-06-social-ad-safety-split-design.md
import { famousPool } from './lib.mjs';

// Risk order, most → least restricted. Higher number = riskier to depict.
export const TIER_RISK = { S: 3, A: 2, B: 1, C: 0 };

// Publisher → tier. Refined over time via audit-safety.mjs's untiered report.
export const PUBLISHER_TIER = {
  // S — do not depict in ads (majors + fiercely-policed licensed brands)
  Marvel: 'S', Disney: 'S', 'Star Wars': 'S', Pokémon: 'S', Nintendo: 'S',
  Shueisha: 'S', Kodansha: 'S', 'The Muppets': 'S', 'Sesame Street': 'S',
  'Looney Tunes': 'S', 'Hanna-Barbera': 'S', Bongo: 'S', 'Star Trek': 'S',
  'The Terminator': 'S', Conan: 'S', 'Teenage Mutant Ninja Turtles': 'S',
  Hasbro: 'S', Mattel: 'S',
  // A — stylized only (DC + other US comics + major game studios)
  'DC Comics': 'A', Image: 'A', 'Archie Comics': 'A', 'Top Cow Productions': 'A',
  Rebellion: 'A', 'Harvey Comics': 'A', Hellboy: 'A', Capcom: 'A',
  'Square Enix': 'A', Sega: 'A', 'NetherRealm Studios': 'A', Konami: 'A',
  'CD Projekt Red': 'A', 'PlayStation Studios': 'A', 'Xbox Game Studios': 'A',
  Atlus: 'A', Dupuis: 'A', 'NBC Studios': 'A', 'The Boys': 'A',
  // B — restrained
  'Company-Licensed': 'B',
  // C — safe to depict full-fidelity
  'In the Public Domain': 'C', 'Non-Fictional': 'C',
};

// Per-character exceptions by hero id. Populated as exceptions are found.
export const OVERRIDES = {
  ov1: 'C', // test fixture only — remove/replace with real ids as needed
};

// Conservative default: anything untiered is treated as restricted, never safe.
export const DEFAULT_TIER = 'A';

export function tierOf(hero) {
  if (hero && hero.id && Object.prototype.hasOwnProperty.call(OVERRIDES, hero.id)) {
    return OVERRIDES[hero.id];
  }
  const p = hero && hero.publisher;
  if (p && Object.prototype.hasOwnProperty.call(PUBLISHER_TIER, p)) return PUBLISHER_TIER[p];
  return DEFAULT_TIER;
}

// What a hero may show in a PAID AD (organic is unrestricted, handled elsewhere).
export function adImagery(hero) {
  switch (tierOf(hero)) {
    case 'S': return 'none';
    case 'A': return 'stylized';
    case 'B': return 'small-raw';
    case 'C': return 'full';
    default: return 'none';
  }
}

// True if `tier` is no riskier than `maxTier` (e.g. maxTier 'B' admits B and C).
export function tierAllowed(tier, maxTier) {
  return TIER_RISK[tier] <= TIER_RISK[maxTier];
}

export const DISCLAIMER = 'Unofficial fan encyclopedia. Characters © their respective owners.';

// Pure: filter a hero array to those allowed at maxTier and at/above minFame.
export function filterPool(rows, { maxTier = 'C', minFame = 0 } = {}) {
  return rows.filter(
    (h) => (h.fame_score ?? 0) >= minFame && tierAllowed(tierOf(h), maxTier),
  );
}

// I/O: the top-famous pool, filtered to what an ad may select. Draws from
// lib's famousPool (top-160 by fame_score, includes publisher).
export async function safePool(sb, opts = {}) {
  return filterPool(await famousPool(sb), opts);
}
