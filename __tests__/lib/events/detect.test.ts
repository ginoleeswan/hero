import {
  detectEvent,
  median,
  EDITS_ABS_MIN,
  SPIKE_MIN,
  type DailyViews,
} from '../../../src/lib/events/detect';

// ── fixtures: real Wikimedia measurements ────────────────────────────────────
// Captured on 2026-07-26, while San Diego Comic-Con 2026 was actually running.
// The value of these is that the true positive (SDCC) and the true negative
// (NYCC, dormant) were measured over the SAME 28 days — so the thresholds are
// checked against real discrimination rather than a synthetic curve.

const MS_PER_DAY = 86_400_000;

/** 28 consecutive days of pageviews from `start`, one entry per value. */
const daily = (start: string, views: number[]): DailyViews[] =>
  views.map((v, i) => ({
    date: new Date(Date.parse(`${start}T00:00:00Z`) + i * MS_PER_DAY).toISOString().slice(0, 10),
    views: v,
  }));

// en.wikipedia "San Diego Comic-Con" — the convention opened 2026-07-23.
const SDCC_VIEWS = daily(
  '2026-06-28',
  [
    861, 928, 783, 809, 879, 831, 848, 1006, 1066, 1041, 1306, 1357, 1232, 1068, 1035, 1170, 1121,
    1059, 1078, 1178, 1216, 1311, 1612, 1817, 2180, 3688, 3551, 3428,
  ],
);

// en.wikipedia "New York Comic Con" — not running; drifts up slightly anyway,
// which is exactly the false positive the edit gate has to reject.
const NYCC_VIEWS = daily(
  '2026-06-28',
  [
    121, 128, 119, 127, 93, 119, 127, 118, 121, 142, 206, 153, 140, 136, 136, 154, 162, 113, 162,
    189, 170, 145, 156, 147, 169, 212, 250, 227,
  ],
);

// A character, not an event: one-day 22x spike then a hard fall — the signature
// of a discrete announcement.
const DOOM_VIEWS = daily(
  '2026-06-28',
  [
    2312, 2456, 2251, 2068, 1994, 1967, 1951, 2236, 2256, 2281, 2363, 2466, 2281, 2331, 2770, 3381,
    3036, 2764, 2666, 3071, 2744, 2755, 49447, 62256, 35089, 25002, 20606, 16496,
  ],
);

// Still climbing on the newest day — an ongoing run rather than a spike.
const MOTU_VIEWS = daily(
  '2026-06-28',
  [
    2935, 2363, 2109, 2221, 1801, 1828, 1955, 1955, 1456, 1350, 2378, 1767, 1423, 1351, 1384, 1368,
    1305, 976, 1066, 1048, 1194, 1047, 1089, 1246, 5258, 9327, 10043, 12598,
  ],
);

// Revision timestamps, newest first, with the oldest of the 100 sampled kept as
// the baseline anchor: SDCC's 100 revisions reach back to 2024-12, NYCC's to
// 2021-11, so both long-run rates are genuinely low and the burst is the signal.
const SDCC_EDITS = [
  '2026-07-26T10:57:42Z',
  '2026-07-25T04:46:36Z',
  '2026-07-25T00:46:46Z',
  '2026-07-24T22:28:58Z',
  '2026-07-24T16:57:28Z',
  '2026-07-24T16:52:30Z',
  '2026-07-24T07:49:02Z',
  '2026-07-24T01:03:13Z',
  '2026-07-23T21:35:58Z',
  '2026-07-23T19:35:07Z',
  '2026-07-23T19:34:48Z',
  '2026-07-23T19:33:32Z',
  '2026-07-23T19:31:36Z',
  '2026-07-21T23:12:16Z',
  '2026-07-15T04:34:11Z',
  '2026-06-25T00:49:21Z',
  '2026-06-20T05:18:03Z',
  '2024-12-25T01:37:15Z',
];

const NYCC_EDITS = [
  '2026-07-26T05:53:14Z',
  '2026-07-17T13:50:29Z',
  '2026-07-17T13:49:44Z',
  '2026-07-17T13:48:46Z',
  '2021-11-14T22:57:14Z',
];

const AS_OF = '2026-07-26';

const flat = (days: number, views: number): DailyViews[] =>
  Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10),
    views,
  }));

describe('median', () => {
  it('returns 0 for an empty sample', () => {
    expect(median([])).toBe(0);
  });

  it('averages the middle pair for an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('ignores outliers a mean would follow', () => {
    expect(median([10, 10, 10, 10, 100_000])).toBe(10);
  });
});

