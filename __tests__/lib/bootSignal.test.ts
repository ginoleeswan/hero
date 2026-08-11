import {
  dailyRecordKey,
  emberForDate,
  signalFrom,
  todayKey,
  BOOT_SIGNAL_FALLBACK,
  EMBER_LAMPS,
} from '../../src/lib/bootSignal';

describe('boot signal', () => {
  it('uses the app-wide UTC date convention', () => {
    // Everything else keyed by day (dailySeed, streaks, matchup votes) uses
    // toISOString().slice(0, 10). If this drifts the boot lights up for a
    // different day than the game it is advertising.
    expect(todayKey(new Date('2026-08-11T23:59:59.000Z'))).toBe('2026-08-11');
    expect(todayKey(new Date('2026-08-12T00:00:00.000Z'))).toBe('2026-08-12');
    // Late-evening local time west of UTC still reads as the next UTC day —
    // deliberate, because the daily itself rolls over on the same clock.
    expect(todayKey(new Date('2026-08-11T22:30:00-05:00'))).toBe('2026-08-12');
  });

  it('reads the key useDailyHero actually writes', () => {
    expect(dailyRecordKey('2026-08-11')).toBe('dh_v3_2026-08-11');
  });

  describe('the day’s lamp', () => {
    it('is the same everywhere for the same day, and needs nothing to compute', () => {
      expect(emberForDate('2026-08-11')).toBe(emberForDate('2026-08-11'));
      expect(EMBER_LAMPS).toContain(emberForDate('2026-08-11'));
    });

    it('does not settle into a weekday pattern', () => {
      // A seven-lamp cycle indexed by date lands on the same colour every
      // Tuesday, which makes the ritual a calendar rather than a surprise.
      // Walk five weeks of Tuesdays and require more than one colour.
      const tuesdays = ['2026-08-11', '2026-08-18', '2026-08-25', '2026-09-01', '2026-09-08'];
      expect(new Set(tuesdays.map(emberForDate)).size).toBeGreaterThan(1);
    });

    it('uses every lamp over a month', () => {
      const seen = new Set<string>();
      for (let d = 1; d <= 31; d++) {
        seen.add(emberForDate(`2026-08-${String(d).padStart(2, '0')}`));
      }
      expect(seen.size).toBe(EMBER_LAMPS.length);
    });

    it('falls back to the brand ember rather than undefined on a bad key', () => {
      expect(emberForDate('not-a-date')).toBe(EMBER_LAMPS[0]);
    });
  });

  describe('whether the day is still waiting', () => {
    const D = '2026-08-11';

    it('waits when the day has not been started', () => {
      expect(signalFrom(null, D).awaiting) /* nothing stored yet */
        .toBe(true);
    });

    it('still waits when the day was started but not finished', () => {
      // Coming back mid-play is exactly when a nudge is worth something.
      expect(signalFrom(JSON.stringify({ guesses: [{}], status: 'playing' }), D).awaiting).toBe(
        true,
      );
    });

    it('goes quiet once the day is spent — won or lost', () => {
      expect(signalFrom(JSON.stringify({ status: 'won' }), D).awaiting).toBe(false);
      // Losing counts. A screen that kept nagging about a game you already lost
      // would be a scold rather than an invitation.
      expect(signalFrom(JSON.stringify({ status: 'lost' }), D).awaiting).toBe(false);
    });

    it('fails quiet, not loud', () => {
      // This decides how bright a glow is. Garbage in must not light the screen.
      expect(signalFrom('{{{', D).awaiting).toBe(false);
      expect(signalFrom('', D).awaiting).toBe(false);
      expect(BOOT_SIGNAL_FALLBACK.awaiting).toBe(false);
    });

    it('carries the day’s lamp whatever the state', () => {
      const lamp = emberForDate(D);
      for (const raw of [null, '{{{', JSON.stringify({ status: 'won' })]) {
        expect(signalFrom(raw, D).ember).toBe(lamp);
      }
    });
  });
});
