import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSafeHero, distinctive, buildRounds } from './data.mjs';

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
