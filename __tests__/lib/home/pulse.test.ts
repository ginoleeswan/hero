import {
  railEvents,
  rankPulse,
  scoreCandidate,
  decay,
  eventDayLabel,
  eventPhase,
  eventStatusLabel,
  relevance,
  badgeFor,
  subtitleFor,
  livePulseEvent,
  trailerPicks,
  KIND_CAP,
  KIND_HALF_LIFE,
  MAX_AGE_HOURS,
  PIN_SCORE,
  type PulseCandidate,
} from '../../../src/lib/home/pulse';

const NOW = Date.parse('2026-07-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

const trailer = (over: Partial<PulseCandidate> = {}): PulseCandidate => ({
  kind: 'trailer',
  eventId: 'video:k1',
  entityId: 'tmdb:1',
  headline: 'Spider-Man: Brand New Day',
  subtype: 'Trailer',
  imageUrl: 'https://img/b.jpg',
  accent: null,
  occurredAt: hoursAgo(3),
  mediaKey: 'k1',
  releaseDate: '2026-07-28',
  provider: null,
  publisher: null,
  characterCount: 6,
  maxFame: 95,
  ...over,
});

const surge = (over: Partial<PulseCandidate> = {}): PulseCandidate => ({
  kind: 'surge',
  eventId: 'surge:Marvel',
  entityId: 'h_doom',
  headline: 'Doctor Doom',
  subtype: '10.4',
  imageUrl: 'https://img/doom.jpg',
  accent: null,
  occurredAt: hoursAgo(24 * 7),
  mediaKey: null,
  releaseDate: null,
  provider: null,
  publisher: 'Marvel',
  characterCount: 10,
  maxFame: 95,
  ...over,
});

const issue = (over: Partial<PulseCandidate> = {}): PulseCandidate => ({
  kind: 'issue',
  eventId: 'issue:cvi:1',
  entityId: 'cvi:1',
  headline: 'The Amazing Spider-Man',
  subtype: '33',
  imageUrl: 'https://img/cover.jpg',
  accent: null,
  occurredAt: hoursAgo(96),
  mediaKey: null,
  releaseDate: null,
  provider: null,
  publisher: 'Marvel',
  characterCount: 4,
  maxFame: 90,
  ...over,
});

const liveEvent = (over: Partial<PulseCandidate> = {}): PulseCandidate => ({
  kind: 'live_event',
  eventId: 'event:sdcc',
  entityId: 'sdcc',
  headline: 'San Diego Comic-Con',
  subtype: 'sustained',
  imageUrl: null,
  accent: '#CE9B33',
  occurredAt: hoursAgo(72),
  mediaKey: null,
  releaseDate: null,
  provider: null,
  publisher: null,
  characterCount: 0,
  maxFame: null,
  ...over,
});

describe('decay', () => {
  it('is 1 at age zero and 0.5 at one half-life', () => {
    expect(decay(0, 48)).toBe(1);
    expect(decay(48, 48)).toBeCloseTo(0.5);
    expect(decay(96, 48)).toBeCloseTo(0.25);
  });

  it('never decays a pinned kind', () => {
    expect(decay(10_000, Infinity)).toBe(1);
  });

  it('treats negative age as zero rather than amplifying', () => {
    expect(decay(-100, 48)).toBe(1);
  });
});

describe('relevance', () => {
  it('is zero for a trailer the catalogue cannot illustrate', () => {
    expect(relevance(trailer({ characterCount: 0 }))).toBe(0);
  });

  it('rises with cast breadth but saturates', () => {
    const one = relevance(trailer({ characterCount: 1 }));
    const six = relevance(trailer({ characterCount: 6 }));
    const twenty = relevance(trailer({ characterCount: 20 }));
    expect(six).toBeGreaterThan(one);
    expect(twenty).toBeCloseTo(six);
  });

  it('exempts issues — a comic cover illustrates itself', () => {
    expect(relevance(issue({ characterCount: 0 }))).toBeGreaterThan(0);
  });

  it('never returns zero purely for missing fame', () => {
    expect(relevance(trailer({ maxFame: null }))).toBeGreaterThan(0);
  });
});

describe('scoreCandidate', () => {
  it('pins a live event above everything', () => {
    expect(scoreCandidate(liveEvent(), NOW)).toBe(PIN_SCORE);
    expect(scoreCandidate(trailer({ occurredAt: hoursAgo(0) }), NOW)).toBeLessThan(PIN_SCORE);
  });

  it('pins it regardless of when it was first detected', () => {
    expect(scoreCandidate(liveEvent({ occurredAt: hoursAgo(300) }), NOW)).toBe(PIN_SCORE);
  });

  it('drops an undated or unparseable candidate', () => {
    expect(scoreCandidate(trailer({ occurredAt: null }), NOW)).toBe(0);
    expect(scoreCandidate(trailer({ occurredAt: 'whenever' }), NOW)).toBe(0);
  });

  it('drops anything past the hard age ceiling', () => {
    expect(scoreCandidate(trailer({ occurredAt: hoursAgo(MAX_AGE_HOURS + 1) }), NOW)).toBe(0);
  });

  it('halves a trailer over its half-life', () => {
    const fresh = scoreCandidate(trailer({ occurredAt: hoursAgo(0) }), NOW);
    const aged = scoreCandidate(trailer({ occurredAt: hoursAgo(KIND_HALF_LIFE.trailer) }), NOW);
    expect(aged / fresh).toBeCloseTo(0.5, 2);
  });

  it('keeps a week-old trailer ahead of the weekly comic shipment', () => {
    // Measured regression, 2026-07-27: at a 48h trailer half-life against 96h for
    // issues, the Avengers: Doomsday trailer (7 days old, 5 characters, fame 100)
    // scored below four-day-old comics and never reached the rail — the biggest
    // story in the catalogue, in the database and off the page. Trailers decay
    // slower than the shipment they compete with, or the lane is decorative.
    const doomsday = scoreCandidate(
      trailer({ occurredAt: hoursAgo(24 * 7), characterCount: 5, maxFame: 100 }),
      NOW,
    );
    const wednesday = scoreCandidate(
      issue({ occurredAt: hoursAgo(24 * 4), characterCount: 8, maxFame: 100 }),
      NOW,
    );
    expect(doomsday).toBeGreaterThan(wednesday);
  });
});

describe('rankPulse — ordering', () => {
  it('puts the live event first even against a trailer from minutes ago', () => {
    const out = rankPulse([trailer({ occurredAt: hoursAgo(0.2) }), liveEvent()], NOW);
    expect(out[0].kind).toBe('live_event');
  });

  it('ranks a fresh trailer above a week-old one', () => {
    const out = rankPulse(
      [
        trailer({ entityId: 'old', eventId: 'v:old', occurredAt: hoursAgo(168) }),
        trailer({ entityId: 'new', eventId: 'v:new', occurredAt: hoursAgo(2) }),
      ],
      NOW,
    );
    expect(out.map((e) => e.entityId)).toEqual(['new', 'old']);
  });

  it('lets a same-day trailer outrank a same-day issue', () => {
    const out = rankPulse(
      [issue({ occurredAt: hoursAgo(2) }), trailer({ occurredAt: hoursAgo(2) })],
      NOW,
    );
    expect(out[0].kind).toBe('trailer');
  });

  it('lets a fresh issue outrank a stale trailer', () => {
    const out = rankPulse(
      [issue({ occurredAt: hoursAgo(1) }), trailer({ occurredAt: hoursAgo(240) })],
      NOW,
    );
    expect(out[0].kind).toBe('issue');
  });

  it('respects the cap', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      trailer({ entityId: `t${i}`, eventId: `v${i}`, occurredAt: hoursAgo(i) }),
    );
    expect(rankPulse(many, NOW, 5)).toHaveLength(5);
  });
});

