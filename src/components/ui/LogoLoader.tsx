import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LOGO_MASK_PATH as LOGO_PATH } from '../../constants/logo';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '../../constants/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);


export function LogoLoader() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, []);

  const animatedProps = useAnimatedProps(() => {
    // Stroke draws in over first 60% of cycle
    const strokeProgress = Math.min(progress.value / 0.6, 1);
    const strokeDashoffset = 100 * (1 - strokeProgress);

    // Fill fades in over last 40% of cycle
    const fillProgress = Math.max((progress.value - 0.6) / 0.4, 0);

    return {
      strokeDashoffset,
      fillOpacity: fillProgress,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={120} height={120} viewBox="0 0 1024 1024">
        <AnimatedPath
          d={LOGO_PATH}
          // @ts-expect-error pathLength is a valid SVG attribute but missing from AnimatedPath types
          pathLength={100}
          stroke={COLORS.beige}
          strokeWidth={12}
          strokeDasharray={100}
          fill={COLORS.beige}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
