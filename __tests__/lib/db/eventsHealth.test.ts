import { mapEventsHealth } from '../../../src/lib/db/eventsHealth';

describe('mapEventsHealth', () => {
  it('survives a null or empty payload rather than throwing on the admin screen', () => {
    expect(mapEventsHealth(null)).toEqual({
      events: [],
      channels: [],
      editions: [],
      generatedAt: null,
    });
    expect(mapEventsHealth({}).events).toEqual([]);
  });

  it('keeps is_live separate from verdict, because they are different claims', () => {
    // A `live` verdict does not mean the event is on the rail: the rejection
    // flag and the grace window both apply. Conflating them would show "ON THE
    // RAIL" against something that has been vetoed — the precise thing this
    // panel exists to make visible.
    const h = mapEventsHealth({
      events: [
        { slug: 'd23', headline: 'D23', verdict: 'live', approval: 'rejected', is_live: false },
        { slug: 'sdcc', headline: 'SDCC', verdict: 'idle', approval: 'approved', is_live: true },
      ],
    });
    expect(h.events[0]).toMatchObject({ verdict: 'live', approval: 'rejected', isLive: false });
    expect(h.events[1]).toMatchObject({ verdict: 'idle', isLive: true });
  });

  it('parses numerics that PostgREST returns as strings', () => {
    const h = mapEventsHealth({
      events: [{ slug: 'd23', headline: 'D23', spike_ratio: '3.37', editions: 1 }],
      editions: [{ slug: 'd23', edition_slug: '2026', headline: 'D23', spike_ratio: '3.37' }],
    });
    expect(h.events[0].spikeRatio).toBe(3.37);
    expect(h.events[0].editions).toBe(1);
    expect(h.editions[0].spikeRatio).toBe(3.37);
  });

  it('defaults enabled/official to true so a missing flag never reads as off', () => {
    // These columns are NOT NULL in the schema; a missing value means the
    // payload changed shape, and defaulting to "disabled" would silently blank
    // the panel rather than showing rows that plainly exist.
    const h = mapEventsHealth({
      events: [{ slug: 'd23', headline: 'D23' }],
      channels: [{ id: 'UC1', name: 'Marvel', slug: 'marvel' }],
    });
    expect(h.events[0].enabled).toBe(true);
    expect(h.channels[0].official).toBe(true);
    expect(h.channels[0].enabled).toBe(true);
  });

  it('treats a channel that has never reported a video as null, not zero', () => {
    // The panel colours a feed by how long since it last spoke. `0` would be an
    // epoch timestamp and read as catastrophically stale; null reads as "no
    // uploads seen", which is what it means.
    const h = mapEventsHealth({
      channels: [{ id: 'UC1', name: 'Netflix Geeked', slug: 'netflix-geeked', videos: 0 }],
    });
    expect(h.channels[0].lastVideoAt).toBeNull();
    expect(h.channels[0].videos).toBe(0);
  });
});
