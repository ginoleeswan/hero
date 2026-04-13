import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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

const LOGO_PATH =
  'M771.83 359.726C790.233 359.157 809.038 360.561 827.217 363.687C860.194 368.791 880.58 384.832 899.577 411.588C952.323 485.882 910.478 588.451 840.684 635.156C777.716 677.292 684.759 672.267 615.599 648.433C606.232 645.205 596.363 641.14 587.513 636.51C560.951 620.256 539.813 614.985 508.598 616.581C476.925 618.201 457.215 629.785 428.71 641.463C378.199 662.157 312.618 674.016 258.384 663.281C223.369 657.798 188.002 641.874 162.23 617.635C99.3027 558.45 73.5282 462.814 138.958 393.848C166.265 365.064 197.584 361.227 235.229 360.28C291.337 358.869 345.958 367.328 400.078 381.829C413.535 385.43 426.897 389.376 440.151 393.665C470.511 403.519 493.246 412.119 526.372 410.492C544.544 409.599 556.786 403.601 573.782 397.773C584.487 394.125 595.271 390.711 606.126 387.535C659.036 371.973 716.754 361.015 771.83 359.726ZM379.43 580.576C404.316 570.739 422.585 557.516 434.848 532.384C439.037 523.799 439.936 512.178 436.403 503.212C428.365 482.815 393.689 466.137 374.256 457.991C346.125 446.198 312.018 435.868 281.435 435.007C275.287 434.834 268.989 434.216 262.784 434.713C226.343 436.857 209.334 467.83 211.588 501.699C213.173 525.52 224.795 548.661 242.631 564.609C267.287 585.96 306.277 591.723 337.967 589.297C352.112 588.232 366.054 585.299 379.43 580.576ZM669.618 585.812C703.165 593.579 746.514 591.622 776.102 573.056C796.619 559.96 811.158 539.317 816.578 515.588C826.183 473.57 805.637 434.865 760.026 435.926C754.894 436.045 749.642 435.782 744.496 436.282C698.168 440.71 646.68 454.898 608.343 482.267C576.199 505.214 594.861 542.717 619.664 562.508C634.433 574.519 651.324 581.316 669.618 585.812Z';

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
          pathLength={100}
          stroke={COLORS.navy}
          strokeWidth={12}
          strokeDasharray={100}
          fill={COLORS.navy}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
