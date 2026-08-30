// src/lib/events/announcementMatch.ts — is this video really ABOUT that title?
//
// `match_title_for_video` attaches a channel upload to a catalogue title by
// substring containment: normalise both sides, keep any title whose name appears
// anywhere in the video's, prefer the longest. That is the right shape for the
// problem and it is wrong in one specific, frequent way — a short catalogue name
// is a substring of a completely different work's name:
//
//   "Heroes of Might and Magic III Remake Reveal Trailer"  -> Heroes (TV, 2006)
//   "Stellar Blade Complete Edition - Action Trailer"      -> Blade (film, 1998)
//   "Aliens: Fireteam Elite 2 Launch Video"                -> Aliens (film, 1986)
//
// All three shipped on the Gamescom 2026 edition page on 2026-08-25, the first
// of them four times over, each carrying the cast of the TV series it had
// nothing to do with — Sylar and Claire Bennet under a Ubisoft strategy game.
//
// The test that separates them: a studio leads with the work's name and puts the
// ceremony after it. So the catalogue's name must be a PREFIX of the video's
// first segment, and whatever follows must be ceremony — "Official Trailer",
// "Season 3", "PS5 Games" — rather than more of a longer name. "Dead by
// Daylight - Chorus of Sin Launch Trailer" passes on its first segment;
// "Heroes of Might and Magic" fails because "of" is not ceremony.
//
// Colons are deliberately NOT segment breaks: "Aliens: Fireteam Elite 2" is one
// work's name, and splitting there is what let "Aliens" claim it.
//
// A studio attribution ("Marvel's Wolverine") is tried as well as, not instead
// of, the segment as written — because a possessive is just as often part of
// the work's own name: "No Man's Sky", "Another Crab's Treasure", "Widow's
// Bay". Stripping unconditionally cut those to "sky", "treasure" and "bay",
// which can never match themselves.
//
// Mirrored in SQL by `video_title_match_is_credible` so the record and the
// render agree — change both together.

/** Lowercase, '&' as 'and', everything else to single spaces. Same shape as the
 *  SQL `normalize_match_text`, which the matcher already applies to both sides. */
export function normalizeMatchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Words a studio appends to a work's name. Not vocabulary that can ever be part
 *  of the name itself — which is why "remake", "chronicles" and roman numerals
 *  are absent: those distinguish one work from another. */
const CEREMONY = [
  'official',
  'final',
  'new',
  'first',
  'look',
  'special',
  'sneak',
  'peek',
  'trailer',
  'teaser',
  'reveal',
  'launch',
  'announcement',
  'announce',
  'release',
  'date',
  'gameplay',
  'overview',
  'clip',
  'featurette',
  'preview',
  'extended',
  'spot',
  'promo',
  'full',
  'out',
  'now',
  'available',
  'streaming',
  'video',
  'games',
  'game',
  'hd',
  'uhd',
  '4k',
  'ps5',
  'ps4',
  'xbox',
  'pc',
  'switch',
  'steam',
  'nintendo',
];

/** Markers that carry a number: "Season 3", "Part 2", "Vol 1". The number is
 *  ceremony only here — a bare "IV" or "2" after a name is part of the name. */
const NUMBERED = ['season', 'series', 'part', 'chapter', 'volume', 'vol', 'episode', 'ep'];

const CEREMONY_RE = new RegExp(
  `^(?:(?:${NUMBERED.join('|')}) \\d+|(?:${CEREMONY.join('|')}))(?: |$)`,
);

/** True when nothing is left but the ceremony a studio stacks after a title. */
export function isCeremonyTail(tail: string): boolean {
  let rest = tail.trim();
  while (rest.length > 0) {
    const m = rest.match(CEREMONY_RE);
    if (!m) return false;
    rest = rest.slice(m[0].length).trim();
  }
  return true;
}

/** The first pipe- or dash-delimited segment, with bracketed asides removed.
 *  Colons are left alone on purpose. */
function rawSegment(videoTitle: string): string {
  const firstSegment = videoTitle.split(/[|–—]|\s-\s|\s-$/)[0];
  // Bracketed asides are ceremony wherever they sit: "[In the Studio]". CJK
  // brackets count — a Bandai upload is one long 【…】「…」 stack, and treating
  // them as text made two runs of the same promo land on opposite verdicts.
  return firstSegment.replace(/[[({【「][^\])}】」]*[\])}】」]/g, ' ');
}

/**
 * A studio attribution stacked in front of the work's name: "Marvel's
 * Wolverine", "Marvel Television's VisionQuest", "Marvel Studios' Avengers".
 *
 * Bounded to the two leading words. The unbounded form — everything up to the
 * first possessive anywhere in the segment — ate the work's own name instead:
 * "Star Wars: Smuggler's Gambit" became "Gambit", a 1993 film, and "Ellis &
 * Rory show Annie chivalry's not dead" became "Not Dead". A studio is never a
 * pronoun, which is how "It's", "Here's" and "Who's" stay out of it.
 */
const STUDIO_PREFIX_RE =
  /^(?!(?:it|he|she|they|we|you|there|that|this|here|who|what|let)['’]s\s)(?:[a-z0-9]+ )?[a-z0-9]+(?:['’]s|s['’])\s+/i;

/** The part of a video title that claims to be the work's name, as written. */
export function workSegment(videoTitle: string): string {
  return normalizeMatchText(rawSegment(videoTitle));
}

/** The same, with a studio attribution removed. Tried alongside `workSegment`,
 *  never instead of it — see the note at the top of the file. */
export function studioStrippedSegment(videoTitle: string): string {
  return normalizeMatchText(rawSegment(videoTitle).replace(STUDIO_PREFIX_RE, ''));
}

/** Does this segment lead with the name, and stack only ceremony after it? */
function segmentNamesTitle(segment: string, name: string): boolean {
  if (!segment) return false;
  if (segment === name) return true;
  // Prefix, at a word boundary — "blade" must not match inside "stellar blade",
  // and "hero" must not match inside "heroes".
  if (!segment.startsWith(`${name} `)) return false;
  return isCeremonyTail(segment.slice(name.length + 1));
}

/**
 * Does the catalogue title credibly name what this video is about?
 *
 * Returns true when the match cannot be judged — an announcement whose title row
 * carries no name is a data gap, and hiding rows over a missing name would throw
 * away good announcements to fix bad ones.
 */
export function matchIsCredible(videoTitle: string, titleName: string | null | undefined): boolean {
  if (!titleName) return true;
  const name = normalizeMatchText(titleName);
  if (!name) return true;
  return (
    segmentNamesTitle(workSegment(videoTitle), name) ||
    segmentNamesTitle(studioStrippedSegment(videoTitle), name)
  );
}