describe('rankPulse — de-duplication', () => {
  it('shows one card per entity, keeping the stronger', () => {
    // A title that dropped a teaser then a trailer is one story; twice makes a
    // short rail look thin.
    const out = rankPulse(
      [
        trailer({ eventId: 'v:teaser', subtype: 'Teaser', occurredAt: hoursAgo(40) }),
        trailer({ eventId: 'v:trailer', subtype: 'Trailer', occurredAt: hoursAgo(2) }),
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].badge).toBe('New trailer');
  });

  it('keeps distinct entities', () => {
    const out = rankPulse(
      [trailer({ entityId: 'a', eventId: 'va' }), trailer({ entityId: 'b', eventId: 'vb' })],
      NOW,
    );
    expect(out).toHaveLength(2);
  });
});

describe('rankPulse — display fields', () => {
  it('labels a trailer with its age, a live event with none', () => {
    const out = rankPulse([trailer({ occurredAt: hoursAgo(3) }), liveEvent()], NOW);
    const live = out.find((e) => e.kind === 'live_event');
    const tr = out.find((e) => e.kind === 'trailer');
    expect(live?.ageLabel).toBeNull();
    expect(live?.ageHours).toBe(0);
    expect(tr?.ageLabel).toBe('3H AGO');
  });

  it('drops zero-relevance candidates entirely', () => {
    expect(rankPulse([trailer({ characterCount: 0 })], NOW)).toEqual([]);
  });
});

