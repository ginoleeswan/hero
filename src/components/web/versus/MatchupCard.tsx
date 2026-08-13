import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { Image } from 'expo-image';
import { VsBadge } from '../../compare/VsBadge';
import { FACTION_A, FACTION_B } from '../../versus/factionColors';
import { COLORS } from '../../../constants/colors';
import { pressTransform } from '../pressStyles';

interface Side {
  name: string;
  art?: string | null;
}

interface Props {
  a: Side;
  b: Side;
  onOpen: () => void;
  /** 'cover' for hero portraits, 'contain' for team logos. */
  fit?: 'cover' | 'contain';
  /** Desktop: larger portraits + a hover lift. */
  large?: boolean;
}

/** A compact "who'd win" card — two fighters facing off across a gold VS, one tap
 *  into the clash. Used by every discovery row (heroes and teams). */
export function MatchupCard({ a, b, onOpen, fit = 'cover', large = false }: Props) {
  const pw = large ? 104 : 88;
  return (
    <Pressable
      onPress={onOpen}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        [
          s.card,
          { width: pw * 2 + 2 },
          hovered && !pressed && (s.cardHover as object),
          pressTransform({ hovered, pressed }),
        ] as object
      }
    >
      <View style={s.duo}>
        <Portrait side={a} tint={FACTION_A} fit={fit} pw={pw} />
        <Portrait side={b} tint={FACTION_B} fit={fit} pw={pw} flip />
        <View style={s.vs} pointerEvents="none">
          <VsBadge size={large ? 38 : 32} variant="glass" />
        </View>
      </View>
      <Text style={[s.names, { maxWidth: pw * 2 + 2 }] as object} numberOfLines={2}>
        <Text style={s.nameA}>{a.name}</Text>
        <Text style={s.vsTxt}> vs </Text>
        <Text style={s.nameB}>{b.name}</Text>
      </Text>
    </Pressable>
  );
}

function Portrait({
  side,
  tint,
  fit,
  pw,
  flip,
}: {
  side: Side;
  tint: string;
  fit: 'cover' | 'contain';
  pw: number;
  flip?: boolean;
}) {
  return (
    <View style={[s.portrait, { width: pw, height: Math.round(pw * 1.2), borderColor: tint }]}>
      {side.art ? (
        <Image
          source={{ uri: side.art }}
          style={[StyleSheet.absoluteFill, flip && fit === 'cover' ? s.mirror : null]}
          contentFit={fit}
        />
      ) : (
        // No art (usually a team without a logo): a faction-tinted wordmark
        // tile — the full name in Flame, not a lone initial.
        <View style={[StyleSheet.absoluteFill, s.mono] as object}>
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.42 }] as object}
          />
          <View style={s.monoScrim as object} />
          <Text style={s.monoName} numberOfLines={3}>
            {side.name}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: 8,
    cursor: 'pointer',
    transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), filter 200ms ease',
  } as object,
  cardHover: {
    transform: [{ translateY: -4 }],
    filter: 'drop-shadow(0 14px 24px rgba(0,0,0,0.45))',
  } as object,
  duo: { flexDirection: 'row', gap: 2, position: 'relative' },
  portrait: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#16242b',
  },
  mirror: { transform: [{ scaleX: -1 }] },
  mono: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  monoScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'linear-gradient(to bottom, rgba(11,24,32,0.1) 0%, rgba(11,24,32,0.55) 100%)',
  } as object,
  monoName: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    lineHeight: 19,
    color: 'rgba(245,235,220,0.95)',
    textAlign: 'center',
    textShadow: '0 1px 6px rgba(0,0,0,0.6)',
  } as object,
  vs: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: { textAlign: 'center', fontFamily: 'Nunito_700Bold', fontSize: 12 },
  nameA: { color: COLORS.beige },
  nameB: { color: COLORS.beige },
  vsTxt: { color: COLORS.goldAccent, fontSize: 11 },
});