describe('detectEvent — the live event (SDCC 2026)', () => {
  const d = detectEvent({ views: SDCC_VIEWS, editTimestamps: SDCC_EDITS, asOf: AS_OF });

  it('returns live when both signals agree', () => {
    expect(d.verdict).toBe('live');
  });

  it('measures the pageview lift above threshold', () => {
    expect(d.spikeRatio).toBeGreaterThan(SPIKE_MIN);
    expect(d.spikeRatio).toBeCloseTo(3.35, 1);
    expect(d.peak).toBe(3688);
  });

  it('measures the edit burst', () => {
    expect(d.editsRecent).toBe(13);
    expect(d.editBurstRatio).toBeGreaterThan(20);
  });

  it('infers the event window from the elevated run', () => {
    // 2026-07-23 was SDCC 2026's opening day — the window is inferred from
    // attention alone, with no schedule consulted.
    expect(d.liveFrom).toBe('2026-07-23');
    expect(d.liveTo).toBe('2026-07-25');
  });

  it('reports the event as ongoing while the run reaches the newest day', () => {
    expect(d.ongoing).toBe(true);
    expect(d.shape).toBe('sustained');
  });
});

describe('detectEvent — the dormant event (NYCC, same days)', () => {
  const d = detectEvent({ views: NYCC_VIEWS, editTimestamps: NYCC_EDITS, asOf: AS_OF });

  it('stays idle despite a mild correlated pageview drift', () => {
    expect(d.verdict).toBe('idle');
    expect(d.spikeRatio).toBeLessThan(SPIKE_MIN);
  });

  it('is vetoed by the absolute-edit floor, not by the burst ratio', () => {
    // The ratio alone clears EDIT_BURST_MIN off a years-long dormant baseline;
    // the absolute floor is what actually rejects it. This is the guard's job.
    expect(d.editsRecent).toBeLessThan(EDITS_ABS_MIN);
    expect(d.editBurstRatio).toBeGreaterThan(4);
  });

  it('claims no event window', () => {
    expect(d.liveFrom).toBeNull();
    expect(d.liveTo).toBeNull();
    expect(d.ongoing).toBe(false);
  });
});

describe('detectEvent — curve shape separates announcements from happenings', () => {
  it('reads a sharp spike that already peaked as decaying', () => {
    const d = detectEvent({ views: DOOM_VIEWS, editTimestamps: [], asOf: AS_OF });
    expect(d.shape).toBe('decaying');
    expect(d.spikeRatio).toBeGreaterThan(10);
  });

  it('reads a still-climbing curve as sustained', () => {
    const d = detectEvent({ views: MOTU_VIEWS, editTimestamps: [], asOf: AS_OF });
    expect(d.shape).toBe('sustained');
  });

  it('never promotes a pageview-only signal to live', () => {
    for (const views of [DOOM_VIEWS, MOTU_VIEWS]) {
      expect(detectEvent({ views, editTimestamps: [], asOf: AS_OF }).verdict).toBe('watch');
    }
  });

  it('calls an unmoving article flat', () => {
    const d = detectEvent({ views: flat(28, 900), editTimestamps: [], asOf: AS_OF });
    expect(d.shape).toBe('flat');
    expect(d.verdict).toBe('idle');
  });
});

describe('detectEvent — degradation', () => {
  it('returns idle for an empty sample rather than throwing', () => {
    expect(detectEvent({ views: [], editTimestamps: [], asOf: AS_OF }).verdict).toBe('idle');
  });

  it('drops unparseable rows instead of poisoning the median', () => {
    const d = detectEvent({
      views: [...flat(10, 100), { date: 'not-a-date', views: 999_999 }],
      editTimestamps: ['also-not-a-date'],
      asOf: AS_OF,
    });
    expect(d.baseline).toBe(100);
    expect(d.verdict).toBe('idle');
  });

  it('anchors the recent window to the newest data, not to asOf', () => {
    // The pageviews API lags 1-2 days. Anchoring to a far-future asOf must not
    // slide the window past the data and read a live event as flat.
    const stale = detectEvent({ views: SDCC_VIEWS, editTimestamps: [], asOf: '2026-08-30' });
    expect(stale.peak).toBe(3688);
    expect(stale.spikeRatio).toBeCloseTo(3.35, 1);
  });
});
