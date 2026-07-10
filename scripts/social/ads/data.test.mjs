import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSafeHero, distinctive, buildRounds, factFromRow, relationPhrase } from './data.mjs';

const row = { id: 'h_1', name: 'Goku', publisher: 'Shueisha', fame_score: 97,
  portrait_url: 'https://res.cloudinary.com/x.png', image_url: 'https://x/y.jpg', image_md_url: null,
  intelligence: 56, strength: 90, speed: 95, durability: 90, power: 98, combat: 100 };

test('toSafeHero strips every image/id field and keeps name+stats+tier', () => {
  const h = toSafeHero(row);
  assert.equal(h.name, 'Goku');
  assert.equal(h.tier, 'S'); // Shueisha
  assert.equal(h.stats.speed, 95);
  for (const k of ['id', 'portrait_url', 'image_url', 'image_md_url', 'publisher'])
    assert.ok(!(k in h), `${k} must not leak`);
});

test('distinctive requires a max-min stat spread >= 30', () => {
  assert.equal(distinctive(toSafeHero(row)), true); // 100-56 = 44
  const flat = toSafeHero({ ...row, intelligence: 80, strength: 82, speed: 84, durability: 80, power: 81, combat: 83 });
  assert.equal(distinctive(flat), false);
});

test('buildRounds returns 3-4 contrasting stat rounds with real values', () => {
  const b = toSafeHero({ ...row, name: 'Superman', publisher: 'DC Comics', intelligence: 94, strength: 100, speed: 100, durability: 100, power: 100, combat: 85 });
  const rounds = buildRounds(toSafeHero(row), b);
  assert.ok(rounds.length >= 3 && rounds.length <= 4);
  for (const [label, av, bv] of rounds) {
    assert.equal(typeof label, 'string');
    assert.ok(av > 0 && bv > 0);
  }
});

test('factFromRow builds a punchy headline + full detail, no stat', () => {
  const f = factFromRow({ name: 'Solomon Grundy', subject: 'origin',
    content: 'He began as Cyrus Gold, a wealthy merchant murdered and dumped in Slaughter Swamp in the 19th century.' });
  assert.equal(f.stat, null);
  assert.ok(f.headline.length > 0 && f.headline.length <= 60);
  assert.match(f.detail, /Cyrus Gold/);
  // headline must NOT be a truncated mid-sentence fragment ending in a bare word+ellipsis
  assert.ok(!/\w…$/.test(f.headline) || f.headline.includes(' '));
});

test('factFromRow carries the hero name into the headline or detail', () => {
  const f = factFromRow({ name: 'Snake Eyes', subject: null,
    content: 'Snake Eyes is a G.I. Joe commando who stayed with a burning wreck to save a wolf pup.' });
  assert.ok(f.headline.includes('Snake Eyes') || f.detail.includes('Snake Eyes'));
});

test('factFromRow rotates hooks deterministically across a set of contents', () => {
  const contents = [
    'Alpha origin story about a hero who once fell from the sky.',
    'Bravo tale of a villain who never sleeps and always wins.',
    'Charlie legend of a sidekick who saved the day twice.',
    'Delta myth about a warrior forged in starlight and iron.',
    'Echo chronicle of a trickster who rewired an entire timeline.',
    'Foxtrot saga of a knight who traded his shadow for power.',
    'Golf report on a scientist who split the atom by accident.',
    'Hotel record of a pilot who crash-landed on a moon of Saturn.',
  ];
  const hooks = contents.map((content) => factFromRow({ name: 'Test Hero', subject: null, content }).hook);
  const allowed = ['WAIT — WHAT?', "MOST PEOPLE DON'T KNOW THIS", 'DID YOU KNOW', null];
  for (const h of hooks) assert.ok(allowed.includes(h), `unexpected hook: ${h}`);
  assert.ok(new Set(hooks).size >= 2, 'expected at least 2 distinct hooks across varied contents');
  // determinism: same content always yields the same hook
  const again = factFromRow({ name: 'Test Hero', subject: null, content: contents[0] }).hook;
  assert.equal(again, hooks[0]);
});

test('relationPhrase maps every relation enum to human copy', () => {
  for (const [k, re] of [['parent',/parent/],['child',/child/],['sibling',/sibling/],['aunt_uncle',/aunt/],['other',/family/]])
    assert.match(relationPhrase(k), re);
});

test('fetchLore family: relative owns the relation slot, both-famous + enemy-edge gated, spouse excluded, no image fields', async () => {
  const { fetchLore } = await import('./data.mjs');
  const H = (id, name, fame, gender = 'Male', alignment = 'good') => ({ id, name, fame_score: fame, gender, alignment });
  const handlers = {
    hero_relatives: [
      // hero=Luke, related=Vader, relation='parent' ⇒ VADER is Luke's parent.
      { relation: 'parent', heroes: H('h1', 'Luke', 80), related: H('h2', 'Vader', 85, 'Male', 'bad') },
      { relation: 'spouse', heroes: H('h3', 'Reed', 60), related: H('h4', 'Sue', 62, 'Female') }, // spouse: excluded
      { relation: 'sibling', heroes: H('h5', 'Thor', 90), related: H('h6', 'NobodyBro', 5) }, // b-side not famous
      { relation: 'sibling', heroes: H('h7', 'Ally', 70), related: H('h8', 'AllySis', 70, 'Female') }, // famous but NO enemy edge
    ],
    hero_relationships: (q) => q.includes('kind=eq.enemy')
      ? [{ hero_id: 'h1', related_id: 'h2' }] // Luke↔Vader are enemies; h7/h8 are not
      : [],
    heroes: [],
    hero_narrative_facts: [],
  };
  const sb = { rest: async (q) => { const k = q.split('?')[0]; const h = handlers[k]; return typeof h === 'function' ? h(q) : (h ?? []); } };
  const lore = await fetchLore(sb, () => 0.5);
  const family = lore.filter((e) => e.sub === 'family');
  assert.equal(family.length, 1, 'only the famous enemy-linked blood pair survives');
  const f = family[0];
  // Direction: copy renders "<a> is the <relation> of <b>" — Vader is the parent of Luke.
  assert.equal(f.a, 'Vader');
  assert.equal(f.b, 'Luke');
  assert.equal(f.relation, 'parent');
  assert.deepEqual(f.aHint, { gender: 'Male', alignment: 'bad' });
  for (const key of Object.keys(f)) assert.ok(!/url|image|portrait/i.test(key), `no image-ish field: ${key}`);
});
