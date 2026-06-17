export interface HeroHints {
  name: string;
  aliases: string[];
  publisher: string | null;
  firstAppearanceYear: number | null;
  creators: string[];
}

export interface QidCandidate {
  qid: string;
  label: string;
  description: string | null;
  publisherLabels: string[];
  inceptionYear: number | null;
  creatorLabels: string[];
}

export interface ScoredCandidate {
  qid: string;
  score: number;
}

export type ResolutionTier = 'resolved' | 'ambiguous' | 'unresolved';

export interface ResolutionOutcome {
  tier: ResolutionTier;
  qid: string | null;
  candidates: ScoredCandidate[];
}

// Tuned for precision: a clear winner needs a strong score AND separation from
// the runner-up; weak-but-plausible goes to manual review; the rest are dropped.
export const STRONG = 0.6;
export const GAP = 0.25;
export const WEAK = 0.35;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const tokenSet = (s: string) => new Set(norm(s).split(' ').filter(Boolean));
const surname = (s: string) => norm(s).split(' ').filter(Boolean).pop() ?? '';
const GENERIC_PUB = new Set(['comics', 'entertainment', 'group', 'inc', 'the']);

// Wikidata rarely puts the real publisher (P123) on a character; P1080 returns the
// fictional UNIVERSE instead ("Prime Earth", "Earth-616", …). Map the common
// universes to their publisher token so the publisher signal isn't lost — the
// single biggest reason marquee DC/Marvel characters were going unresolved. Keys
// are in norm() form (non-alphanumerics → spaces).
const UNIVERSE_PUBLISHER: Record<string, string> = {
  'prime earth': 'dc',
  'new earth': 'dc',
  'dc universe': 'dc',
  'earth two': 'dc',
  'earth one': 'dc',
  'earth 0': 'dc',
  'dc extended universe': 'dc',
  arrowverse: 'dc',
  'marvel universe': 'marvel',
  'earth 616': 'marvel',
  'earth 1610': 'marvel',
  'ultimate marvel': 'marvel',
  'marvel cinematic universe': 'marvel',
};

function publisherMatch(heroPub: string | null, labels: string[]): boolean {
  if (!heroPub) return false;
  const ht = [...tokenSet(heroPub)].filter((t) => !GENERIC_PUB.has(t));
  if (ht.length === 0) return false;
  return labels.some((l) => {
    const mapped = UNIVERSE_PUBLISHER[norm(l)];
    if (mapped && ht.includes(mapped)) return true;
    const lt = tokenSet(l);
    return ht.some((t) => lt.has(t));
  });
}

function creatorOverlap(heroCreators: string[], candCreators: string[]): boolean {
  if (heroCreators.length === 0 || candCreators.length === 0) return false;
  const hs = new Set(heroCreators.map(surname).filter(Boolean));
  return candCreators.some((c) => hs.has(surname(c)));
}

export function scoreCandidate(hero: HeroHints, c: QidCandidate): number {
  let score = 0;
  if (norm(c.label) === norm(hero.name)) score += 0.2;
  else if (hero.aliases.some((a) => norm(a) === norm(c.label))) score += 0.1;

  if (publisherMatch(hero.publisher, c.publisherLabels)) score += 0.4;
  else if (c.description && publisherMatch(hero.publisher, [c.description])) score += 0.15;

  if (hero.firstAppearanceYear != null && c.inceptionYear != null) {
    const d = Math.abs(hero.firstAppearanceYear - c.inceptionYear);
    if (d <= 2) score += 0.2;
    else if (d <= 5) score += 0.1;
  }

  if (creatorOverlap(hero.creators, c.creatorLabels)) score += 0.25;
  return score;
}

export function resolveHero(hero: HeroHints, candidates: QidCandidate[]): ResolutionOutcome {
  if (candidates.length === 0) return { tier: 'unresolved', qid: null, candidates: [] };
  const scored: ScoredCandidate[] = candidates
    .map((c) => ({ qid: c.qid, score: scoreCandidate(hero, c) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];
  const gapOk = !second || top.score - second.score >= GAP;
  const topCandidates = scored.slice(0, 3);
  if (top.score >= STRONG && gapOk)
    return { tier: 'resolved', qid: top.qid, candidates: topCandidates };
  if (top.score >= WEAK) return { tier: 'ambiguous', qid: null, candidates: topCandidates };
  return { tier: 'unresolved', qid: null, candidates: topCandidates };
}
