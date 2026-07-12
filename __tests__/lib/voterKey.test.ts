import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVoterKey, VOTER_KEY_STORAGE_KEY } from '../../src/lib/voterKey';

// @react-native-async-storage/async-storage is already mapped to its official
// jest mock via jest.config's moduleNameMapper; an explicit jest.mock() here
// re-requires that same mapped path inside its own factory and recurses.

describe('getVoterKey', () => {
  beforeEach(() => AsyncStorage.clear());

  it('generates a stable key of at least 8 chars and persists it', async () => {
    const k1 = await getVoterKey();
    expect(k1.length).toBeGreaterThanOrEqual(8);
    const k2 = await getVoterKey();
    expect(k2).toBe(k1);
    expect(await AsyncStorage.getItem(VOTER_KEY_STORAGE_KEY)).toBe(k1);
  });
});
