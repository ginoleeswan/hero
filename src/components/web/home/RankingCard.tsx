import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { heroImageSource } from '../../../constants/heroImages';
import type { Hero } from '../../../lib/db/heroes';

const CARD_W = 220;
const CARD_H = 310;

const STAT_LABELS: Record<'strength' | 'intelligence' | 'speed', string> = {
  strength: 'STR',
  intelligence: 'INT',
  speed: 'SPD',
};

interface RankingCardProps {
  hero: Hero;
  statKey: 'strength' | 'intelligence' | 'speed';
  onPress: () => void;
}

export function RankingCard({ hero, statKey, onPress }: RankingCardProps) {
  const source = heroImageSource(String(hero.id), hero.image_url, hero.portrait_url);
  const statVal = (hero[statKey] as number | null) ?? 0;
  const label = STAT_LABELS[statKey];

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [rc.wrap, hovered && (rc.wrapHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        cachePolicy="memory-disk"
        recyclingKey={String(hero.id)}
        transition={200}
      />
      <View style={rc.overlay as object} />
      <View style={rc.bottom}>
        <Text style={rc.name} numberOfLines={2}>
          {hero.name}
        </Text>
        <View style={rc.barTrack as object}>
          <View style={[rc.barFill, { width: `${statVal}%` } as object]} />
        </View>
        <Text style={rc.statLabel as object}>
          {label} {statVal}
        </Text>
      </View>
    </Pressable>
  );
}

const rc = StyleSheet.create({
  wrap: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    position: 'relative',
  } as object,
  wrapHover: {
    transform: [{ translateY: -6 }],
    boxShadow: '0 20px 52px rgba(0,0,0,0.38)',
    zIndex: 2,
  } as object,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.08) 55%, transparent 100%)',
  } as object,
  bottom: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 17,
    textShadow: '0 1px 6px rgba(0,0,0,0.9)',
    marginBottom: 8,
  } as object,
  barTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  } as object,
  barFill: {
    height: 3,
    backgroundColor: COLORS.orange,
    borderRadius: 2,
  } as object,
  statLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.5)',
  } as object,
});
