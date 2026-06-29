// src/components/ui/FadeOutSkeleton.tsx
// Overlays a skeleton on top of already-rendered content and dissolves it out, so
// the placeholders appear to resolve into the real content in place — a true
// cross-dissolve. The content sits static and fully opaque underneath; only this
// layer animates, so there's no blink (unlike fading the new content up from 0).
// Pair the `duration` with useSkeletonTransition's `crossfade` so the layer
// reaches opacity 0 exactly as the transition unmounts it. JS driver on web (no
// native animation backend in the browser); native driver elsewhere.
import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';

interface FadeOutSkeletonProps {
  children: React.ReactNode;
  duration?: number;
}

export function FadeOutSkeleton({ children, duration = 320 }: FadeOutSkeletonProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.timing(opacity, {
      toValue: 0,
      duration,
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [opacity, duration]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}
