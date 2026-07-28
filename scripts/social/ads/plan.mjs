// The variety engine — pure and seeded. Turns pre-fetched ad-safe data pools
// into a mixed batch of PlanEntries (angle × format), no repeats within a
// batch, deterministic per seed so a month can be regenerated identically.
import { suggestMusic } from '../music.mjs';

export function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Scenario framings for matchup hooks — the paid data (Jul '26 promotes) showed
// a scenario question ("Who runs the city?") out-clicking plain "who wins" by a
// wide margin, so matchup captions rotate through stakes-framed hooks. Picked
// deterministically per pair (name hash) so regenerating a batch is stable.
const MATCHUP_HOOKS = [
  'who takes it? ⚔️',
  'one city. one throne. who runs it? 👀',
  'last one standing walks away — who is it? 🥊',
  'everything on the line. who wins? ⚡',
  'no prep, no help, right now — who survives? 🔥',
];
const matchupHook = (a, b) => {
  let h = 0;
  for (const ch of a + '|' + b) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MATCHUP_HOOKS[h % MATCHUP_HOOKS.length];
};

// Per-angle: consume the next unused pool item → { title, data, caption }.
const MAKERS = {
  matchup: (m) => ({
    title: `${m.a.name} vs ${m.b.name}`,
    data: m,
    caption: `${m.a.name} vs ${m.b.name} — ${matchupHook(m.a.name, m.b.name)}\n\nRound by round, stat by stat. Cast your vote on mythique.app\n\n#whowouldwin #superheroes #comics #mythique`,
  }),
  ranking: (r) => ({
    title: `Top 10 ${r.label}`,
    data: r,
    caption: `The 10 ${r.label} characters, ranked. Who got robbed? 👇\n\nRanked by the Mythique fame & power data — mythique.app\n\n#top10 #superheroes #comics #ranking #mythique`,
  }),
  guess: (g) => ({
    title: `Guess the hero — ${g.name}`,
    data: g,
    // The stat line makes every guess caption UNIQUE without naming the answer
    // — identical captions made these posts impossible to caption-match back
    // to their analytics (five early guess posts shared one caption and their
    // results could never be attributed).
    caption: `Six stats. One legend. Who is it? 🤔\n\n🧠 ${g.stats.intelligence} · 💪 ${g.stats.strength} · ⚡ ${g.stats.speed} · 🛡️ ${g.stats.durability} · 🔥 ${g.stats.power} · 🥊 ${g.stats.combat}\n\nAnswer in the last slide — 35,000+ more on mythique.app\n\n#guesswho #superheroes #quiz #comics #mythique`,
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
// Weighted angle cycle — matchup appears 3× per 7 slots (~43%) because the paid
// promote data shows pick-a-side matchups are the click winner (TikTok's own
// budget allocator fed them 51% of spend); every other angle still appears once
// per cycle so a batch keeps full variety. When the matchup pool runs dry the
// round-robin skips to the next live angle, so a heavier weight can never stall
// a batch. Re-tune by editing this list as new performance data lands.
const ANGLES = ['matchup', 'ranking', 'matchup', 'guess', 'fact', 'matchup', 'lore'];
const POOL_KEY = { matchup: 'matchups', ranking: 'rankings', guess: 'guesses', fact: 'facts', lore: 'lore' };
// music.mjs kinds: matchup|ranking|bio|brand|post — map guess/fact to fitting kinds.
const MUSIC_KIND = { matchup: 'matchup', ranking: 'ranking', guess: 'post', fact: 'brand', lore: 'brand' };

export function buildPlan({ n = 30, seed = 1, mix = { carousel: 18, reel: 12 }, pools, angles }) {
  const rand = rng(seed);
  // Optional measured override of the static ANGLES cycle (see weights.mjs —
  // derived from social_post_results medians). Only known angles survive; an
  // empty/invalid override falls back to the static cycle.
  const cycle = (angles ?? []).filter((a) => a in POOL_KEY);
  const ANGLE_CYCLE = cycle.length ? cycle : ANGLES;
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
  // through ALL angles independently, so any stream with >= ANGLE_CYCLE.length
  // entries and live pools structurally covers every angle in that format —
  // no reliance on the interleaved global order lining up by luck.
  const streamAngleCursor = {
    carousel: Math.floor(rand() * ANGLE_CYCLE.length),
    reel: Math.floor(rand() * ANGLE_CYCLE.length),
  };
  for (let i = 0; i < n; i++) {
    const format = formats[i];
    const ai = streamAngleCursor[format];
    // round-robin the weighted cycle within this format's stream, skipping
    // exhausted pools. Track the CYCLE POSITION (idx), not indexOf(angle) —
    // the cycle repeats 'matchup', and indexOf would always resolve to its
    // first slot, collapsing the rotation.
    let item = null, angle = null, idx = ai;
    for (let tries = 0; tries < ANGLE_CYCLE.length && !item; tries++) {
      idx = (ai + tries) % ANGLE_CYCLE.length;
      angle = ANGLE_CYCLE[idx];
      item = next(angle);
    }
    if (!item) break; // all pools exhausted
    streamAngleCursor[format] = (idx + 1) % ANGLE_CYCLE.length;
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
