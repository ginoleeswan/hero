import { renderHook, waitFor } from '@testing-library/react-native';
import { useTeamPage } from '../../src/hooks/useTeamPage';
import { getTeamById, getTeamMembers } from '../../src/lib/db/teams';

jest.mock('../../src/lib/db/teams', () => ({
  getTeamById: jest.fn(),
  getTeamMembers: jest.fn(),
}));

const mockById = getTeamById as jest.MockedFunction<typeof getTeamById>;
const mockMembers = getTeamMembers as jest.MockedFunction<typeof getTeamMembers>;

describe('useTeamPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves team + members', async () => {
    mockById.mockResolvedValue({
      id: 't1',
      name: 'Avengers',
      publisher: 'Marvel',
      logo_url: null,
      member_count: 2,
    });
    mockMembers.mockResolvedValue([{ id: 'h1', name: 'Iron Man' }] as never);
    const { result } = renderHook(() => useTeamPage('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.team?.name).toBe('Avengers');
    expect(result.current.members).toHaveLength(1);
    expect(result.current.notFound).toBe(false);
  });

  it('flags notFound when the team is missing', async () => {
    mockById.mockResolvedValue(null);
    mockMembers.mockResolvedValue([]);
    const { result } = renderHook(() => useTeamPage('nope'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notFound).toBe(true);
  });
});
