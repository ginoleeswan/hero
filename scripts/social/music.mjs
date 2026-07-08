// Music/audio direction per post — a concrete, searchable suggestion for the
// person posting (IG Reels/feed + TikTok pick audio in-app, so this is guidance
// text, not a baked track). Kind sets the base direction; title keywords refine
// it (anime matchups want anime-edit sounds, horror-adjacent bios want dread).
// Suggestions name a *search term* on purpose: trending audio rotates weekly,
// so "search X, pick a trending result" outlives any hardcoded track.

const BY_KIND = {
  matchup:
    'Battle-edit audio — search "phonk edit" and pick a trending sound; hard beat drop on the VS slide',
  ranking:
    'Countdown energy — search "epic countdown" or trending "top 10" sounds; one beat per rank slide',
  bio: 'Dark cinematic underscore — search "villain edit audio" or moody ambient; low and steady',
  brand: 'Clean synthwave / lo-fi tech — search "synthwave loop"; calm, product-demo energy',
  post: 'Trending sound in the comics/anime edit niche — pick from the current audio charts',
};

// Title keywords that override the kind default (checked in order).
const BY_TITLE = [
  [/goku|naruto|luffy|saitama|anime/i, 'Anime-edit sound — search "anime phonk edit"; sync the drop to the VS/reveal slide'],
  [/villain|dark|evil/i, 'Menace underscore — search "dark villain edit audio"; let it brood, no drop needed'],
  [/strongest|power|top 10/i, 'Hype countdown — search "epic orchestral countdown"; escalate toward #1'],
];

/** One-line audio direction for a post. Kind default, sharpened by title. */
export function suggestMusic(kind, title = '') {
  for (const [re, s] of BY_TITLE) if (re.test(title)) return s;
  return BY_KIND[kind] ?? BY_KIND.post;
}
