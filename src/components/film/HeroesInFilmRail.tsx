import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { RelatedHeroCard } from '../../lib/db/heroes';

const CARD_W = 104;
const CARD_H = 140;

export function HeroesInFilmRail({ heroes }: { heroes: RelatedHeroCard[] }) {
  const router = useRouter();
  if (heroes.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Heroes in this Film</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {heroes.map((hero) => (
          <TouchableOpacity
            key={hero.id}
            activeOpacity={0.85}
            onPress={() => router.push(`/character/${hero.id}?name=${encodeURIComponent(hero.name)}`)}
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
        ))}
      </ScrollView>
    </View>
  );
}

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
