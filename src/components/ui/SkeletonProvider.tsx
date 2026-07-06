import { createContext, useContext, useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

const SkeletonContext = createContext<Animated.Value | null>(null);

export function SkeletonProvider({ children }: { children: React.ReactNode }) {
  const [shimmer] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.45,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    return () => shimmer.stopAnimation();
  }, [shimmer]);

  return <SkeletonContext.Provider value={shimmer}>{children}</SkeletonContext.Provider>;
}

export function useShimmer(): Animated.Value {
  const ctx = useContext(SkeletonContext);
  // If used outside a provider, return a static value of 1 (no animation)
  return ctx ?? new Animated.Value(1);
}
