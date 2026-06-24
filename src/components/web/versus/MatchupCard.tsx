import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { VsBadge } from '../../compare/VsBadge';
import { FACTION_A, FACTION_B } from '../../versus/factionColors';
import { COLORS } from '../../../constants/colors';

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
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [s.card, { width: pw * 2 + 2 }, hovered && (s.cardHover as object)] as object
      }
    >
      <View style={s.duo}>
        <Portrait side={a} tint={FACTION_A} fit={fit} pw={pw} />
        <Portrait side={b} tint={FACTION_B} fit={fit} pw={pw} flip />
        <View style={s.vs} pointerEvents="none">
          <VsBadge size={large ? 38 : 32} variant="glass" />
        </View>
      </View>
      <Text style={s.names} numberOfLines={1}>
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
        <View style={[StyleSheet.absoluteFill, s.mono, { backgroundColor: tint }]}>
          <Text style={s.monoTxt}>{side.name.slice(0, 1)}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: 8,
    cursor: 'pointer',
    transition: 'transform 160ms ease',
  } as object,
  cardHover: { transform: [{ translateY: -4 }] } as object,
  duo: { flexDirection: 'row', gap: 2, position: 'relative' },
  portrait: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    backgroundColor: '#16242b',
  },
  mirror: { transform: [{ scaleX: -1 }] },
  mono: { alignItems: 'center', justifyContent: 'center' },
  monoTxt: { fontFamily: 'Flame-Regular', fontSize: 30, color: 'rgba(255,255,255,0.85)' },
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
