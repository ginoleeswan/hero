// Single source of truth for social-content IP risk. A hero's TIER (S/A/B/C)
// governs what it may depict in a PAID AD. Organic posting is never restricted.
// Design: docs/superpowers/specs/2026-07-06-social-ad-safety-split-design.md
import { famousPool, imgDataUri } from './lib.mjs';

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
  // S — film / TV / literary franchises owned by aggressive media conglomerates
  'J. K. Rowling': 'S', 'Indiana Jones': 'S', RoboCop: 'S', 'Friday the 13th': 'S',
  'A Nightmare on Elm Street': 'S', Hellraiser: 'S', Halloween: 'S', "Child's Play": 'S',
  Alien: 'S', Predator: 'S', 'Buffy the Vampire Slayer': 'S', 'Ben 10': 'S',
  'Mission: Impossible': 'S', 'Babylon 5': 'S', 'Avatar: The Last Airbender': 'S',
  'The Green Hornet': 'S', 'Game of Thrones': 'S', 'The Lord of the Rings': 'S',
  'The Chronicles of Narnia': 'S', 'Jurassic Park': 'S', 'Woody Woodpecker': 'S',
  'Alvin and the Chipmunks': 'S', 'South Park': 'S', 'Captain Planet': 'S',
  Darkman: 'S', Rocky: 'S', 'Rocky & Bullwinkle': 'S', 'The Bionic Woman': 'S',
  ALF: 'S', 'Death Race': 'S', 'Spy Kids': 'S', 'The Lego Group': 'S',
  'Kool-Aid': 'S', 'NBC - Heroes': 'S', 'Sony Pictures': 'S',
  // S — manga / anime publishers (consistent with Shueisha/Kodansha)
  Gatchaman: 'S', Hakusensha: 'S', 'Kadokawa Shoten': 'S', Shogakukan: 'S',
  'ASCII Media Works': 'S',
  // A — stylized only (DC + other US comics + major game studios)
  'DC Comics': 'A', Image: 'A', 'Archie Comics': 'A', 'Top Cow Productions': 'A',
  Rebellion: 'A', 'Harvey Comics': 'A', Hellboy: 'A', Capcom: 'A',
  'Square Enix': 'A', Sega: 'A', 'NetherRealm Studios': 'A', Konami: 'A',
  'CD Projekt Red': 'A', 'PlayStation Studios': 'A', 'Xbox Game Studios': 'A',
  Atlus: 'A', Dupuis: 'A', 'NBC Studios': 'A', 'The Boys': 'A',
  // A — more AAA game studios
  Bethesda: 'A', 'Blizzard Entertainment': 'A', 'Electronic Arts': 'A',
  'Ubisoft Entertainment': 'A', 'Insomniac Games': 'A', SNK: 'A', Namco: 'A',
  Tecmo: 'A', 'Digital Extremes': 'A', 'Radical Entertainment': 'A', 'Sony Publishing': 'A',
  // A — more comic publishers (creator/company IP)
  'Dark Horse Comics': 'A', 'Dynamite Entertainment': 'A', 'Valiant/Acclaim': 'A',
  Malibu: 'A', 'Boom! Studios': 'A', 'Zenescope Entertainment': 'A', 'Oni Press': 'A',
  'Aspen MLT': 'A', 'Avatar Press': 'A', 'Vault Comics': 'A', 'Chaos! Comics': 'A',
  Charlton: 'A', EC: 'A', Crossgen: 'A', 'Fawcett Publications': 'A', 'Quality Comics': 'A',
  'Sin City': 'A', Preacher: 'A', 'Kick-Ass': 'A', 'Tank Girl': 'A',
  Dargaud: 'A', 'Le Lombard': 'A', 'Sergio Bonelli Editore': 'A',
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

// Pure: which hero image fields may be used, and whether to stylize, per context.
// AD CONTEXT NEVER INCLUDES image_url/image_md_url — only the Mythique render.
export function portraitPlan(hero, context) {
  if (context === 'organic') {
    return { fields: ['portrait_url', 'image_url', 'image_md_url'], stylize: false };
  }
  switch (adImagery(hero)) {
    case 'stylized': return { fields: ['portrait_url'], stylize: true };
    case 'small-raw':
    case 'full': return { fields: ['portrait_url'], stylize: false };
    case 'none':
    default: return { fields: [], stylize: false };
  }
}

// I/O: resolve the first available allowed field to a data-URI. null = show no face.
export async function safePortrait(hero, { context }) {
  const plan = portraitPlan(hero, context);
  for (const f of plan.fields) {
    if (hero[f]) {
      const uri = await imgDataUri(hero[f]);
      if (uri) return { uri, stylize: plan.stylize };
    }
  }
  return null;
}
