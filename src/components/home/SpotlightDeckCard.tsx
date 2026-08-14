// src/components/home/SpotlightDeckCard.tsx — one portrait in the tablet deck.
import { Pressable, StyleSheet } from 'react-native';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { Hero } from '../../lib/db/heroes';

export function SpotlightDeckCard({
  hero,
  width,
  height,
  opacity,
  active,
  onPress,
}: {
  hero: Hero;
  width: number;
  height: number;
  opacity: number;
  /** The front card opens the character; the rest step forward in the deck. */
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={active ? 'link' : 'button'}
      accessibilityLabel={active ? `View ${hero.name}` : `Show ${hero.name}`}
      style={[styles.card, { width, height, opacity }]}
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        contentFit="cover"
        // These portraits are a profile head-and-shoulders on a flat field: the
        // face sits in the upper third and the sides are background. Anchoring
        // high keeps the head whole even in a 20pt sliver, and spends the loss
        // on empty colour — the same reasoning as the web plate.
        contentPosition={{ top: '8%', left: '50%' }}
        style={StyleSheet.absoluteFill}
        recyclingKey={hero.id}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
  },
});
