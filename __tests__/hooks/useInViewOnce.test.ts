import { renderHook, act } from '@testing-library/react-native';
import { createRef } from 'react';
import { useInViewOnce } from '../../src/hooks/useInViewOnce';

// Controllable IntersectionObserver mock: capture the callback so tests can
// fire an intersection on demand, and record disconnect calls.
type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let lastCallback: IOCallback | null = null;
const disconnect = jest.fn();
const observe = jest.fn();

class MockIntersectionObserver {
  constructor(cb: IOCallback) {
    lastCallback = cb;
  }
  observe = observe;
  disconnect = disconnect;
  unobserve = jest.fn();
}

const originalIO = (global as { IntersectionObserver?: unknown }).IntersectionObserver;
const originalMatchMedia = window.matchMedia;

function setReducedMotion(reduced: boolean) {
  // jsdom has no matchMedia by default; define a minimal stub.
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    onchange: null,
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  lastCallback = null;
  disconnect.mockClear();
  observe.mockClear();
  (global as { IntersectionObserver?: unknown }).IntersectionObserver =
    MockIntersectionObserver as unknown;
  setReducedMotion(false);
});

afterAll(() => {
  (global as { IntersectionObserver?: unknown }).IntersectionObserver = originalIO;
  window.matchMedia = originalMatchMedia;
});

// A ref whose .current looks like a DOM element to the hook.
function elementRef() {
  const ref = createRef<unknown>();
  (ref as { current: unknown }).current = {} as HTMLElement;
  return ref;
}

describe('useInViewOnce', () => {
  it('starts false and latches true once the element intersects', () => {
    const ref = elementRef();
    const { result } = renderHook(() => useInViewOnce(ref));

    expect(result.current).toBe(false);
    expect(observe).toHaveBeenCalledTimes(1);

    act(() => lastCallback?.([{ isIntersecting: true }]));
    expect(result.current).toBe(true);
    expect(disconnect).toHaveBeenCalled();
  });

  it('ignores non-intersecting callbacks', () => {
    const ref = elementRef();
    const { result } = renderHook(() => useInViewOnce(ref));

    act(() => lastCallback?.([{ isIntersecting: false }]));
    expect(result.current).toBe(false);
  });

  it('returns true immediately under reduced motion (never observes)', () => {
    setReducedMotion(true);
    const ref = elementRef();
    const { result } = renderHook(() => useInViewOnce(ref));

    expect(result.current).toBe(true);
    expect(observe).not.toHaveBeenCalled();
  });

  it('latches true (deferred a tick) when there is no element to observe', () => {
    jest.useFakeTimers();
    try {
      const ref = createRef<unknown>(); // .current stays null
      const { result } = renderHook(() => useInViewOnce(ref));

      expect(observe).not.toHaveBeenCalled();
      act(() => {
        jest.runOnlyPendingTimers();
      });
      expect(result.current).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
