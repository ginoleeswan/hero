// The sibling of appFocus.test.ts, and the same argument for existing: every
// branch here fails silently. Reading the wrong NetInfo field pauses queries on
// a working connection; treating `null` as offline pauses every query during
// the first moments after launch, before reachability has been determined.
import { Platform } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { startAppOnlineTracking } from '../../src/lib/query/appOnline';

type NetState = { isConnected: boolean | null; isInternetReachable: boolean | null };

const mockUnsubscribe = jest.fn();
let mockNetHandler: ((s: NetState) => void) | undefined;

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: (cb: (s: NetState) => void) => {
      mockNetHandler = cb;
      return mockUnsubscribe;
    },
  },
}));

describe('startAppOnlineTracking', () => {
  let setOnline: jest.Mock;
  let stop: (() => void) | undefined;

  // onlineManager.setEventListener immediately invokes the setup function with
  // its own setter; capture that setter so assertions read what the manager
  // would actually have been told.
  const install = () => {
    setOnline = jest.fn();
    const spy = jest
      .spyOn(onlineManager, 'setEventListener')
      .mockImplementation((setup) => setup(setOnline as never) as never);
    stop = startAppOnlineTracking();
    spy.mockRestore();
  };

  beforeEach(() => {
    mockNetHandler = undefined;
    mockUnsubscribe.mockClear();
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  it('goes offline when the network is unreachable', () => {
    install();
    mockNetHandler?.({ isConnected: true, isInternetReachable: false });
    expect(setOnline).toHaveBeenCalledWith(false);
  });

  it('trusts reachability over mere connection — the captive-portal case', () => {
    // Joined the hotel wifi (isConnected) but it routes nowhere until you accept
    // the terms. Reporting online here is what makes every request hang.
    install();
    mockNetHandler?.({ isConnected: true, isInternetReachable: false });
    expect(setOnline).toHaveBeenCalledWith(false);
    mockNetHandler?.({ isConnected: true, isInternetReachable: true });
    expect(setOnline).toHaveBeenLastCalledWith(true);
  });

  it('falls back to isConnected while reachability is still unknown', () => {
    // NetInfo reports isInternetReachable: null until it has probed. Treating
    // that as offline would pause every query on a perfectly good connection.
    install();
    mockNetHandler?.({ isConnected: true, isInternetReachable: null });
    expect(setOnline).toHaveBeenCalledWith(true);
  });

  it('assumes online when NetInfo knows nothing at all', () => {
    // Better to try and fail than to refuse to try.
    install();
    mockNetHandler?.({ isConnected: null, isInternetReachable: null });
    expect(setOnline).toHaveBeenCalledWith(true);
  });

  it('unsubscribes from NetInfo when torn down', () => {
    install();
    stop?.();
    stop = undefined;
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('is a no-op on web, where the browser owns connectivity', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const spy = jest.spyOn(onlineManager, 'setEventListener');
    startAppOnlineTracking()();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  });
});
