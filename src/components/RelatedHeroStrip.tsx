import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/colors';
import { heroGridImageSource } from '../constants/heroImages';
import type { RelatedHeroCard } from '../lib/db/heroes';

const CARD_W = 104;
const CARD_H = 140;

type RelatedKind = 'enemy' | 'ally' | 'teammate';

const ACCENT: Record<RelatedKind, string> = {
  enemy: COLORS.red,
  ally: COLORS.green,
  teammate: COLORS.blue,
};

/**
 * One labelled group (Enemies or Allies) for the character screen. Names that
 * resolve to a hero in our DB render as navigable portrait cards; the rest fall
 * back to plain text chips so nothing is dropped.
 */
export function RelatedHeroStrip({
  label,
  names,
  heroMap,
  kind,
  onPressHero,
}: {
  label: string;
  names: string[];
  heroMap: Map<string, RelatedHeroCard>;
  kind: RelatedKind;
  onPressHero: (hero: RelatedHeroCard) => void;
}) {
  const [showAllChips, setShowAllChips] = useState(false);
  if (names.length === 0) return null;

  const cards: RelatedHeroCard[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name || name === '-' || name === 'null') continue;
    const hero = heroMap.get(name);
    if (hero) {
      if (!seen.has(hero.id)) {
        cards.push(hero);
        seen.add(hero.id);
      }
    } else {
      unresolved.push(name);
    }
  }
  if (cards.length === 0 && unresolved.length === 0) return null;

  const accent = ACCENT[kind];
  const visibleChips = showAllChips ? unresolved : unresolved.slice(0, 8);
  const remainder = unresolved.length - visibleChips.length;

  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.label}>{label}</Text>
      </View>

      {cards.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {cards.map((hero) => (
            <TouchableOpacity
              key={hero.id}
              activeOpacity={0.85}
              onPress={() => onPressHero(hero)}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`View ${hero.name}`}
            >
              <Image
                source={heroGridImageSource(
                  hero.id,
                  hero.image_url,
                  hero.portrait_url,
                  hero.image_md_url,
                )}
                contentFit="cover"
                contentPosition="top"
                style={styles.cardImage}
                cachePolicy="memory-disk"
                recyclingKey={hero.id}
                transition={150}
              />
              <LinearGradient
                colors={['transparent', 'rgba(20,28,32,0.9)']}
                locations={[0.4, 1]}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.cardName} numberOfLines={2}>
                {hero.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {unresolved.length > 0 ? (
        <View style={[styles.chipsWrap, cards.length > 0 && styles.chipsWrapSpaced]}>
          {visibleChips.map((name, i) => (
            <View key={`${i}-${name}`} style={styles.chip}>
              <Text style={styles.chipText}>{name}</Text>
            </View>
          ))}
          {!showAllChips && remainder > 0 ? (
            <TouchableOpacity style={styles.chip} onPress={() => setShowAllChips(true)}>
              <Text style={styles.chipText}>+{remainder} more</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 14 },
  // Label + fallback chips keep the 20px content margin; the card scroller below
  // runs full-bleed (its own paddingLeft aligns the first card to that margin).
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    color: COLORS.navy,
    opacity: 0.55,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardsRow: { flexDirection: 'row', gap: 10, paddingLeft: 20, paddingRight: 20, paddingBottom: 2 },
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

  // Fallback chips for names that don't resolve to a hero row.
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 20 },
  chipsWrapSpaced: { marginTop: 12 },
  chip: {
    backgroundColor: 'rgba(41,60,67,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.14)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  chipText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    letterSpacing: 0.2,
  },
});
