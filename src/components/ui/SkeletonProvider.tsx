import { createContext, useContext, useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SHIMMER_MS } from '../../lib/nativeMotion';

const SkeletonContext = createContext<Animated.Value | null>(null);

export function SkeletonProvider({ children }: { children: React.ReactNode }) {
  const [shimmer] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();

  useEffect(() => {
    // Every loading state in the app reads this one value — under Reduce Motion
    // leave it parked at 1 so nothing shimmers.
    if (reduced) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.45,
          duration: SHIMMER_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: SHIMMER_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    return () => shimmer.stopAnimation();
  }, [shimmer, reduced]);

  return <SkeletonContext.Provider value={shimmer}>{children}</SkeletonContext.Provider>;
}

export function useShimmer(): Animated.Value {
  const ctx = useContext(SkeletonContext);
  // If used outside a provider, return a static value of 1 (no animation)
  return ctx ?? new Animated.Value(1);
}
