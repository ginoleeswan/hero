import { renderHook, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMatchupVote } from '../../src/hooks/useMatchupVote';
import { getMatchupTallyV2, castMatchupVoteV2, type MatchupTally } from '../../src/lib/db/matchupVotes';
import { getVoterKey } from '../../src/lib/voterKey';
import { useAuth } from '../../src/hooks/useAuth';

jest.mock('../../src/lib/db/matchupVotes', () => ({
  getMatchupTallyV2: jest.fn(),
  castMatchupVoteV2: jest.fn(),
}));

jest.mock('../../src/lib/voterKey', () => ({
  getVoterKey: jest.fn(),
}));

jest.mock('../../src/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../src/lib/analytics', () => ({
  trackEvent: jest.fn(),
}));

const mockGetMatchupTallyV2 = getMatchupTallyV2 as jest.MockedFunction<typeof getMatchupTallyV2>;
const mockCastMatchupVoteV2 = castMatchupVoteV2 as jest.MockedFunction<typeof castMatchupVoteV2>;
const mockGetVoterKey = getVoterKey as jest.MockedFunction<typeof getVoterKey>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const VOTER_KEY = 'vk_test_12345678';
const HERO_A = 'hero-a';
const HERO_B = 'hero-b';

function emptyTally(): MatchupTally {
  return { votesA: 0, votesB: 0, total: 0, myPick: null };
}

describe('useMatchupVote', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockGetVoterKey.mockResolvedValue(VOTER_KEY);
    mockGetMatchupTallyV2.mockResolvedValue(emptyTally());
    mockCastMatchupVoteV2.mockResolvedValue(emptyTally());
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
  });

  it('logged-out castVote persists via castMatchupVoteV2 with the voter key and updates tally', async () => {
    mockCastMatchupVoteV2.mockResolvedValue({ votesA: 1, votesB: 0, total: 1, myPick: HERO_A });
    const { result } = renderHook(() => useMatchupVote(HERO_A, HERO_B));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.castVote('a');
    });

    await waitFor(() =>
      expect(mockCastMatchupVoteV2).toHaveBeenCalledWith(HERO_A, HERO_B, HERO_A, VOTER_KEY),
    );
    await waitFor(() => expect(result.current.tally?.total).toBe(1));
  });

  it('initial load calls getMatchupTallyV2 with the voter key and surfaces myPick', async () => {
    mockGetMatchupTallyV2.mockResolvedValue({ votesA: 3, votesB: 2, total: 5, myPick: HERO_B });
    const { result } = renderHook(() => useMatchupVote(HERO_A, HERO_B));

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(mockGetMatchupTallyV2).toHaveBeenCalledWith(HERO_A, HERO_B, VOTER_KEY);
    expect(result.current.pickedId).toBe(HERO_B);
    expect(result.current.tally?.total).toBe(5);
  });

  it('a second castVote is a no-op once a pick exists', async () => {
    mockCastMatchupVoteV2.mockResolvedValue({ votesA: 1, votesB: 0, total: 1, myPick: HERO_A });
    const { result } = renderHook(() => useMatchupVote(HERO_A, HERO_B));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() => {
      result.current.castVote('a');
    });
    await waitFor(() => expect(mockCastMatchupVoteV2).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.castVote('b');
    });

    expect(mockCastMatchupVoteV2).toHaveBeenCalledTimes(1);
    expect(result.current.pickedId).toBe(HERO_A);
  });
});
