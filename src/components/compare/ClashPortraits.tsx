import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { VsBadge } from './VsBadge';
import { HeroMonogram } from '../HeroImage';
import { COLORS } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SEAM_WIDTH = 28;
const BADGE_SIZE = 46;

export interface ClashPortraitsProps {
  imageA: { uri: string };
  imageB: { uri: string };
  nameA: string;
  nameB: string;
  /** 'A' | 'B' | 'tie' decides the winner/loser cue. 'neutral' = result not in
   *  yet (both lit, no cues) — used while stats load behind the handoff paint. */
  winner: 'A' | 'B' | 'tie' | 'neutral';
  height?: number;
  /** Total width of the clash stage. Defaults to the full screen width. */
  width?: number;
  /** Tap the left portrait to replace hero A. */
  onSwapA?: () => void;
  /** Tap the right portrait to replace hero B. */
  onSwapB?: () => void;
  /** Tap hero A's name to open their profile. */
  onViewProfileA?: () => void;
  /** Tap hero B's name to open their profile. */
  onViewProfileB?: () => void;
}

export function ClashPortraits({
  imageA,
  imageB,
  nameA,
  nameB,
  winner,
  height = 280,
  width = SCREEN_WIDTH,
  onSwapA,
  onSwapB,
  onViewProfileA,
  onViewProfileB,
}: ClashPortraitsProps) {
  const PANEL_WIDTH = width / 2;

  const leftX = useSharedValue(-width);
  const rightX = useSharedValue(width);
  const badgeP = useSharedValue(0);
  const labelsOp = useSharedValue(0);
  const resultOp = useSharedValue(0);

  useEffect(() => {
    const easeOut = Easing.out(Easing.cubic);

    // Portraits glide in and settle
    leftX.value = withDelay(60, withTiming(0, { duration: 520, easing: easeOut }));
    rightX.value = withDelay(60, withTiming(0, { duration: 520, easing: easeOut }));

    // VS marker fades + eases up
    badgeP.value = withDelay(520, withTiming(1, { duration: 320, easing: easeOut }));

    // Names fade in
    labelsOp.value = withDelay(680, withTiming(1, { duration: 320 }));
  }, []);

  // Result reveal — the loser quietly recedes once the winner is known. Driven
  // by `winner` (not mount) so it also fires when the result resolves behind a
  // handoff paint that started in the 'neutral' state.
  useEffect(() => {
    if (winner === 'neutral') {
      resultOp.value = 0;
      return;
    }
    resultOp.value = withDelay(
      200,
      withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }),
    );
  }, [winner]);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value }] }));
  const labelsStyle = useAnimatedStyle(() => ({ opacity: labelsOp.value }));
  const resultStyle = useAnimatedStyle(() => ({ opacity: resultOp.value }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeP.value,
    transform: [{ scale: 0.86 + badgeP.value * 0.14 }],
  }));

  const settled = winner !== 'neutral';
  const winA = winner === 'A';
  const winB = winner === 'B';
  const tie = winner === 'tie';
  // Until the result settles, both portraits stay lit (no loser scrim/cue).
  const isWinA = !settled || winA || tie;
  const isWinB = !settled || winB || tie;

  return (
    <Animated.View style={{ height, overflow: 'hidden' }}>
      {/* Left panel */}
      <Animated.View style={[styles.panelLeft, { height, width: PANEL_WIDTH }, leftStyle]}>
        <View style={styles.panelBg} />
        {imageA.uri ? (
          <Image
            source={imageA}
            contentFit="cover"
            contentPosition="top"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <HeroMonogram seed={nameA} name={nameA} style={StyleSheet.absoluteFill} />
        )}
        {!isWinA && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.loserScrim, resultStyle]}
            pointerEvents="none"
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.bottomGrad}
          pointerEvents="none"
        />
        {onSwapA && (
          <Pressable
            onPress={onSwapA}
            style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.panelPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Replace ${nameA}`}
            accessibilityHint="Choose a different hero for this side"
          >
            <View style={[styles.swapChip, styles.swapChipLeft]}>
              <Ionicons name="swap-horizontal" size={13} color={COLORS.beige} />
              <Text style={styles.swapText}>Swap</Text>
            </View>
          </Pressable>
        )}
        <Animated.View pointerEvents="box-none" style={[styles.labelsLeft, labelsStyle]}>
          {winA && <Text style={styles.eyebrow}>Winner</Text>}
          {tie && <Text style={styles.eyebrowTie}>Draw</Text>}
          <Pressable
            onPress={onViewProfileA}
            disabled={!onViewProfileA}
            style={styles.nameLink}
            accessibilityRole="link"
            accessibilityLabel={`View ${nameA}'s profile`}
          >
            <Text style={[styles.heroName, !isWinA && styles.heroNameDim]}>{nameA}</Text>
            {!!onViewProfileA && (
              <Ionicons name="chevron-forward" size={15} color="rgba(245,235,220,0.75)" />
            )}
          </Pressable>
          {winA && <View style={styles.winRule} />}
        </Animated.View>
      </Animated.View>

      {/* Right panel */}
      <Animated.View style={[styles.panelRight, { height, width: PANEL_WIDTH }, rightStyle]}>
        <View style={styles.panelBg} />
        {imageB.uri ? (
          <Image
            source={imageB}
            contentFit="cover"
            contentPosition="top"
            style={[StyleSheet.absoluteFill, styles.flipped]}
          />
        ) : (
          <HeroMonogram seed={nameB} name={nameB} style={StyleSheet.absoluteFill} />
        )}
        {!isWinB && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.loserScrim, resultStyle]}
            pointerEvents="none"
          />
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.bottomGrad}
          pointerEvents="none"
        />
        {onSwapB && (
          <Pressable
            onPress={onSwapB}
            style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.panelPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Replace ${nameB}`}
            accessibilityHint="Choose a different hero for this side"
          >
            <View style={[styles.swapChip, styles.swapChipRight]}>
              <Ionicons name="swap-horizontal" size={13} color={COLORS.beige} />
              <Text style={styles.swapText}>Swap</Text>
            </View>
          </Pressable>
        )}
        <Animated.View pointerEvents="box-none" style={[styles.labelsRight, labelsStyle]}>
          {winB && <Text style={[styles.eyebrow, styles.textRight]}>Winner</Text>}
          {tie && <Text style={[styles.eyebrowTie, styles.textRight]}>Draw</Text>}
          <Pressable
            onPress={onViewProfileB}
            disabled={!onViewProfileB}
            style={[styles.nameLink, styles.nameLinkRight]}
            accessibilityRole="link"
            accessibilityLabel={`View ${nameB}'s profile`}
          >
            {!!onViewProfileB && (
              <Ionicons name="chevron-back" size={15} color="rgba(245,235,220,0.75)" />
            )}
            <Text style={[styles.heroName, styles.textRight, !isWinB && styles.heroNameDim]}>
              {nameB}
            </Text>
          </Pressable>
          {winB && <View style={[styles.winRule, styles.winRuleRight]} />}
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

      {/* VS marker */}
      <Animated.View
        style={[
          styles.badgeWrap,
          { top: height * 0.67 - BADGE_SIZE / 2, left: PANEL_WIDTH - BADGE_SIZE / 2 },
          badgeStyle,
        ]}
      >
        <VsBadge size={BADGE_SIZE} />
      </Animated.View>
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
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.navy,
  },
  bottomGrad: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  flipped: {
    transform: [{ scaleX: -1 }],
  },
  loserScrim: { backgroundColor: 'rgba(22,30,34,0.55)' },
  labelsLeft: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 28,
  },
  labelsRight: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    left: 28,
    alignItems: 'flex-end',
  },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.goldAccent,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 3,
  },
  eyebrowTie: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    marginBottom: 3,
  },
  nameLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
  },
  nameLinkRight: { alignSelf: 'flex-end' },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroNameDim: {
    color: 'rgba(245,235,220,0.6)',
  },
  textRight: {
    textAlign: 'right',
  },
  winRule: {
    height: 2,
    width: 34,
    borderRadius: 2,
    backgroundColor: COLORS.goldAccent,
    marginTop: 7,
    alignSelf: 'flex-start',
  },
  winRuleRight: {
    alignSelf: 'flex-end',
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
  panelPressed: {
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  swapChip: {
    position: 'absolute',
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 13,
    backgroundColor: 'rgba(18,14,10,0.5)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(245,235,220,0.4)',
  },
  swapChipLeft: { left: 12 },
  swapChipRight: { right: 12 },
  swapText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    color: COLORS.beige,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
