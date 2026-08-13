// src/lib/notifications/inbox.ts — what happened while you were away.
//
// DERIVED, not stored. There is no notifications table and deliberately so:
// every item here is already a fact in another table (a take's agree count,
// yesterday's resolved debate, the local streak), and a second copy of a fact
// is a thing that can disagree with the first. What the device keeps instead is
// one marker — the last time the inbox was opened, plus the agree counts seen
// then — and the items are the difference between that and now.
//
// The consequence worth knowing: this cannot show anything older than the
// marker, and clearing app storage clears the inbox. That is the right trade
// for a feed whose items all expire within a day or two anyway.
//
// Pure functions only, so the rules are testable without a database.

export type InboxKind =
  'take-agreed' | 'take-crowned' | 'debate-resolved' | 'streak-broken' | 'favourite-appearance';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  /** Rooted in-app path — same contract as a notification payload. */
  url: string;
  /** ms epoch, for ordering. */
  at: number;
  unread: boolean;
}

/** The device's memory of what it had already shown. */
export interface InboxSeen {
  /** ms epoch of the last time the inbox was opened. */
  lastSeenAt: number | null;
  /** takeId → agree count at last open, so only NEW agrees surface. */
  agreeCounts: Record<string, number>;
  /** The debate date (YYYY-MM-DD) whose result has already been shown. */
  lastDebateShown: string | null;
  /** Appearance ids already reported, so a title does not re-announce itself
   *  every time the inbox opens. Bounded in markSeen — see the note there. */
  shownAppearances: string[];
  /** The streak value last acknowledged as broken, so it reports once. */
  lastBrokenStreak: number | null;
}

export const EMPTY_SEEN: InboxSeen = {
  lastSeenAt: null,
  agreeCounts: {},
  lastDebateShown: null,
  lastBrokenStreak: null,
  shownAppearances: [],
};

export interface InboxInput {
  seen: InboxSeen;
  now: number;
  /** The reader's own takes, with their live agree counts. */
  myTakes: {
    id: string;
    heroAId: string;
    heroBId: string;
    agreeCount: number;
    createdAt: string;
  }[];
  /** Yesterday's resolved debate, when there is one. */
  yesterday: {
    date: string;
    nameA: string;
    nameB: string;
    votesA: number;
    votesB: number;
    /** Set when the crowned take is the reader's own. */
    myTakeCrowned: boolean;
  } | null;
  /** Local streak state. `brokenAt` is set only on the render that notices. */
  streak: { previous: number; broken: boolean } | null;
  /**
   * Newly-synced titles and events featuring a hero the reader favourited.
   *
   * This is what finally makes a favourite mean something. Before it, hearting
   * a character put them in a list and personalised the title of one daily
   * push — nothing that a reader would describe as following anyone.
   *
   * The caller does the joining (it needs the DB); the rules about what is
   * worth showing live here, where they can be tested.
   */
  favouriteAppearances: {
    /** Stable per (hero, thing) so it reports once, not once per open. */
    id: string;
    heroId: string;
    heroName: string;
    /** What they turned up in. */
    what: 'title' | 'event';
    label: string;
    url: string;
    /** ms epoch the thing was added to the catalogue. */
    at: number;
  }[];
}

/**
 * Build the feed.
 *
 * Ordering is newest first, and `unread` is "arrived since the marker" rather
 * than a per-item flag — with nothing stored there is no per-item read state to
 * keep, and for a feed this short the distinction never shows.
 */
