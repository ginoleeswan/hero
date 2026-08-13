// src/lib/notifications/appearances.ts — turning a favourite into a follow.
//
// Hearting a character used to put them in a list and personalise the title of
// one daily push. Nothing a reader would call following anyone. This is the
// rule that decides when a favourite is worth telling you about: the character
// you starred has turned up in something new on screen.
//
// DERIVED FROM WHAT THE FEED ALREADY HAS. No new table, no new query, no
// migration — the trending slate and the reader's favourites are both already
// fetched and cached for Explore. Intersecting two things the app is holding
// anyway also means this keeps working offline, which the rest of the inbox
// does not.
//
// Pure, so every rule below is testable without a device or a database.
import type { InboxInput } from './inbox';

type Appearance = InboxInput['favouriteAppearances'][number];

export interface AppearanceTitle {
  id: string;
  title: string;
  media_type: string | null;
  release_date: string | null;
  characters: { id: string; name: string }[];
}

/**
 * How far back a release still counts as news.
 *
 * A title released last year is not something that "just happened", however
 * new the row is to our catalogue. Without this, a sync that backfills the
 * slate would announce a decade of films at once — the reader would blame the
 * app, correctly.
 */
export const APPEARANCE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 45;

/**
 * Which favourites are in something new.
 *
 * `now` is passed rather than read so the window is testable, and so a device
 * with a wrong clock produces a wrong-but-deterministic answer rather than a
 * different one per call.
 */
export function favouriteAppearances(input: {
  titles: AppearanceTitle[];
  favouriteIds: Set<string>;
  now: number;
}): Appearance[] {
  const { titles, favouriteIds, now } = input;
  const out: Appearance[] = [];

  for (const t of titles) {
    // No date means no way to tell news from back catalogue. Silence beats a
    // guess: the cost of missing one appearance is nothing, and the cost of
    // announcing a 1998 film as new is the reader turning the feature off.
    if (!t.release_date) continue;
    const at = Date.parse(t.release_date);
    if (!Number.isFinite(at)) continue;
    if (at > now) continue; // not out yet — the slate carries future releases
    if (now - at > APPEARANCE_MAX_AGE_MS) continue;

    for (const c of t.characters) {
      if (!favouriteIds.has(c.id)) continue;
      out.push({
        // Stable per (hero, title) so it reports once however many times the
        // slate is refetched — the inbox marker dedupes on this id.
        id: `${c.id}:${t.id}`,
        heroId: c.id,
        heroName: c.name,
        what: 'title',
        label: t.title,
        url: `/title/${t.id}`,
        at,
      });
    }
  }

  // One per hero, newest first. A character in three things at once is a
  // franchise launch, and three notifications about the same person on the
  // same morning reads as a malfunction rather than as news.
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.at - a.at)
    .filter((a) => {
      if (seen.has(a.heroId)) return false;
      seen.add(a.heroId);
      return true;
    });
}
