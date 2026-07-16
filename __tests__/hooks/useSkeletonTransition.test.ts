import { renderHook, act } from '@testing-library/react-native';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useSkeletonTransition', () => {
  it('default: pre → skeleton after delay → crossfade → content', () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useSkeletonTransition(loading),
      {
        initialProps: { loading: true },
      },
    );

    expect(result.current).toBe('pre');
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current).toBe('skeleton');

    rerender({ loading: false });
    expect(result.current).toBe('crossfade');
    act(() => {
      jest.advanceTimersByTime(320);
    });
    expect(result.current).toBe('content');
  });

  it('default: a load faster than the delay skips straight to content (no crossfade)', () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useSkeletonTransition(loading),
      {
        initialProps: { loading: true },
      },
    );

    rerender({ loading: false }); // resolves inside the 150ms window
    expect(result.current).toBe('content');
  });

  it('immediate: skeleton on the very first render (no pre window)', () => {
    const { result } = renderHook(() => useSkeletonTransition(true, { immediate: true }));
    expect(result.current).toBe('skeleton');
  });

  it('immediate: even an instant load crossfades instead of hard-cutting', () => {
    const { result, rerender } = renderHook(
      ({ loading }: { loading: boolean }) => useSkeletonTransition(loading, { immediate: true }),
      { initialProps: { loading: true } },
    );

    rerender({ loading: false }); // resolves immediately — would skip crossfade by default
    expect(result.current).toBe('crossfade');
    act(() => {
      jest.advanceTimersByTime(320);
    });
    expect(result.current).toBe('content');
  });

  it('not loading at mount renders content regardless of immediate', () => {
    const { result } = renderHook(() => useSkeletonTransition(false, { immediate: true }));
    expect(result.current).toBe('content');
  });
});
