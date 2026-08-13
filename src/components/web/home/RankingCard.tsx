import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { COLORS, ELEVATION, HOVER_TRANSITION, INK_TEXT } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
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
  const statVal = (hero[statKey] as number | null) ?? 0;
  const label = STAT_LABELS[statKey];

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }: { pressed: boolean; hovered?: boolean }) =>
        [rc.wrap, (hovered || pressed) && (rc.wrapHover as object)] as object
      }
    >
      <HeroImage
        id={String(hero.id)}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        imageMdUrl={hero.image_md_url ?? null}
        grid
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
        recyclingKey={String(hero.id)}
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
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    flexShrink: 0,
    cursor: 'pointer',
    transition: HOVER_TRANSITION,
    position: 'relative',
  } as object,
  wrapHover: {
    transform: [{ translateY: -6 }],
    boxShadow: ELEVATION.hover,
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
    fontSize: 10,
    color: INK_TEXT.faint,
  } as object,
});
