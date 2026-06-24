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
}

/** A compact "who'd win" card — two fighters facing off across a gold VS, one tap
 *  into the clash. Used by every discovery row (heroes and teams). */
export function MatchupCard({ a, b, onOpen, fit = 'cover' }: Props) {
  return (
    <Pressable onPress={onOpen} style={s.card}>
      <View style={s.duo}>
        <Portrait side={a} tint={FACTION_A} fit={fit} />
        <Portrait side={b} tint={FACTION_B} fit={fit} flip />
        <View style={s.vs} pointerEvents="none">
          <VsBadge size={32} variant="glass" />
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
  flip,
}: {
  side: Side;
  tint: string;
  fit: 'cover' | 'contain';
  flip?: boolean;
}) {
  return (
    <View style={[s.portrait, { borderColor: tint }]}>
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

const PW = 88;

const s = StyleSheet.create({
  card: { width: PW * 2 + 2, gap: 8, cursor: 'pointer' } as object,
  duo: { flexDirection: 'row', gap: 2, position: 'relative' },
  portrait: {
    width: PW,
    height: Math.round(PW * 1.2),
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
