import { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LightningBolt } from './LightningBolt';
import { SpeedLines } from './SpeedLines';
import { VsBadge } from './VsBadge';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH / 2;
const BOLT_WIDTH = 52;

export interface ClashPortraitsProps {
  imageA: number | { uri: string };
  imageB: number | { uri: string };
  nameA: string;
  nameB: string;
  /** 'A' | 'B' | 'tie' — controls winner/loser label */
  winner: 'A' | 'B' | 'tie';
  height?: number;
}

export function ClashPortraits({
  imageA,
  imageB,
  nameA,
  nameB,
  winner,
  height = 280,
}: ClashPortraitsProps) {
  const leftX = useSharedValue(-SCREEN_WIDTH);
  const rightX = useSharedValue(SCREEN_WIDTH);
  const shakeX = useSharedValue(0);
  const flashOp = useSharedValue(0);
  const boltOp = useSharedValue(0);
  const badgeScale = useSharedValue(0);
  const badgeRot = useSharedValue(-10);
  const labelsOp = useSharedValue(0);

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

    // 3. Bolt crackles in
    boltOp.value = withDelay(660, withTiming(1, { duration: 80 }));

    // 4. VS badge pops in
    badgeScale.value = withDelay(760, withSpring(1, { damping: 10, stiffness: 180 }));
    badgeRot.value = withDelay(760, withTiming(0, { duration: 300, easing: easeOut }));

    // 5. Labels + names fade in
    labelsOp.value = withDelay(950, withTiming(1, { duration: 250 }));
  }, []);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value }] }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOp.value }));
  const boltStyle = useAnimatedStyle(() => ({ opacity: boltOp.value }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }, { rotate: `${badgeRot.value}deg` }],
  }));
  const labelsStyle = useAnimatedStyle(() => ({ opacity: labelsOp.value }));

  const labelA = winner === 'A' ? 'Winner' : winner === 'tie' ? 'Tie' : 'Lost';
  const labelB = winner === 'B' ? 'Winner' : winner === 'tie' ? 'Tie' : 'Lost';
  const isWinA = winner === 'A' || winner === 'tie';
  const isWinB = winner === 'B' || winner === 'tie';

  return (
    <Animated.View style={[{ height, overflow: 'hidden' }, shakeStyle]}>
      {/* Left panel */}
      <Animated.View style={[styles.panelLeft, { height }, leftStyle]}>
        <View style={[styles.panelBg, styles.panelBgLeft]} />
        <SpeedLines side="left" width={PANEL_WIDTH} height={height} />
        <Image
          source={imageA}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.panelOverlayLeft} />
        <View style={styles.bottomGrad} />
        <Animated.View style={[styles.labelsLeft, labelsStyle]}>
          <View style={[styles.statusPill, isWinA ? styles.pillWin : styles.pillLoss]}>
            <Text style={styles.statusText}>{labelA}</Text>
          </View>
          <Text style={styles.heroName}>{nameA}</Text>
        </Animated.View>
      </Animated.View>

      {/* Right panel */}
      <Animated.View style={[styles.panelRight, { height }, rightStyle]}>
        <View style={[styles.panelBg, styles.panelBgRight]} />
        <SpeedLines side="right" width={PANEL_WIDTH} height={height} />
        <Image
          source={imageB}
          contentFit="cover"
          contentPosition="top"
          style={[StyleSheet.absoluteFill, styles.flipped]}
        />
        <View style={styles.panelOverlayRight} />
        <View style={styles.bottomGrad} />
        <Animated.View style={[styles.labelsRight, labelsStyle]}>
          <View
            style={[
              styles.statusPill,
              styles.statusPillRight,
              isWinB ? styles.pillWin : styles.pillLoss,
            ]}
          >
            <Text style={styles.statusText}>{labelB}</Text>
          </View>
          <Text style={[styles.heroName, styles.heroNameRight]}>{nameB}</Text>
        </Animated.View>
      </Animated.View>

      {/* Lightning bolt divider */}
      <Animated.View style={[styles.boltWrap, { height }, boltStyle]}>
        <LightningBolt height={height} width={BOLT_WIDTH} />
      </Animated.View>

      {/* VS Badge */}
      <Animated.View style={[styles.badgeWrap, { top: height / 2 - 60 }, badgeStyle]}>
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
    width: PANEL_WIDTH,
    overflow: 'hidden',
  },
  panelRight: {
    position: 'absolute',
    right: 0,
    width: PANEL_WIDTH,
    overflow: 'hidden',
  },
  panelBg: {
    ...StyleSheet.absoluteFillObject,
  },
  panelBgLeft: {},
  panelBgRight: {},
  panelOverlayLeft: {
    ...StyleSheet.absoluteFillObject,
  },
  panelOverlayRight: {
    ...StyleSheet.absoluteFillObject,
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
  pillWin: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.4)' },
  pillLoss: { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(255,255,255,0.15)' },
  statusText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroNameRight: {
    textAlign: 'right',
  },
  boltWrap: {
    position: 'absolute',
    left: PANEL_WIDTH - BOLT_WIDTH / 2,
    top: 0,
    zIndex: 10,
  },
  badgeWrap: {
    position: 'absolute',
    left: PANEL_WIDTH - 60,
    zIndex: 20,
  },
  flash: {
    backgroundColor: 'white',
    zIndex: 100,
  },
});
