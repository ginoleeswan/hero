import { groupComicRows, getNewComics, type NewComicRow } from '../../../src/lib/db/comics';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const row = (issue: string, hero: string, extra: Partial<NewComicRow> = {}): NewComicRow => ({
  issue_id: issue,
  volume_name: 'Batman',
  issue_number: '155',
  cover_url: 'http://x/c.jpg',
  store_date: '2026-06-25',
  publisher: 'DC',
  max_fame: 80,
  hero_id: hero,
  hero_name: hero,
  hero_image_url: null,
  hero_portrait_url: null,
  ...extra,
});

describe('groupComicRows', () => {
  it('groups flat rows into issues, preserving row order for characters', () => {
    const out = groupComicRows([
      row('cvi:1', 'Batman'),
      row('cvi:1', 'Robin'),
      row('cvi:2', 'Storm', { volume_name: 'X-Men', issue_number: '40' }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: 'cvi:1',
      volumeName: 'Batman',
      issueNumber: '155',
      coverUrl: 'http://x/c.jpg',
      storeDate: '2026-06-25',
      publisher: 'DC',
      description: null,
      storyTitle: null,
      creators: null,
      characters: [
        { id: 'Batman', name: 'Batman', image_url: null, portrait_url: null },
        { id: 'Robin', name: 'Robin', image_url: null, portrait_url: null },
      ],
    });
    expect(out[1].id).toBe('cvi:2');
    expect(out[1].characters.map((c) => c.id)).toEqual(['Storm']);
  });

  it('returns [] for no rows', () => {
    expect(groupComicRows([])).toEqual([]);
  });
});

describe('getNewComics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls the RPC with the limit and groups the result', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: [row('cvi:1', 'Batman')], error: null });
    const out = await getNewComics(12);
    expect(supabase.rpc).toHaveBeenCalledWith('get_new_comics', { p_limit: 12 });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('cvi:1');
  });

  it('degrades to [] on error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await getNewComics()).toEqual([]);
  });
});
