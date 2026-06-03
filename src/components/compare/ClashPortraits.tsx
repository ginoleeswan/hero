import { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { SpeedLines } from './SpeedLines';
import { VsBadge } from './VsBadge';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SEAM_WIDTH = 30;

export interface ClashPortraitsProps {
  imageA: number | { uri: string };
  imageB: number | { uri: string };
  nameA: string;
  nameB: string;
  /** 'A' | 'B' | 'tie' — controls winner/loser label */
  winner: 'A' | 'B' | 'tie';
  height?: number;
  /** Total width of the clash stage. Defaults to the full screen width. */
  width?: number;
}

export function ClashPortraits({
  imageA,
  imageB,
  nameA,
  nameB,
  winner,
  height = 280,
  width = SCREEN_WIDTH,
}: ClashPortraitsProps) {
  const PANEL_WIDTH = width / 2;

  const leftX = useSharedValue(-SCREEN_WIDTH);
  const rightX = useSharedValue(SCREEN_WIDTH);
  const shakeX = useSharedValue(0);
  const flashOp = useSharedValue(0);
  const badgeScale = useSharedValue(0);
  const badgeRot = useSharedValue(-10);
  const labelsOp = useSharedValue(0);
  const resultOp = useSharedValue(0);

  useEffect(() => {
    const easeOut = Easing.out(Easing.poly(3));

    // 1. Portraits slam in
    leftX.value = withDelay(60, withTiming(0, { duration: 420, easing: easeOut }));
    rightX.value = withDelay(60, withTiming(0, { duration: 420, easing: easeOut }));

    // 2. Screen shake + flash at clash moment
    shakeX.value = withDelay(
      630,
      withSequence(
        withTiming(-5, { duration: 40 }),
        withTiming(5, { duration: 40 }),
        withTiming(-3, { duration: 35 }),
        withTiming(3, { duration: 35 }),
        withTiming(0, { duration: 30 }),
      ),
    );
    flashOp.value = withDelay(
      640,
      withSequence(withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 160 })),
    );

    // 4. VS badge pops in
    badgeScale.value = withDelay(760, withSpring(1, { damping: 10, stiffness: 180 }));
    badgeRot.value = withDelay(760, withTiming(0, { duration: 300, easing: easeOut }));

    // 5. Labels + names fade in
    labelsOp.value = withDelay(950, withTiming(1, { duration: 250 }));

    // 6. Verdict reveal — winner glow blooms, loser fades to defeat
    resultOp.value = withDelay(1080, withTiming(1, { duration: 420, easing: easeOut }));
  }, []);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }, { rotate: `${badgeRot.value}deg` }],
  }));
  const labelsStyle = useAnimatedStyle(() => ({ opacity: labelsOp.value }));
  const resultStyle = useAnimatedStyle(() => ({ opacity: resultOp.value }));

  const labelA = winner === 'A' ? 'Winner' : winner === 'tie' ? 'Tie' : 'Lost';
  const labelB = winner === 'B' ? 'Winner' : winner === 'tie' ? 'Tie' : 'Lost';
  const isWinA = winner === 'A' || winner === 'tie';
  const isWinB = winner === 'B' || winner === 'tie';
  const glowOpacity = winner === 'tie' ? 0.28 : 0.55;

  return (
    <Animated.View style={[{ height, overflow: 'hidden' }, shakeStyle]}>
      {/* Left panel */}
      <Animated.View style={[styles.panelLeft, { height, width: PANEL_WIDTH }, leftStyle]}>
        <View style={styles.panelBg} />
        <SpeedLines side="left" width={PANEL_WIDTH} height={height} />
        <Image
          source={imageA}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
        />
        {isWinA ? (
          <Animated.View style={[StyleSheet.absoluteFill, resultStyle]} pointerEvents="none">
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="glowL" cx="50%" cy="42%" rx="80%" ry="80%">
                  <Stop offset="48%" stopColor="#F9B222" stopOpacity={0} />
                  <Stop offset="100%" stopColor="#F9B222" stopOpacity={glowOpacity} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowL)" />
            </Svg>
          </Animated.View>
        ) : (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.loserScrim, resultStyle]}
            pointerEvents="none"
          />
        )}
        <View style={styles.bottomGrad} />
        <Animated.View style={[styles.labelsLeft, labelsStyle]}>
          <View style={[styles.statusPill, isWinA ? styles.pillWin : styles.pillLoss]}>
            <Text style={[styles.statusText, isWinA && styles.statusTextWin]}>{labelA}</Text>
          </View>
          <Text style={[styles.heroName, !isWinA && styles.heroNameDim]}>{nameA}</Text>
        </Animated.View>
      </Animated.View>

      {/* Right panel */}
      <Animated.View style={[styles.panelRight, { height, width: PANEL_WIDTH }, rightStyle]}>
        <View style={styles.panelBg} />
        <SpeedLines side="right" width={PANEL_WIDTH} height={height} />
        <Image
          source={imageB}
          contentFit="cover"
          contentPosition="top"
          style={[StyleSheet.absoluteFill, styles.flipped]}
        />
        {isWinB ? (
          <Animated.View style={[StyleSheet.absoluteFill, resultStyle]} pointerEvents="none">
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="glowR" cx="50%" cy="42%" rx="80%" ry="80%">
                  <Stop offset="48%" stopColor="#F9B222" stopOpacity={0} />
                  <Stop offset="100%" stopColor="#F9B222" stopOpacity={glowOpacity} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#glowR)" />
            </Svg>
          </Animated.View>
        ) : (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.loserScrim, resultStyle]}
            pointerEvents="none"
          />
        )}
        <View style={styles.bottomGrad} />
        <Animated.View style={[styles.labelsRight, labelsStyle]}>
          <View
            style={[
              styles.statusPill,
              styles.statusPillRight,
              isWinB ? styles.pillWin : styles.pillLoss,
            ]}
          >
            <Text style={[styles.statusText, isWinB && styles.statusTextWin]}>{labelB}</Text>
          </View>
          <Text style={[styles.heroName, styles.heroNameRight, !isWinB && styles.heroNameDim]}>
            {nameB}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Soft center seam */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.seam, { height, left: PANEL_WIDTH - SEAM_WIDTH / 2 }]}
        pointerEvents="none"
      />

      {/* VS Badge */}
      <Animated.View
        style={[styles.badgeWrap, { top: height * 0.64 - 38, left: PANEL_WIDTH - 60 }, badgeStyle]}
      >
        <VsBadge size={76} />
      </Animated.View>

      {/* White flash overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panelLeft: {
    position: 'absolute',
    left: 0,
    overflow: 'hidden',
  },
  panelRight: {
    position: 'absolute',
    right: 0,
    overflow: 'hidden',
  },
  panelBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.navy,
  },
  bottomGrad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  flipped: {
    transform: [{ scaleX: -1 }],
  },
  loserScrim: { backgroundColor: 'rgba(18,26,31,0.58)' },
  labelsLeft: {
    position: 'absolute',
    bottom: 12,
    left: 10,
    right: 30,
  },
  labelsRight: {
    position: 'absolute',
    bottom: 12,
    right: 10,
    left: 30,
    alignItems: 'flex-end',
  },
  statusPillRight: {
    alignSelf: 'flex-end',
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    marginBottom: 4,
    borderWidth: 1,
  },
  pillWin: { backgroundColor: COLORS.yellow, borderColor: 'rgba(255,255,255,0.6)' },
  pillLoss: { backgroundColor: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.12)' },
  statusText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  statusTextWin: { color: COLORS.navy },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroNameDim: {
    color: 'rgba(245,235,220,0.62)',
  },
  heroNameRight: {
    textAlign: 'right',
  },
  seam: {
    position: 'absolute',
    top: 0,
    width: SEAM_WIDTH,
    zIndex: 10,
  },
  badgeWrap: {
    position: 'absolute',
    zIndex: 20,
  },
  flash: {
    backgroundColor: 'white',
    zIndex: 100,
  },
});
