import {
  computeFreshness,
  newestStamp,
  parseStamp,
  PULSE_WITHIN_HOURS,
  STALE_AFTER_HOURS,
} from '../../../src/lib/home/freshness';

const NOW = Date.parse('2026-07-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('parseStamp', () => {
  it('parses a full ISO timestamp', () => {
    expect(parseStamp('2026-07-26T09:00:00.000Z')).toBe(Date.parse('2026-07-26T09:00:00Z'));
  });

  it('parses a bare date as UTC midnight', () => {
    expect(parseStamp('2026-07-22')).toBe(Date.parse('2026-07-22T00:00:00Z'));
  });

  it('returns null for anything unparseable rather than NaN', () => {
    for (const bad of [null, undefined, '', '   ', 'soon', 'not-a-date']) {
      expect(parseStamp(bad)).toBeNull();
    }
  });
});

describe('newestStamp', () => {
  it('takes the newest across every source', () => {
    expect(
      newestStamp({ publishedAt: [hoursAgo(30), hoursAgo(3)], storeDates: ['2026-07-22'] }),
    ).toBe(Date.parse(hoursAgo(3)));
  });

  it('ignores nulls and junk mixed into the lists', () => {
    expect(newestStamp({ publishedAt: [null, 'junk', hoursAgo(5), undefined] })).toBe(
      Date.parse(hoursAgo(5)),
    );
  });

  it('returns null when nothing parses', () => {
    expect(newestStamp({ publishedAt: [null], storeDates: ['nope'] })).toBeNull();
    expect(newestStamp({})).toBeNull();
  });
});

describe('computeFreshness — the label', () => {
  const at = (h: number) => computeFreshness({ publishedAt: [hoursAgo(h)], now: NOW });

  it('says JUST NOW inside the hour', () => {
    expect(at(0.4).label).toBe('JUST NOW');
  });

  it('counts hours through the first day', () => {
    expect(at(3).label).toBe('3H AGO');
    expect(at(23).label).toBe('23H AGO');
  });

  it('says YESTERDAY on the second day', () => {
    expect(at(30).label).toBe('YESTERDAY');
  });

  it('counts days after that', () => {
    expect(at(72).label).toBe('3D AGO');
    // The state the band is actually in today: comics land weekly.
    expect(computeFreshness({ storeDates: ['2026-07-22'], now: NOW }).label).toBe('4D AGO');
  });
});

describe('computeFreshness — honest degradation', () => {
  it('makes NO claim once the band is stale', () => {
    const d = computeFreshness({ publishedAt: [hoursAgo(STALE_AFTER_HOURS + 1)], now: NOW });
    expect(d.label).toBeNull();
    expect(d.pulse).toBe(false);
    // The age is still reported — the caller may want it even when the label is
    // suppressed. Only the user-facing claim goes away.
    expect(d.ageHours).toBeGreaterThan(STALE_AFTER_HOURS);
  });

  it('makes no claim when nothing is dated at all', () => {
    expect(computeFreshness({ now: NOW })).toEqual({
      label: null,
      ageHours: null,
      pulse: false,
    });
  });

  it('stops the pulse before it stops the label', () => {
    // The window between "worth stating" and "worth animating" is deliberate: a
    // 4-day-old band should say so quietly, not throb.
    const quiet = computeFreshness({ publishedAt: [hoursAgo(96)], now: NOW });
    expect(quiet.label).toBe('4D AGO');
    expect(quiet.pulse).toBe(false);

    const live = computeFreshness({ publishedAt: [hoursAgo(PULSE_WITHIN_HOURS - 1)], now: NOW });
    expect(live.pulse).toBe(true);
  });

  it('treats a future timestamp as zero age, not negative', () => {
    const d = computeFreshness({ publishedAt: [hoursAgo(-50)], now: NOW });
    expect(d.ageHours).toBe(0);
    expect(d.label).toBe('JUST NOW');
  });
});

describe('computeFreshness — a running event outranks timestamps', () => {
  it('names the event when one is live', () => {
    const d = computeFreshness({
      publishedAt: [hoursAgo(6)],
      liveEventOngoing: true,
      liveEventLabel: 'San Diego Comic-Con',
      now: NOW,
    });
    expect(d.label).toBe('SAN DIEGO COMIC-CON · LIVE');
    expect(d.pulse).toBe(true);
    expect(d.ageHours).toBe(0);
  });

  it('falls back to a generic live label without a name', () => {
    expect(computeFreshness({ liveEventOngoing: true, now: NOW }).label).toBe('LIVE NOW');
    expect(computeFreshness({ liveEventOngoing: true, liveEventLabel: '  ', now: NOW }).label).toBe(
      'LIVE NOW',
    );
  });

  it('goes live even when every other source is stale', () => {
    const d = computeFreshness({
      storeDates: ['2025-01-01'],
      liveEventOngoing: true,
      now: NOW,
    });
    expect(d.label).toBe('LIVE NOW');
    expect(d.pulse).toBe(true);
  });
});
