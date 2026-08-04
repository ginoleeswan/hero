// The focus bridge is three lines, and every one of them is a decision that
// silently does nothing if it's wrong — a wrong 'inactive' mapping refetches on
// every app-switcher peek, and a missing unsubscribe leaks a listener per mount.
import { AppState, Platform } from 'react-native';
import { focusManager } from '@tanstack/react-query';
import { startAppFocusTracking } from '../../src/lib/query/appFocus';

describe('startAppFocusTracking', () => {
  const setFocused = jest.spyOn(focusManager, 'setFocused').mockImplementation(() => {});
  let handler: ((s: string) => void) | undefined;
  const remove = jest.fn();

  const addListener = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _e: string,
    cb: never,
  ) => {
    handler = cb as unknown as (s: string) => void;
    return { remove } as never;
  }) as never);

  beforeEach(() => {
    setFocused.mockClear();
    addListener.mockClear();
    remove.mockClear();
    handler = undefined;
  });

  afterAll(() => {
    setFocused.mockRestore();
    addListener.mockRestore();
  });

  it('reports focus when the app becomes active', () => {
    startAppFocusTracking();
    handler?.('active');
    expect(setFocused).toHaveBeenCalledWith(true);
  });

  it('reports blur when the app goes to the background', () => {
    startAppFocusTracking();
    handler?.('background');
    expect(setFocused).toHaveBeenCalledWith(false);
  });

  it("treats iOS's 'inactive' as unfocused rather than focused", () => {
    // 'inactive' is the app switcher / incoming call / system sheet state. It
    // must not count as focused, or peeking at the switcher and coming back
    // would never fire a refetch at all (no false→true edge).
    startAppFocusTracking();
    handler?.('inactive');
    expect(setFocused).toHaveBeenCalledWith(false);
  });

  it('unsubscribes when torn down', () => {
    const stop = startAppFocusTracking();
    stop();
    expect(remove).toHaveBeenCalled();
  });

  it('is a no-op on web, where the browser owns visibility', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const stop = startAppFocusTracking();
    stop();
    expect(addListener).not.toHaveBeenCalled();
    Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
  });
});
