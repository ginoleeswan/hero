import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { heroImageSource } from '../../constants/heroImages';
import { COLORS } from '../../constants/colors';

export interface AnchorFighter {
  id: string;
  name: string;
  image_url?: string | null;
  portrait_url?: string | null;
}

export const ANCHOR_W = 128;
export const ANCHOR_H = 160;

/**
 * A single matchup anchor — a glowing rounded portrait with the name beneath, or
 * a dashed "?" seat when empty. Shared by both pickers (the character-locked
 * VsAnchor and the two-slot builder) so they stay visually identical; only flow
 * differs. Optional press / clear / active props power the swappable two-slot UX.
 */
export function FighterAnchor({
  fighter,
  seatLabel = 'Your pick',
  lit,
  active = false,
  flip = false,
  tone = 'stage',
  vtName,
  w = ANCHOR_W,
  h = ANCHOR_H,
  onPress,
  onClear,
}: {
  fighter: AnchorFighter | null;
  seatLabel?: string;
  /** Force the lit (locked) look even while empty — e.g. a loading subject. */
  lit?: boolean;
  /** Highlight as the current target slot (two-slot builder). */
  active?: boolean;
  /** Mirror the portrait so a right-side fighter faces the centre. */
  flip?: boolean;
  tone?: 'stage' | 'light';
  /** Web only: view-transition-name so a filled anchor morphs into the arena. */
  vtName?: string;
  w?: number;
  h?: number;
  onPress?: () => void;
  onClear?: () => void;
}) {
  const filled = !!fighter;
  const showLit = lit ?? filled;
  const stage = tone === 'stage';
  const source = filled
    ? heroImageSource(fighter!.id, fighter!.image_url, fighter!.portrait_url)
    : null;

  const portraitStyle = [
    styles.portrait,
    { width: w, height: h },
    showLit ? styles.lit : [styles.seat, stage && styles.seatStage],
    active && (showLit ? (styles.litActive as object) : (styles.seatActive as object)),
    showLit && vtName ? ({ viewTransitionName: vtName } as object) : null,
  ] as object;

  const inner = (
    <>
      {filled && source ? (
        <Image
          source={source}
          contentFit="cover"
          contentPosition="top center"
          style={[StyleSheet.absoluteFill, flip ? { transform: [{ scaleX: -1 }] } : null] as object}
          placeholder={COLORS.navy}
          transition={140}
        />
      ) : showLit ? null : (
        <Text style={[styles.q, stage && (styles.qStage as object)] as object}>?</Text>
      )}
      {filled && onClear ? (
        <Pressable aria-label="Remove" onPress={onClear} style={styles.clear as object}>
          <Ionicons name="close" size={15} color={COLORS.beige} />
        </Pressable>
      ) : null}
    </>
  );

  return (
    <View style={[styles.col, { width: w }] as object}>
      {onPress ? (
        <Pressable onPress={onPress} style={portraitStyle}>
          {inner}
        </Pressable>
      ) : (
        <View style={portraitStyle}>{inner}</View>
      )}
      <Text
        style={
          [
            styles.name,
            stage && (styles.nameStage as object),
            !filled && (styles.placeholderName as object),
            !filled && stage && (styles.placeholderStage as object),
          ] as object
        }
        numberOfLines={1}
      >
        {filled ? fighter!.name : seatLabel}
      </Text>
    </View>
  );
}

const RADIUS = 28;

const styles = StyleSheet.create({
  col: { alignItems: 'center', gap: 10 },
  portrait: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lit: {
    boxShadow: '0 0 0 2px rgba(206,155,51,0.9), 0 0 52px rgba(206,155,51,0.3)',
  } as object,
  litActive: {
    boxShadow: '0 0 0 2.5px #E77333, 0 0 56px rgba(231,115,51,0.34)',
  } as object,
  seat: {
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(41,60,67,0.24)',
    backgroundColor: 'rgba(41,60,67,0.03)',
    ...Platform.select({ web: { transition: 'border-color 180ms ease' } as object, default: {} }),
  },
  seatStage: {
    borderColor: 'rgba(245,235,220,0.32)',
    backgroundColor: 'rgba(245,235,220,0.04)',
  },
  seatActive: { borderColor: COLORS.orange } as object,
  clear: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: 'rgba(11,24,32,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  q: { fontFamily: 'Flame-Regular', fontSize: 42, color: 'rgba(41,60,67,0.3)' },
  qStage: { color: 'rgba(245,235,220,0.4)' } as object,
  name: { fontFamily: 'Flame-Regular', fontSize: 17, color: COLORS.navy, textAlign: 'center' },
  nameStage: {
    color: COLORS.beige,
    ...Platform.select({
      web: { textShadow: '0 1px 10px rgba(0,0,0,0.5)' } as object,
      default: {},
    }),
  } as object,
  placeholderName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.4)',
  } as object,
  placeholderStage: { color: 'rgba(245,235,220,0.45)' } as object,
});
