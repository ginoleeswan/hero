import { getForYou } from '../../../src/lib/db/forYou';

const mockRpc = jest.fn();

jest.mock('../../../src/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

beforeEach(() => mockRpc.mockReset());

describe('getForYou', () => {
  it('passes the limit and returns the rows', async () => {
    const rows = [
      { id: '346', name: 'Iron Man', image_url: 'i.jpg', portrait_url: 'p.png' },
      { id: '226', name: 'Doctor Strange', image_url: null, portrait_url: 'q.png' },
    ];
    mockRpc.mockResolvedValue({ data: rows, error: null });
    await expect(getForYou(12)).resolves.toEqual(rows);
    expect(mockRpc).toHaveBeenCalledWith('get_my_for_you', { p_limit: 12 });
  });

  it('defaults the limit to 20', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getForYou();
    expect(mockRpc).toHaveBeenCalledWith('get_my_for_you', { p_limit: 20 });
  });

  it('returns [] on error (the row simply hides)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(getForYou()).resolves.toEqual([]);
  });
});
