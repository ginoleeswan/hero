// The sibling of appFocus.test.ts, and the same argument for existing: every
// branch here fails silently. Reading the wrong NetInfo field pauses queries on
// a working connection; treating `null` as offline pauses every query during
// the first moments after launch, before reachability has been determined.
import { NativeModules, Platform } from 'react-native';
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
    // The code now checks for the native module before requiring the JS
    // package, so the happy path needs one to be present.
    NativeModules.RNCNetInfo = {} as never;
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

  it('never touches the JS package when the native module is missing', () => {
    // The bug this replaced: a try/catch around the require was not enough.
    // NetInfo throws from module scope, and Metro reports a module-init failure
    // to LogBox even when the caller swallows the rethrow — so the app kept
    // working and the user still got a full-screen red error on a binary that
    // predated the NetInfo build. The only quiet failure is not importing it.
    delete (NativeModules as Record<string, unknown>).RNCNetInfo;
    jest.resetModules();

    let required = false;
    jest.doMock('@react-native-community/netinfo', () => {
      required = true;
      throw new Error('@react-native-community/netinfo: NativeModule.RNCNetInfo is null.');
    });

    const spy = jest.spyOn(onlineManager, 'setEventListener');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { startAppOnlineTracking: reloaded } = require('../../src/lib/query/appOnline');

    expect(() => reloaded()()).not.toThrow();
    expect(required).toBe(false);
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
    jest.dontMock('@react-native-community/netinfo');
  });
});
