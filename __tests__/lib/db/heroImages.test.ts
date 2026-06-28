import { getHeroImages } from '../../../src/lib/db/heroImages';

let mockResolvers: Record<string, { data: unknown; error: unknown }> = {};

jest.mock('../../../src/lib/supabase', () => {
  const makeChain = (tableName: string) => {
    const methods = ['select', 'eq', 'order'];
    const c: Record<string, unknown> = {};
    methods.forEach((m) => {
      c[m] = jest.fn().mockReturnValue(c);
    });
    c.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }).then(resolve);
    return c;
  };
  const chains: Record<string, ReturnType<typeof makeChain>> = {};
  const mockFrom = jest.fn().mockImplementation((tableName: string) => {
    if (!chains[tableName]) chains[tableName] = makeChain(tableName);
    return chains[tableName];
  });
  return { supabase: { from: mockFrom }, __chains: chains, __mockFrom: mockFrom };
});

const { __chains: chains, __mockFrom: mockFrom } = jest.requireMock(
  '../../../src/lib/supabase',
) as {
  __chains: Record<string, Record<string, jest.Mock>>;
  __mockFrom: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockResolvers = {};
  Object.values(chains).forEach((c) => {
    ['select', 'eq', 'order'].forEach((m) => c[m].mockReturnValue(c));
  });
  mockFrom.mockImplementation((tableName: string) => {
    if (!chains[tableName]) {
      const methods = ['select', 'eq', 'order'];
      const c: Record<string, unknown> = {};
      methods.forEach((m) => {
        c[m] = jest.fn().mockReturnValue(c);
      });
      c.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(mockResolvers[tableName] ?? { data: null, error: null }).then(resolve);
      chains[tableName] = c as Record<string, jest.Mock>;
    }
    return chains[tableName];
  });
});

test('maps rows to HeroImage and preserves DB order', async () => {
  mockResolvers['hero_images'] = {
    data: [
      { url: 'a.jpg', caption: 'Hero', source: 'comicvine_primary', issue_id: null },
      { url: 'b.jpg', caption: 'Issue 1', source: 'comicvine_cover', issue_id: '4000-1' },
    ],
    error: null,
  };
  const result = await getHeroImages('h_x');
  expect(result).toEqual([
    { url: 'a.jpg', caption: 'Hero', source: 'comicvine_primary', issueId: null },
    { url: 'b.jpg', caption: 'Issue 1', source: 'comicvine_cover', issueId: '4000-1' },
  ]);
  expect(chains['hero_images'].eq).toHaveBeenCalledWith('hero_id', 'h_x');
  expect(chains['hero_images'].order).toHaveBeenCalledWith('sort_order', { ascending: true });
});

test('returns [] on error', async () => {
  mockResolvers['hero_images'] = { data: null, error: { message: 'boom' } };
  expect(await getHeroImages('h_x')).toEqual([]);
});
