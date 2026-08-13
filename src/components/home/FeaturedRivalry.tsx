// Native "Featured Rivalry" — the curated lead for the Arena chapter: one rivalry
// as a full-width face-off banner (the versus identity), tapping into /compare.
// Mirrors the web FeaturedRivalry. Sits on the beige content sheet.
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { PressScale } from '../ui/PressScale';
import { VsBadge } from '../compare/VsBadge';
import { COLORS, EYEBROW } from '../../constants/colors';
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
      <PressScale style={s.card} scale={0.97} onPress={() => onOpen(`/compare/${a.id}/${b.id}`)}>
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
          colors={['rgba(11,24,32,0.85)', 'transparent']}
          locations={[0, 1]}
          style={s.topScrim}
        />
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
      </PressScale>
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
  // The kicker sat in raw orange on whatever art the two portraits happened to
  // be — 5.92:1 on ink, but nothing guarantees ink up there, and on a pale
  // costume it vanished. The names below it read fine only because the bottom
  // scrim gives them a canvas; this gives the kicker the same one.
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 72 },
  kicker: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    textAlign: 'center',
    ...EYEBROW,
    letterSpacing: 2.5,
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
    lineHeight: 27,
  },
  nameRight: { textAlign: 'right' },
});
