const mockInvoke = jest.fn();
jest.mock('../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } },
}));

import { generateTeamVerdict } from '../../src/lib/api';

describe('generateTeamVerdict', () => {
  beforeEach(() => mockInvoke.mockReset());

  it('returns the function verdict when present', async () => {
    mockInvoke.mockResolvedValue({ data: { verdict: 'Avengers edge it.' }, error: null });
    const v = await generateTeamVerdict({
      teamAId: 'avengers',
      teamBId: 'justice-league',
      teamA: 'Avengers',
      teamB: 'Justice League',
      splitA: 60,
      splitB: 40,
    });
    expect(v).toBe('Avengers edge it.');
  });

  it('falls back to a deterministic line when the function errors', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const v = await generateTeamVerdict({
      teamAId: 'avengers',
      teamBId: 'justice-league',
      teamA: 'Avengers',
      teamB: 'Justice League',
      splitA: 60,
      splitB: 40,
    });
    expect(v).toContain('Avengers');
  });
});
