// House creatives for the sponsor slot (monetization playbook — see
// docs/superpowers/specs/2026-07-16-monetization-options.md §C). Until a real
// sponsor exists, the slot promotes Mythique's own surfaces, which buys the
// infrastructure, the placement discipline, and CTR data for free.
//
// The rotation is DETERMINISTIC by UTC day (same convention as the dailies —
// everyone sees the same creative on the same day, and SSR/client can't
// disagree the way Math.random would). Pure + unit-tested.

export interface HousePromo {
  id: string;
  /** Slot eyebrow. House content is honestly labeled — never "SPONSOR". */
  eyebrow: 'From Mythique';
  title: string;
  sub: string;
  cta: string;
  /** Ionicons glyph. */
  icon: string;
  /** Internal route, or 'kofi' for the external support link. */
  target: string;
}

export const HOUSE_PROMOS: HousePromo[] = [
  {
    id: 'kofi',
    eyebrow: 'From Mythique',
    title: 'Keep Mythique free',
    sub: 'No ads, no paywall — powered by readers like you.',
    cta: 'Buy a coffee',
    icon: 'heart',
    target: 'kofi',
  },
  {
    id: 'daily-game',
    eyebrow: 'From Mythique',
    title: 'Today’s daily is live',
    sub: 'Guess the mystery character in four tries.',
    cta: 'Play now',
    icon: 'help-circle',
    target: '/play',
  },
  {
    id: 'arena',
    eyebrow: 'From Mythique',
    title: 'Settle today’s debate',
    sub: 'Two icons enter. The crowd decides.',
    cta: 'Cast your vote',
    icon: 'flash',
    target: '/versus',
  },
];

/** UTC day index (days since epoch) — the rotation clock. */
export function utcDayIndex(d: Date = new Date()): number {
  return Math.floor(d.getTime() / 86_400_000);
}

/** The one house creative for a given day. Deterministic; same for everyone. */
export function promoForDay(d: Date = new Date()): HousePromo {
  return HOUSE_PROMOS[utcDayIndex(d) % HOUSE_PROMOS.length];
}