describe('badgeFor', () => {
  it('names each kind without needing a legend', () => {
    expect(badgeFor(trailer())).toBe('New trailer');
    expect(badgeFor(trailer({ subtype: 'Teaser' }))).toBe('New teaser');
    expect(badgeFor(issue())).toBe('On shelves');
    expect(badgeFor(liveEvent())).toBe('Live now');
  });
});

describe('subtitleFor — the "so what" line', () => {
  it('pairs a trailer with its countdown', () => {
    expect(subtitleFor(trailer({ releaseDate: '2026-07-28' }), NOW)).toBe('In cinemas in 2 days');
    expect(subtitleFor(trailer({ releaseDate: '2026-07-27' }), NOW)).toBe('In cinemas tomorrow');
    expect(subtitleFor(trailer({ releaseDate: '2026-07-26' }), NOW)).toBe('In cinemas today');
  });

  it('falls back to the streamer for an already-released title', () => {
    expect(subtitleFor(trailer({ releaseDate: '2026-01-01', provider: 'Disney Plus' }), NOW)).toBe(
      'On Disney Plus',
    );
  });

  it('says in cinemas now for a released title with no streamer', () => {
    expect(subtitleFor(trailer({ releaseDate: '2026-01-01', provider: null }), NOW)).toBe(
      'In cinemas now',
    );
  });

  it('survives a missing or malformed release date', () => {
    expect(subtitleFor(trailer({ releaseDate: null, provider: null }), NOW)).toBeNull();
    expect(subtitleFor(trailer({ releaseDate: 'soon', provider: 'Max' }), NOW)).toBe('On Max');
  });

  it('uses the issue number for a comic', () => {
    expect(subtitleFor(issue({ subtype: '33' }), NOW)).toBe('#33');
    expect(subtitleFor(issue({ subtype: null, publisher: 'DC Comics' }), NOW)).toBe('DC Comics');
  });
});

describe('derived selectors', () => {
  it('finds the live event for the band header', () => {
    const out = rankPulse([trailer(), liveEvent()], NOW);
    expect(livePulseEvent(out)?.headline).toBe('San Diego Comic-Con');
    expect(livePulseEvent(rankPulse([trailer()], NOW))).toBeNull();
  });

  it('hands the hero picker the same trailers the rail is showing', () => {
    // The hero and the rail must agree on what today's news is, rather than each
    // querying it separately and disagreeing.
    const out = rankPulse([trailer({ occurredAt: hoursAgo(3) }), issue(), liveEvent()], NOW);
    const picks = trailerPicks(out);
    expect(picks).toHaveLength(1);
    expect(picks[0]).toEqual({
      titleId: 'tmdb:1',
      publishedAt: hoursAgo(3),
      videoType: 'Trailer',
    });
  });
});

describe('rankPulse — volume must not crowd out news', () => {
  // Modelled on the first real production payload (2026-07-26): 20 issues, 2
  // trailers, 1 live event. Before KIND_CAP this rendered 1 event + 1 trailer +
  // 10 comics, and dropped the second trailer off the rail entirely.
  const production = (): PulseCandidate[] => [
    liveEvent({ occurredAt: hoursAgo(72) }),
    trailer({
      eventId: 'v:bnd',
      entityId: 'tmdb:bnd',
      headline: 'Spider-Man: Brand New Day',
      occurredAt: hoursAgo(48),
      characterCount: 5,
      maxFame: 100,
    }),
    trailer({
      eventId: 'v:motu',
      entityId: 'tmdb:motu',
      headline: 'Masters of the Universe',
      occurredAt: hoursAgo(144),
      releaseDate: '2026-06-03',
      characterCount: 7,
      maxFame: 94,
    }),
    ...Array.from({ length: 20 }, (_, i) =>
      issue({
        eventId: `issue:${i}`,
        entityId: `cvi:${i}`,
        headline: `Series ${i}`,
        occurredAt: hoursAgo(90 + (i % 3) * 24),
        characterCount: 4 + (i % 4),
        maxFame: 90 + (i % 10),
      }),
    ),
  ];

  it('caps comics so a weekly shipment cannot become the rail', () => {
    const out = rankPulse(production(), NOW, 12);
    expect(out.filter((e) => e.kind === 'issue')).toHaveLength(KIND_CAP.issue);
  });

  it('keeps the second trailer that volume used to push off', () => {
    const out = rankPulse(production(), NOW, 12);
    expect(out.some((e) => e.entityId === 'tmdb:motu')).toBe(true);
  });

  it('still leads with the live event, then the freshest trailer', () => {
    const out = rankPulse(production(), NOW, 12);
    expect(out[0].kind).toBe('live_event');
    expect(out[1].entityId).toBe('tmdb:bnd');
  });

  it('skips a surplus comic rather than ending the fill early', () => {
    // A lower-scoring trailer must still get the slot a capped comic vacates.
    const out = rankPulse(production(), NOW, 12);
    const motu = out.findIndex((e) => e.entityId === 'tmdb:motu');
    const issues = out.filter((e) => e.kind === 'issue');
    expect(motu).toBeGreaterThan(-1);
    expect(issues.length).toBeLessThanOrEqual(KIND_CAP.issue);
  });
});

