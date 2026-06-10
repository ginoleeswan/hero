// __tests__/lib/family/classifyRole.test.ts
import { classifyRole } from '../../../src/lib/family/classifyRole';

describe('classifyRole', () => {
  it('maps parents to tier +1', () => {
    expect(classifyRole('father')).toMatchObject({ relation: 'parent', tier: 1 });
    expect(classifyRole('mother')).toMatchObject({ relation: 'parent', tier: 1 });
  });

  it('captures adoptive/step/foster/half modifiers', () => {
    expect(classifyRole('adoptive father')).toMatchObject({ relation: 'parent', modifiers: ['adoptive'] });
    expect(classifyRole('foster daughter')).toMatchObject({ relation: 'child', modifiers: ['foster'] });
    expect(classifyRole('half-brother')).toMatchObject({ relation: 'sibling', modifiers: ['half'] });
  });

  it('does not confuse grandfather with father', () => {
    expect(classifyRole('grandfather')).toMatchObject({ relation: 'grandparent', tier: 2 });
    expect(classifyRole('paternal grandfather')).toMatchObject({ relation: 'grandparent', tier: 2 });
  });

  it('does not confuse grandson with son', () => {
    expect(classifyRole('grandson')).toMatchObject({ relation: 'grandchild', tier: -2 });
  });

  it('routes great-grandparents and ancestors to tier +2 ancestor', () => {
    expect(classifyRole('great-grandfather')).toMatchObject({ relation: 'ancestor', tier: 2 });
    expect(classifyRole('ancestor')).toMatchObject({ relation: 'ancestor', tier: 2 });
  });

  it('routes in-laws before parents/siblings', () => {
    expect(classifyRole('mother-in-law')).toMatchObject({ relation: 'in_law', tier: 0 });
    expect(classifyRole('sister-in-law')).toMatchObject({ relation: 'in_law', tier: 0 });
  });

  it('handles spouse with ex → formerly status', () => {
    expect(classifyRole('wife')).toMatchObject({ relation: 'spouse', tier: 0, status: null });
    expect(classifyRole('ex-wife')).toMatchObject({ relation: 'spouse', status: 'formerly' });
  });

  it('detects deceased status without changing tier', () => {
    expect(classifyRole('father, deceased')).toMatchObject({ relation: 'parent', tier: 1, status: 'deceased' });
  });

  it('routes clones to the aside tier 9', () => {
    expect(classifyRole('clone')).toMatchObject({ relation: 'clone', tier: 9 });
    expect(classifyRole('partial clone')).toMatchObject({ relation: 'clone', tier: 9 });
  });

  it('falls back to other/tier 0 for unknown roles', () => {
    expect(classifyRole('fiancée')).toMatchObject({ relation: 'other', tier: 0 });
    expect(classifyRole('')).toMatchObject({ relation: 'other', tier: 0 });
  });

  it('routes aunts/uncles, cousins, nieces/nephews', () => {
    expect(classifyRole('aunt')).toMatchObject({ relation: 'aunt_uncle', tier: 1 });
    expect(classifyRole('cousin')).toMatchObject({ relation: 'cousin', tier: 0 });
    expect(classifyRole('nephew')).toMatchObject({ relation: 'niece_nephew', tier: -1 });
  });

  it('places descendants below the hero, not above', () => {
    expect(classifyRole('alleged descendants')).toMatchObject({ relation: 'grandchild', tier: -2 });
  });
});
