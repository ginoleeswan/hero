import { HOUSE_PROMOS, promoForDay, utcDayIndex } from '../../../src/lib/sponsor/houseAds';

describe('house promo rotation', () => {
  it('is deterministic for a given UTC day', () => {
    const d = new Date('2026-07-16T10:00:00Z');
    expect(promoForDay(d)).toBe(promoForDay(new Date('2026-07-16T23:59:59Z')));
  });

  it('rotates to a different creative the next UTC day', () => {
    const today = promoForDay(new Date('2026-07-16T12:00:00Z'));
    const tomorrow = promoForDay(new Date('2026-07-17T12:00:00Z'));
    expect(tomorrow).not.toBe(today);
  });

  it('cycles through every creative across consecutive days', () => {
    const seen = new Set(
      Array.from({ length: HOUSE_PROMOS.length }, (_, i) =>
        promoForDay(new Date(Date.UTC(2026, 6, 16 + i))),
      ),
    );
    expect(seen.size).toBe(HOUSE_PROMOS.length);
  });

  it('uses the UTC calendar (same convention as the dailies)', () => {
    // 23:30 UTC and 00:30 UTC next day are different rotation days regardless
    // of any local timezone.
    expect(utcDayIndex(new Date('2026-07-16T23:30:00Z'))).toBe(
      utcDayIndex(new Date('2026-07-16T00:30:00Z')),
    );
    expect(utcDayIndex(new Date('2026-07-17T00:30:00Z'))).toBe(
      utcDayIndex(new Date('2026-07-16T23:30:00Z')) + 1,
    );
  });

  it('house creatives are honestly labeled — never "Sponsor"', () => {
    for (const p of HOUSE_PROMOS) expect(p.eyebrow).toBe('From Mythique');
  });
});