describe('railEvents — nothing but comics is not news', () => {
  it('renders no rail when only issues qualify', () => {
    // The band already has a dedicated ComicCoverRail; a "Just Happened" rail of
    // three comic covers would be strictly worse than it.
    const onlyIssues = Array.from({ length: 8 }, (_, i) =>
      issue({ eventId: `i${i}`, entityId: `cvi:${i}`, occurredAt: hoursAgo(20) }),
    );
    expect(railEvents(rankPulse(onlyIssues, NOW))).toEqual([]);
  });

  it('appears as soon as one real event joins them', () => {
    const withNews = [
      ...Array.from({ length: 8 }, (_, i) =>
        issue({ eventId: `i${i}`, entityId: `cvi:${i}`, occurredAt: hoursAgo(20) }),
      ),
      trailer({ occurredAt: hoursAgo(5) }),
    ];
    const out = railEvents(rankPulse(withNews, NOW));
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((e) => e.kind === 'trailer')).toBe(true);
  });

  it('a live event alone is enough to justify the rail', () => {
    const out = railEvents(rankPulse([liveEvent(), issue({ occurredAt: hoursAgo(10) })], NOW));
    expect(out).toHaveLength(2);
  });
});

describe('railEvents — artwork', () => {
  it('drops a media event with no artwork rather than rendering a colour block', () => {
    const out = railEvents(
      rankPulse([trailer({ imageUrl: null }), trailer({ entityId: 'b', eventId: 'vb' })], NOW),
    );
    expect(out).toHaveLength(1);
    expect(out[0].entityId).toBe('b');
  });

  it('keeps a live event, which never has artwork by design', () => {
    // watched_events stores no image, and Wikipedia has no lead image for SDCC at
    // all. Filtering it would hide the design problem rather than solve it — the
    // live card gets its own treatment instead.
    const out = railEvents(rankPulse([liveEvent({ imageUrl: null }), trailer()], NOW));
    expect(out.some((e) => e.kind === 'live_event')).toBe(true);
  });
});

