// The variety engine — pure and seeded. Turns pre-fetched ad-safe data pools
// into a mixed batch of PlanEntries (angle × format), no repeats within a
// batch, deterministic per seed so a month can be regenerated identically.
import { suggestMusic } from '../music.mjs';

export function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Per-angle: consume the next unused pool item → { title, data, caption }.
const MAKERS = {
  matchup: (m) => ({
    title: `${m.a.name} vs ${m.b.name}`,
    data: m,
    caption: `${m.a.name} vs ${m.b.name} — who takes it? ⚔️\n\nRound by round, stat by stat. Cast your vote on mythique.app\n\n#whowouldwin #superheroes #comics #mythique`,
  }),
  ranking: (r) => ({
    title: `Top 10 ${r.label}`,
    data: r,
    caption: `The 10 ${r.label} characters, ranked. Who got robbed? 👇\n\nRanked by the Mythique fame & power data — mythique.app\n\n#top10 #superheroes #comics #ranking #mythique`,
  }),
  guess: (g) => ({
    title: `Guess the hero — ${g.name}`,
    data: g,
    caption: `Six stats. One legend. Who is it? 🤔\n\nAnswer in the last slide — 35,000+ more on mythique.app\n\n#guesswho #superheroes #quiz #comics #mythique`,
  }),
  fact: (f) => ({
    title: f.headline,
    data: f,
    caption: `${f.headline}. ${f.detail}\n\nExplore 35,000+ rated files on mythique.app\n\n#didyouknow #superheroes #comics #mythique`,
  }),
  lore: (e) => {
    if (e.sub === 'family') return {
      title: `${e.a} & ${e.b} — family`,
      data: e,
      caption: `${e.a} and ${e.b}: same blood, opposite sides. Nature or nurture? 👇\n\nThe whole family tree lives on mythique.app\n\n#comics #superheroes #lore #mythique`,
    };
    if (e.sub === 'rivalry') return {
      title: `${e.a} vs ${e.b} — rivalry`,
      data: e,
      caption: `${e.a} vs ${e.b}${e.year ? ` — enemies since ${e.year}` : ''}. The best rivalry in comics? Fight about it 👇\n\nmythique.app\n\n#comics #superheroes #rivalry #mythique`,
    };
    return {
      title: `Most connected — ${e.a}`,
      data: e,
      caption: `${e.a}: ${e.allies} allies, ${e.enemies} enemies, ${e.teams} teams. The most connected character in fiction?\n\nExplore the whole web — mythique.app\n\n#comics #superheroes #lore #mythique`,
    };
  },
};
const ANGLES = ['matchup', 'ranking', 'guess', 'fact', 'lore'];
const POOL_KEY = { matchup: 'matchups', ranking: 'rankings', guess: 'guesses', fact: 'facts', lore: 'lore' };
// music.mjs kinds: matchup|ranking|bio|brand|post — map guess/fact to fitting kinds.
const MUSIC_KIND = { matchup: 'matchup', ranking: 'ranking', guess: 'post', fact: 'brand', lore: 'brand' };

export function buildPlan({ n = 30, seed = 1, mix = { carousel: 18, reel: 12 }, pools }) {
  const rand = rng(seed);
  // shuffle each pool deterministically so different seeds pick different items
  const shuffled = {};
  for (const [k, arr] of Object.entries(pools)) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    shuffled[k] = a;
  }
  const cursors = { matchups: 0, rankings: 0, guesses: 0, facts: 0, lore: 0 };
  const next = (angle) => {
    const key = POOL_KEY[angle];
    const arr = shuffled[key];
    if (cursors[key] >= arr.length) return null; // pool exhausted
    return arr[cursors[key]++];
  };

  // format sequence: scale mix to n, interleave so both formats spread out
  const total = mix.carousel + mix.reel;
  const nCar = Math.round((n * mix.carousel) / total);
  const formats = [];
  let c = 0, r = 0;
  for (let i = 0; i < n; i++) {
    // keep the running ratio close to the target
    if (c * (n - nCar) <= r * nCar && c < nCar) { formats.push('carousel'); c++; }
    else { formats.push('reel'); r++; }
  }

  const entries = [];
  // Separate round-robin angle cursors per format stream: each stream cycles
  // through ALL angles independently, so any stream with >= ANGLES.length
  // entries and live pools structurally covers every angle in that format —
  // no reliance on the interleaved global order lining up by luck.
  const streamAngleCursor = {
    carousel: Math.floor(rand() * ANGLES.length),
    reel: Math.floor(rand() * ANGLES.length),
  };
  for (let i = 0; i < n; i++) {
    const format = formats[i];
    const ai = streamAngleCursor[format];
    // round-robin angles within this format's stream, skipping exhausted pools
    let item = null, angle = null;
    for (let tries = 0; tries < ANGLES.length && !item; tries++) {
      angle = ANGLES[(ai + tries) % ANGLES.length];
      item = next(angle);
    }
    if (!item) break; // all pools exhausted
    streamAngleCursor[format] = (ANGLES.indexOf(angle) + 1) % ANGLES.length;
    const made = MAKERS[angle](item);
    entries.push({
      ord: entries.length + 1,
      angle,
      format: formats[i],
      title: made.title,
      data: made.data,
      caption: made.caption,
      music: suggestMusic(MUSIC_KIND[angle], made.title),
    });
  }
  return entries;
}
