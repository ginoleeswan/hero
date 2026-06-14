import { getHeroPortrayals } from '../../../src/lib/db/people';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

function mockRows(rows: unknown, error: unknown = null) {
  const inFn = jest.fn().mockResolvedValue({ data: rows, error });
  const eq = jest.fn(() => ({ in: inFn }));
  const select = jest.fn(() => ({ eq }));
  (supabase.from as jest.Mock).mockReturnValue({ select });
}

describe('getHeroPortrayals', () => {
  it('splits performers and voice actors', async () => {
    mockRows([
      { person_name: 'Michael Keaton', role: 'performer' },
      { person_name: 'Kevin Conroy', role: 'voice_actor' },
      { person_name: 'Robert Pattinson', role: 'performer' },
    ]);
    const out = await getHeroPortrayals('70');
    expect(supabase.from).toHaveBeenCalledWith('hero_people');
    expect(out.performers).toEqual(['Michael Keaton', 'Robert Pattinson']);
    expect(out.voiceActors).toEqual(['Kevin Conroy']);
  });

  it('returns empty arrays on error', async () => {
    mockRows(null, { message: 'boom' });
    expect(await getHeroPortrayals('1')).toEqual({ performers: [], voiceActors: [] });
  });
});
