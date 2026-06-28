// Native "Featured Rivalry" — the curated lead for the Arena chapter: one rivalry
// as a full-width face-off banner (the versus identity), tapping into /compare.
// Mirrors the web FeaturedRivalry. Sits on the beige content sheet.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { VsBadge } from '../compare/VsBadge';
import { COLORS } from '../../constants/colors';
import type { Rivalry } from '../../lib/db/heroes';

export function FeaturedRivalry({
  rivalry,
  onOpen,
}: {
  rivalry: Rivalry;
  onOpen: (path: string) => void;
}) {
  const { a, b } = rivalry;
  return (
    <View style={s.wrap}>
      <Pressable style={s.card} onPress={() => onOpen(`/compare/${a.id}/${b.id}`)}>
        <View style={s.faceA}>
          <HeroImage
            id={a.id}
            name={a.name}
            imageUrl={a.image_url}
            portraitUrl={a.portrait_url}
            contentFit="cover"
            contentPosition={{ top: '28%', left: '50%' }}
            style={StyleSheet.absoluteFill as object}
            recyclingKey={a.id}
          />
        </View>
        <View style={s.faceB}>
          <HeroImage
            id={b.id}
            name={b.name}
            imageUrl={b.image_url}
            portraitUrl={b.portrait_url}
            contentFit="cover"
            contentPosition={{ top: '28%', left: '50%' }}
            style={[StyleSheet.absoluteFill, s.flip] as object}
            recyclingKey={b.id}
          />
        </View>
        <LinearGradient
          colors={['transparent', 'rgba(11,24,32,0.9)']}
          locations={[0.5, 1]}
          style={s.scrim}
        />
        <Text style={s.kicker}>{rivalry.crossUniverse ? 'Dream Match' : 'Settle the Debate'}</Text>
        <View style={s.center} pointerEvents="none">
          <VsBadge size={52} variant="solid" />
        </View>
        <View style={s.names}>
          <Text style={s.name} numberOfLines={1}>
            {a.name}
          </Text>
          <Text style={[s.name, s.nameRight]} numberOfLines={1}>
            {b.name}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  card: {
    height: 240,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  faceA: { position: 'absolute', top: 0, left: 0, width: '50%', height: '100%' },
  faceB: { position: 'absolute', top: 0, right: 0, width: '50%', height: '100%' },
  flip: { transform: [{ scaleX: -1 }] },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  kicker: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: {
    position: 'absolute',
    bottom: 16,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  name: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.beige,
    lineHeight: 24,
  },
  nameRight: { textAlign: 'right' },
});