describe('eventDayLabel — the live card counts days', () => {
  // "Happening now" is true but static. A counter that advances is what makes a
  // live card read as live rather than merely labelled.
  it('counts the day inside a known window', () => {
    expect(eventDayLabel('2026-07-25', '2026-07-28', NOW)).toBe('DAY 2 OF 4');
    expect(eventDayLabel('2026-07-21', '2026-07-30', NOW)).toBe('DAY 6 OF 10');
  });

  it('says FINAL DAY rather than "DAY n OF n" on the last one', () => {
    // Same fact, said better.
    expect(eventDayLabel('2026-07-24', '2026-07-26', NOW)).toBe('FINAL DAY');
    expect(eventDayLabel('2026-07-26', '2026-07-26', NOW)).toBe('FINAL DAY');
  });

  it('drops the total when the end is unknown', () => {
    expect(eventDayLabel('2026-07-24', null, NOW)).toBe('DAY 3');
  });

  it('says FINAL DAY inside the one-day lag grace rather than inventing a day', () => {
    // live_to can trail reality by a day, so today == end + 1 is still plausibly
    // live. SDCC's real production window (2026-07-23 → 07-25) read on 07-26.
    // "DAY 4" would assert a fourth day of a three-day convention.
    expect(eventDayLabel('2026-07-23', '2026-07-25', NOW)).toBe('FINAL DAY');
  });

  it('stops counting once the event has actually wrapped', () => {
    // The regression this exists for: on 2026-07-27 the card read "LIVE · DAY 5"
    // for a three-day convention that ended on the 25th. get_live_events keeps an
    // `ongoing` row for three days past live_to so the pageview lag can't retire a
    // convention early — that grace belongs to detection, not to the copy.
    expect(eventDayLabel('2026-07-22', '2026-07-24', NOW)).toBeNull();
    const twoDaysAfter = Date.parse('2026-07-27T12:00:00Z');
    expect(eventDayLabel('2026-07-23', '2026-07-25', twoDaysAfter)).toBeNull();
  });

  it('swaps the status word to "Just wrapped" instead of claiming Live', () => {
    // The day counter going quiet isn't enough on its own — the card's other word
    // is "Live", and that was just as false as "DAY 5".
    expect(eventStatusLabel('2026-07-23', '2026-07-25', NOW)).toBe('Live');
    const twoDaysAfter = Date.parse('2026-07-27T12:00:00Z');
    expect(eventStatusLabel('2026-07-23', '2026-07-25', twoDaysAfter)).toBe('Just wrapped');
    expect(eventPhase('2026-07-23', '2026-07-25', twoDaysAfter)).toBe('wrapped');
    // An unknown end can't be shown to have passed, so it stays live.
    expect(eventPhase('2026-07-23', null, twoDaysAfter)).toBe('live');
  });

  it('returns null before the window opens, or when it cannot be parsed', () => {
    expect(eventDayLabel('2026-08-01', '2026-08-04', NOW)).toBeNull();
    expect(eventDayLabel(null, '2026-07-26', NOW)).toBeNull();
    expect(eventDayLabel('not-a-date', '2026-07-26', NOW)).toBeNull();
  });

  it('is attached to live events and nothing else', () => {
    const out = rankPulse(
      [liveEvent({ windowFrom: '2026-07-25', windowTo: '2026-07-28' }), trailer()],
      NOW,
    );
    expect(out.find((e) => e.kind === 'live_event')?.dayLabel).toBe('DAY 2 OF 4');
    expect(out.find((e) => e.kind === 'trailer')?.dayLabel).toBeNull();
  });

  it('leaves the label null when the event has no window yet', () => {
    const out = rankPulse([liveEvent()], NOW);
    expect(out[0].dayLabel).toBeNull();
  });
});

describe('surge — the audience is an event source too', () => {
  // Doctor Doom ran 20,019 -> 197,899 pageviews on the Avengers: Doomsday footage
  // and the app had nowhere to say so. Surges were excluded for having no event
  // time; heroes.views_daily fixed that upstream, so they rank like anything else.
  it('carries the group size in the subtitle, not just the character', () => {
    // The whole point of grouping by publisher: ten Marvel characters moving at
    // once is one story, and the card has to say so or it reads as one character
    // having a good day.
    expect(subtitleFor(surge({ characterCount: 10, subtype: '10.4' }), NOW)).toBe(
      '10.4\u00d7 reads · +9 more',
    );
  });

  it('drops the tail when the surge is a single character', () => {
    expect(subtitleFor(surge({ characterCount: 1, subtype: '3.2' }), NOW)).toBe('3.2\u00d7 reads');
  });

  it('is badged as its own kind rather than borrowing another', () => {
    expect(badgeFor(surge())).toBe('Surging');
  });

  it('is capped so the rail reports attention without becoming a leaderboard', () => {
    const out = rankPulse(
      [
        surge({ eventId: 'surge:Marvel', entityId: 'h_a', publisher: 'Marvel' }),
        surge({ eventId: 'surge:Mattel', entityId: 'h_b', publisher: 'Mattel' }),
        surge({ eventId: 'surge:DC', entityId: 'h_c', publisher: 'DC Comics' }),
        surge({ eventId: 'surge:NRS', entityId: 'h_d', publisher: 'NetherRealm' }),
      ],
      NOW,
    );
    expect(out.filter((e) => e.kind === 'surge')).toHaveLength(KIND_CAP.surge);
  });

  it('ranks under a same-age trailer, because a trailer is the cause', () => {
    const t = scoreCandidate(trailer({ occurredAt: hoursAgo(48) }), NOW);
    const sg = scoreCandidate(surge({ occurredAt: hoursAgo(48) }), NOW);
    expect(sg).toBeLessThan(t);
    expect(sg).toBeGreaterThan(0);
  });
});