export function buildInbox(input: InboxInput): InboxItem[] {
  const { seen, now, myTakes, yesterday, streak, favouriteAppearances } = input;
  const alreadyShown = new Set(seen.shownAppearances);
  const items: InboxItem[] = [];

  // New agreement on your own takes. Only the DELTA — a take sitting at 12
  // agrees is not news every time the inbox opens, but a 13th is.
  for (const t of myTakes) {
    const before = seen.agreeCounts[t.id] ?? 0;
    const delta = t.agreeCount - before;
    if (delta <= 0) continue;
    // A take's own age is the best timestamp available; agreement has none.
    const at = Math.max(Date.parse(t.createdAt) || 0, seen.lastSeenAt ?? 0);
    items.push({
      id: `agree:${t.id}:${t.agreeCount}`,
      kind: 'take-agreed',
      title:
        delta === 1 ? 'Someone agreed with your take' : `${delta} people agreed with your take`,
      body: `${t.agreeCount} ${t.agreeCount === 1 ? 'person agrees' : 'people agree'} with it now.`,
      url: `/compare/${t.heroAId}/${t.heroBId}`,
      at,
      unread: true,
    });
  }

  if (yesterday && yesterday.date !== seen.lastDebateShown) {
    const total = yesterday.votesA + yesterday.votesB;
    const aLeads = yesterday.votesA >= yesterday.votesB;
    const pct =
      total > 0 ? Math.round(((aLeads ? yesterday.votesA : yesterday.votesB) / total) * 100) : 0;
    const winner = aLeads ? yesterday.nameA : yesterday.nameB;

    if (yesterday.myTakeCrowned) {
      items.push({
        id: `crowned:${yesterday.date}`,
        kind: 'take-crowned',
        title: 'Your take was the top take',
        body: `${yesterday.nameA} vs ${yesterday.nameB} — yours led the debate.`,
        url: '/versus',
        at: now,
        unread: true,
      });
    }

    items.push({
      id: `debate:${yesterday.date}`,
      kind: 'debate-resolved',
      title: `${yesterday.nameA} vs ${yesterday.nameB} is settled`,
      body: total > 0 ? `${pct}% said ${winner}.` : 'The votes are in.',
      url: '/versus',
      at: now - 1,
      unread: true,
    });
  }

  // A broken streak is worth saying once, and only if it was worth having.
  if (streak?.broken && streak.previous >= 2 && seen.lastBrokenStreak !== streak.previous) {
    items.push({
      id: `streak-broken:${streak.previous}`,
      kind: 'streak-broken',
      title: `Your ${streak.previous}-day streak ended`,
      body: 'Today’s hero is up — start another.',
      url: '/play',
      at: now - 2,
      unread: true,
    });
  }

  // A favourite turned up in something new. The one item here that is about a
  // character rather than about the reader's own activity, which is the whole
  // point: a favourite that never tells you anything is a bookmark.
  for (const a of favouriteAppearances) {
    if (alreadyShown.has(a.id)) continue;
    // Nothing that predates the marker. Adding a favourite should not dump the
    // hero's entire back catalogue into the inbox — the reader is being told
    // what happened while they were away, not what happened before they cared.
    if (seen.lastSeenAt !== null && a.at <= seen.lastSeenAt) continue;
    items.push({
      id: `appearance:${a.id}`,
      kind: 'favourite-appearance',
      title: `${a.heroName} is in ${a.label}`,
      body: a.what === 'title' ? 'New on screen — see the cast.' : 'A live event, as it happens.',
      url: a.url,
      at: a.at,
      unread: true,
    });
  }

  return items.sort((a, b) => b.at - a.at);
}

/** The marker to persist once the reader has actually looked. */
export function markSeen(input: {
  seen: InboxSeen;
  now: number;
  myTakes: { id: string; agreeCount: number }[];
  yesterdayDate: string | null;
  brokenStreak: number | null;
  /** Ids of the appearance items that were on screen. */
  shownAppearances?: string[];
}): InboxSeen {
  const agreeCounts: Record<string, number> = { ...input.seen.agreeCounts };
  for (const t of input.myTakes) agreeCounts[t.id] = t.agreeCount;
  return {
    lastSeenAt: input.now,
    agreeCounts,
    lastDebateShown: input.yesterdayDate ?? input.seen.lastDebateShown,
    lastBrokenStreak: input.brokenStreak ?? input.seen.lastBrokenStreak,
    // BOUNDED. This list is the only part of the marker that grows with use —
    // every other field is a scalar — and it is written to AsyncStorage on
    // every open. Unbounded, a heavy reader's marker grows forever and the
    // write gets slower every time. The newest N is enough because an
    // appearance older than the marker is filtered by date anyway; the ids
    // only guard the window where both checks could pass.
    shownAppearances: [
      ...new Set([...(input.shownAppearances ?? []), ...input.seen.shownAppearances]),
    ].slice(0, MAX_REMEMBERED_APPEARANCES),
  };
}

/** Enough to cover the marker window; see the note in markSeen. */
export const MAX_REMEMBERED_APPEARANCES = 200;

/** The badge number. Capped, because a count past a point stops being read. */
export function unreadCount(items: InboxItem[]): number {
  return Math.min(items.filter((i) => i.unread).length, 99);
}
