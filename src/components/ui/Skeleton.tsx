import { Animated, type ViewStyle } from 'react-native';
import { useShimmer } from './SkeletonProvider';

const BASE_COLOR = '#e4d9cc';

interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height, borderRadius = 8, style }: SkeletonProps) {
  const shimmer = useShimmer();

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: BASE_COLOR,
          opacity: shimmer,
        },
        style,
      ]}
    />
  );
}
