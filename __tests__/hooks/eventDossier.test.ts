import { formatWindow, windowLengthDays } from '../../src/hooks/useEventDossier';
import { mapEventDossier, mapEventIndex } from '../../src/lib/db/events.dossier';

describe('windowLengthDays', () => {
  it('counts both ends — a Thu-to-Sun convention is four days, not three', () => {
    // SDCC 2026's detected window.
    expect(windowLengthDays('2026-07-23', '2026-07-26')).toBe(4);
  });

  it('is 1 for a single-day event', () => {
    expect(windowLengthDays('2026-07-23', '2026-07-23')).toBe(1);
  });

  it('returns null rather than a negative or NaN', () => {
    expect(windowLengthDays('2026-07-26', '2026-07-23')).toBeNull();
    expect(windowLengthDays(null, '2026-07-23')).toBeNull();
    expect(windowLengthDays('not-a-date', '2026-07-23')).toBeNull();
  });
});

describe('formatWindow', () => {
  it('collapses a same-month range', () => {
    expect(formatWindow('2026-07-23', '2026-07-26')).toBe('23–26 July 2026');
  });

  it('spells both months when the range crosses one', () => {
    expect(formatWindow('2026-07-30', '2026-08-02')).toBe('30 July – 2 August 2026');
  });

  it('drops the range for a single day', () => {
    expect(formatWindow('2026-07-23', '2026-07-23')).toBe('23 July 2026');
    expect(formatWindow('2026-07-23', null)).toBe('23 July 2026');
  });

  it('parses as UTC so the label cannot slip a day by timezone', () => {
    // A local-midnight parse would render this as the 22nd west of Greenwich.
    expect(formatWindow('2026-07-23', '2026-07-23')).toContain('23');
  });
});

describe('mapEventDossier', () => {
  it('returns null for anything that is not a dossier', () => {
    // The RPC returns null for an unknown, disabled or unapproved slug, and the
    // page renders a not-found rather than an empty shell.
    expect(mapEventDossier(null)).toBeNull();
    expect(mapEventDossier({})).toBeNull();
    expect(mapEventDossier({ event: { slug: 'sdcc' } })).toBeNull();
  });

  it('maps the snake_case payload and tolerates missing lists', () => {
    const d = mapEventDossier({
      event: {
        slug: 'sdcc',
        headline: 'San Diego Comic-Con',
        live_from: '2026-07-23',
        live_to: '2026-07-26',
        ongoing: true,
        // numeric comes back as a string over PostgREST
        spike_ratio: '7.42',
        peak: 3688,
        views_daily: [{ date: '2026-07-23', views: 2100 }],
      },
    });
    expect(d?.event.spikeRatio).toBe(7.42);
    expect(d?.event.ongoing).toBe(true);
    expect(d?.event.viewsDaily).toHaveLength(1);
    expect(d?.trailers).toEqual([]);
    expect(d?.surges).toEqual([]);
    expect(d?.issues).toEqual([]);
  });

  it('keeps a surge cause so the page can say what moved someone', () => {
    const d = mapEventDossier({
      event: { slug: 'sdcc', headline: 'SDCC' },
      surges: [
        {
          hero_id: 'h_doom',
          name: 'Doctor Doom',
          spike: '10.4',
          cause_kind: 'trailer',
          cause_label: 'Avengers: Doomsday',
        },
      ],
    });
    expect(d?.surges[0]).toMatchObject({
      name: 'Doctor Doom',
      spike: 10.4,
      causeLabel: 'Avengers: Doomsday',
    });
  });
});

describe('mapEventIndex', () => {
  it('survives a null or malformed payload', () => {
    // The index page renders its own empty state; it must never throw on the way
    // there.
    expect(mapEventIndex(null)).toEqual({ events: [], watching: [], watched: 0 });
    expect(mapEventIndex({ events: 'nope' })).toEqual({ events: [], watching: [], watched: 0 });
  });

  it('keeps the watched count, which is what makes one row honest', () => {
    // Twenty events are polled and one has fired. An index showing a single row
    // without that context reads like a broken feature rather than a quiet one.
    const i = mapEventIndex({
      watched: 20,
      events: [
        { slug: 'sdcc', headline: 'San Diego Comic-Con', is_live: true, spike_ratio: '7.42' },
      ],
    });
    expect(i.watched).toBe(20);
    expect(i.events).toHaveLength(1);
    expect(i.events[0].isLive).toBe(true);
    expect(i.events[0].spikeRatio).toBe(7.42);
  });

  it('keeps the watching roster, which is what makes a one-row index a page', () => {
    // With one confirmed event a bare list is a row in a void. The nineteen that
    // have not fired are real, already stored, and the most useful thing a
    // returning visitor can be shown.
    const i = mapEventIndex({
      watched: 20,
      events: [{ slug: 'sdcc', headline: 'San Diego Comic-Con' }],
      watching: [
        { slug: 'nycc', headline: 'New York Comic Con' },
        { headline: 'no slug — dropped' },
      ],
    });
    expect(i.watching).toEqual([{ slug: 'nycc', headline: 'New York Comic Con' }]);
  });

  it('drops rows that cannot be routed to', () => {
    // A row without a slug is a dead link; better absent than broken.
    const i = mapEventIndex({
      watched: 3,
      events: [{ headline: 'No slug' }, { slug: 'ok', headline: 'Fine' }],
    });
    expect(i.events.map((e) => e.slug)).toEqual(['ok']);
  });
});
