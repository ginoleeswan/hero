import { buildNarrative } from '../../../src/lib/db/heroFacts';

describe('buildNarrative', () => {
  it('orders did_you_know by position and maps explainers/era/tags', () => {
    const facts = [
      { kind: 'did_you_know', content: 'Second', subject: null, position: 1 },
      { kind: 'did_you_know', content: 'First', subject: null, position: 0 },
      { kind: 'power_explainer', content: 'Lets them fly.', subject: 'Flight', position: null },
      { kind: 'era_summary', content: 'A Bronze Age icon.', subject: null, position: null },
    ];
    const tags = [
      { tag: 'anti-hero', hero_tag_vocab: { label: 'Anti-hero', category: 'archetype' } },
    ];

    const n = buildNarrative(facts, tags);

    expect(n.didYouKnow).toEqual(['First', 'Second']);
    expect(n.powerExplainers).toEqual([{ power: 'Flight', text: 'Lets them fly.' }]);
    expect(n.eraSummary).toBe('A Bronze Age icon.');
    expect(n.tags).toEqual([{ slug: 'anti-hero', label: 'Anti-hero', category: 'archetype' }]);
    expect(n.isEmpty).toBe(false);
  });

  it('drops power explainers with no subject and reports empty', () => {
    const n = buildNarrative(
      [{ kind: 'power_explainer', content: 'orphan', subject: null, position: null }],
      [],
    );
    expect(n.powerExplainers).toEqual([]);
    expect(n.eraSummary).toBeNull();
    expect(n.isEmpty).toBe(true);
  });

  it('falls back to slug when a tag has no vocab label', () => {
    const n = buildNarrative([], [{ tag: 'mutant', hero_tag_vocab: null }]);
    expect(n.tags).toEqual([{ slug: 'mutant', label: 'mutant', category: 'archetype' }]);
  });
});
