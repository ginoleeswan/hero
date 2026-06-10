// __tests__/lib/family/parity.test.ts
import { parseRelatives as srcParse } from '../../../src/lib/family/parseRelatives';
import { classifyRole as srcClassify } from '../../../src/lib/family/classifyRole';
import {
  parseRelatives as shParse,
  classifyRole as shClassify,
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

  it.each(['father', 'adoptive mother', 'grandson', 'ex-wife', 'partial clone', 'fiancée', 'alleged descendants'])(
    'classifyRole matches for: %s',
    (role) => {
      expect(shClassify(role)).toEqual(srcClassify(role));
    },
  );
});
