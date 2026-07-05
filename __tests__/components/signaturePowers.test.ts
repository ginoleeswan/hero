import { pickSignaturePowers } from '../../src/components/character/SignaturePowers';

const EXPL = [
  { power: 'Flight', text: 'Defies gravity.' },
  { power: 'Heat Vision', text: 'Eyes like lasers.' },
];

describe('pickSignaturePowers', () => {
  it('selects only explainer-backed powers, in power order, capped at 4', () => {
    const powers = ['Agility', 'Flight', 'Stamina', 'Heat Vision', 'Healing'];
    const r = pickSignaturePowers(powers, EXPL);
    expect(r).toEqual([
      { name: 'Flight', blurb: 'Defies gravity.' },
      { name: 'Heat Vision', blurb: 'Eyes like lasers.' },
    ]);
  });
  it('caps at 4 tiles for one balanced row', () => {
    const powers = ['A', 'B', 'C', 'D', 'E'];
    const expl = powers.map((p) => ({ power: p, text: `about ${p}` }));
    expect(pickSignaturePowers(powers, expl)).toHaveLength(4);
  });
  it('matches explainers case-insensitively', () => {
    const r = pickSignaturePowers(['flight'], [{ power: 'FLIGHT', text: 'Zoom.' }]);
    expect(r[0].blurb).toBe('Zoom.');
  });
  it('returns [] with no explainers or no powers — a tile without a story is a dead box', () => {
    expect(pickSignaturePowers(['Flight', 'Agility'], [])).toEqual([]);
    expect(pickSignaturePowers(null, EXPL)).toEqual([]);
  });
});
