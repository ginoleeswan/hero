// __tests__/lib/family/parity.test.ts
import { parseRelatives as srcParse } from '../../../src/lib/family/parseRelatives';
import { classifyRole as srcClassify } from '../../../src/lib/family/classifyRole';
import { resolveKinship as srcResolve } from '../../../src/lib/family/resolveKinship';
import {
  parseRelatives as shParse,
  classifyRole as shClassify,
  resolveKinship as shResolve,
} from '../../../supabase/functions/_shared/family';

const FIXTURES = [
  'Bruce Wayne (biological father), Warren McGinnis (father, deceased), Mary McGinnis (mother), Matt McGinnis (brother)',
  'Lois Lane (wife), Jor-El (father, deceased), Supergirl (Kara Zor-El, cousin), Superboy (Kon-El/Conner Kent, partial clone)',
  'Jarvis Pennyworth (father, deceased); Bruce Wayne (Batman, legal ward)',
  'King Snake (father)',
  'Duela Dent (Daughter), Gilda Dent (Wife), Poison Ivy (Fiancée)',
];

describe('src vs _shared parity', () => {
  it.each(FIXTURES)('parseRelatives matches for: %s', (raw) => {
    expect(shParse(raw)).toEqual(srcParse(raw));
  });

  it.each([
    'father',
    'adoptive mother',
    'grandson',
    'ex-wife',
    'partial clone',
    'fiancée',
    'alleged descendants',
  ])('classifyRole matches for: %s', (role) => {
    expect(shClassify(role)).toEqual(srcClassify(role));
  });

  it('resolveKinship matches between src and _shared', () => {
    const nodes = [
      { id: 'f', relation: 'parent' as const, role: 'father', modifiers: [] },
      { id: 'm', relation: 'parent' as const, role: 'mother', modifiers: [] },
      { id: 'gf', relation: 'grandparent' as const, role: 'paternal grandfather', modifiers: [] },
      { id: 'u', relation: 'aunt_uncle' as const, role: 'uncle', modifiers: [] },
      { id: 'c', relation: 'cousin' as const, role: 'cousin', modifiers: [] },
    ];
    expect([...shResolve(nodes).entries()]).toEqual([...srcResolve(nodes).entries()]);
  });
});
