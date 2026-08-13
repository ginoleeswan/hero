import {
  EMPTY_SEEN,
  buildInbox,
  markSeen,
  MAX_REMEMBERED_APPEARANCES,
  unreadCount,
  type InboxInput,
} from '../../../src/lib/notifications/inbox';

const NOW = Date.UTC(2026, 7, 12, 12, 0, 0);

const base: InboxInput = {
  seen: EMPTY_SEEN,
  now: NOW,
  myTakes: [],
  yesterday: null,
  streak: null,
  favouriteAppearances: [],
};

const take = (over: Partial<InboxInput['myTakes'][number]> = {}) => ({
  id: 't1',
  heroAId: 'a',
  heroBId: 'b',
  agreeCount: 3,
  createdAt: new Date(NOW - 86400000).toISOString(),
  ...over,
});

describe('agreement on your takes', () => {
  it('reports the delta, not the total', () => {
    const seen = { ...EMPTY_SEEN, agreeCounts: { t1: 2 } };
    const items = buildInbox({ ...base, seen, myTakes: [take({ agreeCount: 5 })] });
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('3 people');
  });

  // A take sitting at 12 agrees is not news every time the inbox opens.
  it('says nothing when nothing changed', () => {
    const seen = { ...EMPTY_SEEN, agreeCounts: { t1: 3 } };
    expect(buildInbox({ ...base, seen, myTakes: [take()] })).toHaveLength(0);
  });

  it('does not report a negative delta if an agree is withdrawn', () => {
    const seen = { ...EMPTY_SEEN, agreeCounts: { t1: 5 } };
    expect(buildInbox({ ...base, seen, myTakes: [take({ agreeCount: 4 })] })).toHaveLength(0);
  });

  it('uses the singular for one, in the title and the body', () => {
    const items = buildInbox({ ...base, myTakes: [take({ agreeCount: 1 })] });
    expect(items[0].title).toBe('Someone agreed with your take');
    expect(items[0].body).toBe('1 person agrees with it now.');
  });

  it('pluralises the running total', () => {
    const items = buildInbox({ ...base, myTakes: [take({ agreeCount: 4 })] });
    expect(items[0].body).toBe('4 people agree with it now.');
  });
});

describe('yesterday’s debate', () => {
  const yesterday = {
    date: '2026-08-11',
    nameA: 'Goku',
    nameB: 'Superman',
    votesA: 70,
    votesB: 30,
    myTakeCrowned: false,
  };

  it('reports the result once', () => {
    const items = buildInbox({ ...base, yesterday });
    expect(items).toHaveLength(1);
    expect(items[0].body).toBe('70% said Goku.');
  });

  it('does not repeat a result already shown', () => {
    const seen = { ...EMPTY_SEEN, lastDebateShown: '2026-08-11' };
    expect(buildInbox({ ...base, seen, yesterday })).toHaveLength(0);
  });

  it('leads with the crown when the take was the reader’s', () => {
    const items = buildInbox({ ...base, yesterday: { ...yesterday, myTakeCrowned: true } });
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe('take-crowned');
  });

  it('survives a debate nobody voted on', () => {
    const items = buildInbox({ ...base, yesterday: { ...yesterday, votesA: 0, votesB: 0 } });
    expect(items[0].body).toBe('The votes are in.');
  });
});

describe('a broken streak', () => {
  it('reports a streak worth having, once', () => {
    const items = buildInbox({ ...base, streak: { previous: 6, broken: true } });
    expect(items[0].title).toBe('Your 6-day streak ended');

    const seen = { ...EMPTY_SEEN, lastBrokenStreak: 6 };
    expect(buildInbox({ ...base, seen, streak: { previous: 6, broken: true } })).toHaveLength(0);
  });

  // Losing a one-day "streak" is not a loss, and saying so is a nag.
  it('stays quiet about a streak of one', () => {
    expect(buildInbox({ ...base, streak: { previous: 1, broken: true } })).toHaveLength(0);
  });

  it('stays quiet while the streak is intact', () => {
    expect(buildInbox({ ...base, streak: { previous: 6, broken: false } })).toHaveLength(0);
  });
});

describe('markSeen', () => {
  it('records the counts that were shown, so the next delta is honest', () => {
    const next = markSeen({
      seen: EMPTY_SEEN,
      now: NOW,
      myTakes: [{ id: 't1', agreeCount: 5 }],
      yesterdayDate: '2026-08-11',
      brokenStreak: 6,
    });
    expect(next.agreeCounts.t1).toBe(5);
    expect(next.lastDebateShown).toBe('2026-08-11');
    expect(next.lastBrokenStreak).toBe(6);
    expect(next.lastSeenAt).toBe(NOW);
  });

  it('does not forget an older marker when there is nothing new to record', () => {
    const seen = { ...EMPTY_SEEN, lastDebateShown: '2026-08-10', lastBrokenStreak: 3 };
    const next = markSeen({ seen, now: NOW, myTakes: [], yesterdayDate: null, brokenStreak: null });
    expect(next.lastDebateShown).toBe('2026-08-10');
    expect(next.lastBrokenStreak).toBe(3);
  });
});

describe('unreadCount', () => {
  it('caps, because a number past a point stops being read', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: String(i),
      kind: 'take-agreed' as const,
      title: '',
      body: '',
      url: '/',
      at: i,
      unread: true,
    }));
    expect(unreadCount(many)).toBe(99);
  });
});

describe('favourite appearances in the inbox', () => {
  const appearance = {
    id: 'h1:t1',
    heroId: 'h1',
    heroName: 'Storm',
    what: 'title' as const,
    label: 'The Film',
    url: '/title/t1',
    at: 2_000,
  };

  it('reports a favourite turning up in something', () => {
    const items = buildInbox({
      ...base,
      now: 3_000,
      seen: { ...EMPTY_SEEN, lastSeenAt: 1_000 },
      favouriteAppearances: [appearance],
    });
    expect(items.map((i) => i.kind)).toContain('favourite-appearance');
    expect(items[0].title).toBe('Storm is in The Film');
  });

  // Adding a favourite must not dump the hero's back catalogue into the inbox:
  // the reader is being told what happened while they were away.
  it('ignores anything older than the marker', () => {
    const items = buildInbox({
      ...base,
      now: 3_000,
      seen: { ...EMPTY_SEEN, lastSeenAt: 2_500 },
      favouriteAppearances: [appearance],
    });
    expect(items).toEqual([]);
  });

  it('reports once, not once per open', () => {
    const items = buildInbox({
      ...base,
      now: 3_000,
      seen: { ...EMPTY_SEEN, lastSeenAt: 1_000, shownAppearances: ['h1:t1'] },
      favouriteAppearances: [appearance],
    });
    expect(items).toEqual([]);
  });

  // The marker is the only part that grows with use and is rewritten on every
  // open; unbounded, a heavy reader's write gets slower forever.
  it('bounds what the marker remembers', () => {
    const many = Array.from({ length: MAX_REMEMBERED_APPEARANCES + 50 }, (_, i) => `id-${i}`);
    const next = markSeen({
      seen: EMPTY_SEEN,
      now: 1,
      myTakes: [],
      yesterdayDate: null,
      brokenStreak: null,
      shownAppearances: many,
    });
    expect(next.shownAppearances).toHaveLength(MAX_REMEMBERED_APPEARANCES);
  });
});
