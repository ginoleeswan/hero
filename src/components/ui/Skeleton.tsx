import { Animated, type ViewStyle } from 'react-native';
import { useShimmer } from './SkeletonProvider';

const BASE_COLOR = '#e4d9cc';

interface SkeletonProps {
  width?: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
  /** Override the placeholder fill — e.g. a navy tint for skeletons on a dark stage. */
  color?: string;
}

export function Skeleton({
  width = '100%',
  height,
  borderRadius = 8,
  style,
  color = BASE_COLOR,
}: SkeletonProps) {
  const shimmer = useShimmer();

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: color,
          opacity: shimmer,
        },
        style,
      ]}
    />
  );
}
