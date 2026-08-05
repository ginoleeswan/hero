// The prompt-don't-reload decision and the foreground-recheck throttle are both
// invisible when wrong: auto-reloading looks like a crash to the user, and an
// unthrottled recheck fires a manifest request every app switch.
import { renderHook, act } from '@testing-library/react-native';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';
import { useOtaUpdate } from '../../src/hooks/useOtaUpdate';

jest.mock('expo-updates', () => ({
  __esModule: true,
  isEnabled: true,
  useUpdates: jest.fn(() => ({ isUpdatePending: false })),
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => {}),
}));

const mocked = Updates as jest.Mocked<typeof Updates> & {
  useUpdates: jest.Mock;
  checkForUpdateAsync: jest.Mock;
  fetchUpdateAsync: jest.Mock;
  reloadAsync: jest.Mock;
};

describe('useOtaUpdate', () => {
  let appStateHandler: ((s: string) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    mocked.useUpdates.mockReturnValue({ isUpdatePending: false } as never);
    mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: false } as never);
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, cb: never) => {
      appStateHandler = cb as unknown as (s: string) => void;
      return { remove: jest.fn() } as never;
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    appStateHandler = undefined;
  });

  it('does not offer anything when no update is staged', () => {
    const { result } = renderHook(() => useOtaUpdate());
    expect(result.current.ready).toBe(false);
  });

  it('offers a restart once an update is staged', () => {
    mocked.useUpdates.mockReturnValue({ isUpdatePending: true } as never);
    const { result } = renderHook(() => useOtaUpdate());
    expect(result.current.ready).toBe(true);
  });

  it('never reloads on its own — only when asked', async () => {
    // The expo-updates docs example reloads the moment isUpdatePending flips,
    // which restarts the app under whatever the user was doing.
    mocked.useUpdates.mockReturnValue({ isUpdatePending: true } as never);
    const { result } = renderHook(() => useOtaUpdate());
    expect(mocked.reloadAsync).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.apply();
    });
    expect(mocked.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('checks and stages on foreground', async () => {
    mocked.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as never);
    renderHook(() => useOtaUpdate());
    await act(async () => {
      appStateHandler?.('active');
    });
    expect(mocked.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mocked.fetchUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('does not download when nothing is available', async () => {
    renderHook(() => useOtaUpdate());
    await act(async () => {
      appStateHandler?.('active');
    });
    expect(mocked.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(mocked.fetchUpdateAsync).not.toHaveBeenCalled();
  });

  it('throttles repeated foregrounds', async () => {
    renderHook(() => useOtaUpdate());
    await act(async () => {
      appStateHandler?.('active');
      appStateHandler?.('active');
      appStateHandler?.('active');
    });
    expect(mocked.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('ignores background transitions', async () => {
    renderHook(() => useOtaUpdate());
    await act(async () => {
      appStateHandler?.('background');
    });
    expect(mocked.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('swallows check failures — being offline is not an error to report', async () => {
    mocked.checkForUpdateAsync.mockRejectedValue(new Error('network'));
    renderHook(() => useOtaUpdate());
    await act(async () => {
      appStateHandler?.('active');
    });
    expect(mocked.fetchUpdateAsync).not.toHaveBeenCalled();
  });
});
