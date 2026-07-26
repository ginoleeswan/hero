import { mapLiveEventRows } from '../../../src/lib/db/events';

const row = {
  slug: 'sdcc',
  headline: 'San Diego Comic-Con',
  blurb: null,
  accent: '#CE9B33',
  shape: 'sustained',
  spike_ratio: '3.35',
  live_from: '2026-07-23',
  live_to: '2026-07-25',
  ongoing: true,
};

describe('mapLiveEventRows', () => {
  it('maps a live row and parses the PostgREST numeric string', () => {
    const [e] = mapLiveEventRows([row]);
    expect(e.slug).toBe('sdcc');
    expect(e.spikeRatio).toBeCloseTo(3.35);
    expect(e.shape).toBe('sustained');
    expect(e.ongoing).toBe(true);
  });

  it('accepts a numeric ratio unchanged', () => {
    expect(mapLiveEventRows([{ ...row, spike_ratio: 4.2 }])[0].spikeRatio).toBeCloseTo(4.2);
  });

  it('nulls a ratio that cannot be parsed rather than emitting NaN', () => {
    for (const bad of ['', 'abc', null]) {
      expect(mapLiveEventRows([{ ...row, spike_ratio: bad }])[0].spikeRatio).toBeNull();
    }
  });

  it('rejects a shape the detector never produces', () => {
    expect(mapLiveEventRows([{ ...row, shape: 'exploding' }])[0].shape).toBeNull();
    expect(mapLiveEventRows([{ ...row, shape: null }])[0].shape).toBeNull();
  });

  it('defaults a missing ongoing flag to false', () => {
    expect(mapLiveEventRows([{ ...row, ongoing: null }])[0].ongoing).toBe(false);
  });

  it('maps an empty result to an empty list', () => {
    expect(mapLiveEventRows([])).toEqual([]);
  });
});
