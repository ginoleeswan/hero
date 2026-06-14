import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { RelatedHeroCard } from '../../lib/db/heroes';

const CARD_W = 104;
const CARD_H = 140;

function HeroCard({ hero, onPress }: { hero: RelatedHeroCard; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`View ${hero.name}`}
    >
      <HeroImage
        id={hero.id}
        name={hero.name}
        imageUrl={hero.image_url}
        portraitUrl={hero.portrait_url}
        imageMdUrl={hero.image_md_url}
        grid
        contentFit="cover"
        contentPosition="top"
        style={styles.cardImage}
        recyclingKey={hero.id}
        transition={150}
      />
      <LinearGradient
        colors={['transparent', 'rgba(20,28,32,0.9)']}
        locations={[0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.cardName} numberOfLines={2}>{hero.name}</Text>
    </TouchableOpacity>
  );
}

export function HeroesInFilmRail({ heroes, inCard }: { heroes: RelatedHeroCard[]; inCard?: boolean }) {
  const router = useRouter();
  if (heroes.length === 0) return null;

  const handlePress = (hero: RelatedHeroCard) =>
    router.push(`/character/${hero.id}?name=${encodeURIComponent(hero.name)}`);

  if (Platform.OS === 'web') {
    const grid = (
      <View style={[webStyles.grid, inCard && webStyles.bare] as object}>
        {heroes.map((hero) => (
          <HeroCard key={hero.id} hero={hero} onPress={() => handlePress(hero)} />
        ))}
      </View>
    );
    if (inCard) return grid;
    return (
      <View style={styles.block}>
        <Text style={styles.label}>Heroes in this Film</Text>
        {grid}
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Heroes in this Film</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {heroes.map((hero) => (
          <HeroCard key={hero.id} hero={hero} onPress={() => handlePress(hero)} />
        ))}
      </ScrollView>
    </View>
  );
}

const webStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 2,
  },
  bare: { paddingHorizontal: 0, paddingBottom: 0 },
});

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
  },
  row: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 2,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    boxShadow: '0px 4px 10px rgba(41,60,67,0.22)',
  },
  cardImage: { position: 'absolute', top: 0, left: 0, width: CARD_W, height: CARD_H },
  cardName: {
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    lineHeight: 14,
    color: COLORS.beige,
    paddingHorizontal: 9,
    paddingBottom: 9,
  },
});
