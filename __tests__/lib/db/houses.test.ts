import { searchHouses } from '../../../src/lib/db/houses';
import { supabase } from '../../../src/lib/supabase';

jest.mock('../../../src/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const ROWS = [
  {
    slug: 'targaryen',
    name: 'House Targaryen',
    universe: 'Game of Thrones',
    seat: 'Dragonstone',
    words: 'Fire and Blood',
    sigil_tint: '#8c1c13',
    house_members: [{ count: 55 }],
  },
  {
    slug: 'tully',
    name: 'House Tully',
    universe: 'Game of Thrones',
    seat: 'Riverrun',
    words: null,
    sigil_tint: '#8f2c2c',
    house_members: [{ count: 11 }],
  },
  {
    slug: 'tyrell',
    name: 'House Tyrell',
    universe: 'Game of Thrones',
    seat: 'Highgarden',
    words: null,
    sigil_tint: '#3f7d44',
    house_members: [{ count: 6 }],
  },
  {
    slug: 'stark',
    name: 'House Stark',
    universe: 'Game of Thrones',
    seat: 'Winterfell',
    words: null,
    sigil_tint: '#5b6770',
    house_members: [],
  },
];

function mockRows(rows: unknown[], error: { message: string } | null = null) {
  (supabase.from as jest.Mock).mockReturnValue({
    select: jest.fn().mockResolvedValue({ data: rows, error }),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('searchHouses', () => {
  it('matches the bare surname, which is what people type', async () => {
    mockRows(ROWS);
    const out = await searchHouses('targaryen');
    expect(out[0].slug).toBe('targaryen');
    // The stored name is "House Targaryen" — an exact hit on the surname still
    // counts as exact, or the top-result row would never fire for a house.
    expect(out[0].exact).toBe(true);
  });

  it('matches the full stored style too', async () => {
    mockRows(ROWS);
    const out = await searchHouses('house stark');
    expect(out[0].slug).toBe('stark');
    expect(out[0].exact).toBe(true);
  });

  it('ranks a prefix hit above a mere substring hit', async () => {
    mockRows(ROWS);
    // "targaryen" starts with "tar"; "stark" only contains it.
    expect((await searchHouses('tar')).map((h) => h.slug)).toEqual(['targaryen', 'stark']);
  });

  it('breaks ties by size — the bigger tree is the better guess', async () => {
    mockRows(ROWS);
    // Targaryen / Tully / Tyrell all prefix-match "t" and sort by member count;
    // Stark trails on the weaker substring match.
    expect((await searchHouses('t')).map((h) => h.slug)).toEqual([
      'targaryen',
      'tully',
      'tyrell',
      'stark',
    ]);
  });

  it('is case- and separator-insensitive', async () => {
    mockRows(ROWS);
    const out = await searchHouses('  HOUSE-TARGARYEN ');
    expect(out[0].slug).toBe('targaryen');
    expect(out[0].exact).toBe(true);
  });

  it('reads the member count out of the embedded aggregate', async () => {
    mockRows(ROWS);
    const out = await searchHouses('targaryen');
    expect(out[0].memberCount).toBe(55);
  });

  it('treats a missing aggregate as zero rather than crashing', async () => {
    mockRows(ROWS);
    const out = await searchHouses('stark');
    expect(out[0].memberCount).toBe(0);
  });

  it('returns nothing for an empty query without hitting the network', async () => {
    mockRows(ROWS);
    expect(await searchHouses('   ')).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('degrades to empty on error instead of throwing into the search screen', async () => {
    mockRows([], { message: 'boom' });
    expect(await searchHouses('targaryen')).toEqual([]);
  });

  it('honours the limit', async () => {
    mockRows(ROWS);
    expect(await searchHouses('house', 2)).toHaveLength(2);
  });
});
