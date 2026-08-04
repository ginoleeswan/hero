import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, HOVER_TRANSITION } from '../constants/colors';
import { HeroImage } from './HeroImage';
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
/** Initials for a hero without a resolvable portrait — "Lex Luthor" → "LL". */
export function monogram(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase();
}

export function RelatedHeroStrip({
  label,
  names,
  heroMap,
  kind,
  onPressHero,
  edgeTint,
  monogramTiles,
}: {
  label: string;
  names: string[];
  heroMap: Map<string, RelatedHeroCard>;
  kind: RelatedKind;
  onPressHero: (hero: RelatedHeroCard) => void;
  /** Web dossier variant: cards carry a kind-tinted edge. */
  edgeTint?: boolean;
  /** Web dossier variant: unresolved names render as monogram tiles in the shelf. */
  monogramTiles?: boolean;
}) {
  const [showAllChips, setShowAllChips] = useState(false);
  if (names.length === 0) return null;

  const cards: RelatedHeroCard[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();
  const seenNames = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name || name === '-' || name === 'null') continue;
    const hero = heroMap.get(name);
    if (hero) {
      if (!seen.has(hero.id)) {
        cards.push(hero);
        seen.add(hero.id);
      }
    } else if (!seenNames.has(name)) {
      unresolved.push(name);
      seenNames.add(name);
    }
  }
  if (cards.length === 0 && unresolved.length === 0) return null;

  const accent = ACCENT[kind];
  const visibleChips = showAllChips ? unresolved : unresolved.slice(0, 8);
  const remainder = unresolved.length - visibleChips.length;
  const cardEdge = edgeTint ? { borderWidth: 1, borderColor: accent + '4d' } : null;

  return (
    <View style={styles.block}>
      <View style={styles.labelRow}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.label}>{label}</Text>
      </View>

      {cards.length > 0 || (monogramTiles && unresolved.length > 0) ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsRow}
        >
          {cards.map((hero) => (
            <Pressable
              key={hero.id}
              onPress={() => onPressHero(hero)}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
                [
                  styles.card,
                  cardEdge,
                  hovered && styles.cardHover,
                  pressed && { opacity: 0.85 },
                ] as object
              }
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
              <Text style={styles.cardName} numberOfLines={2}>
                {hero.name}
              </Text>
            </Pressable>
          ))}
          {monogramTiles
            ? visibleChips.map((name) => (
                <View key={name} style={[styles.card, styles.monoTile, cardEdge]}>
                  <Text style={[styles.monoText, { color: accent }]}>{monogram(name)}</Text>
                  <Text style={styles.cardName} numberOfLines={2}>
                    {name}
                  </Text>
                </View>
              ))
            : null}
          {monogramTiles && !showAllChips && remainder > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.card, styles.monoTile, cardEdge]}
              onPress={() => setShowAllChips(true)}
            >
              <Text style={[styles.monoText, { color: accent }]}>+{remainder}</Text>
              <Text style={styles.cardName}>more</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      ) : null}

      {!monogramTiles && unresolved.length > 0 ? (
        <View style={[styles.chipsWrap, cards.length > 0 && styles.chipsWrapSpaced]}>
          {visibleChips.map((name, i) => (
            <View key={`${i}-${name}`} style={styles.chip}>
              <Text style={styles.chipText}>{name}</Text>
            </View>
          ))}
          {!showAllChips && remainder > 0 ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.chip}
              onPress={() => setShowAllChips(true)}
            >
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
    // Web-only hover ease; native ignores hover entirely.
    ...(Platform.OS === 'web' ? ({ transition: HOVER_TRANSITION } as object) : null),
  } as object,
  cardHover: {
    transform: [{ translateY: -3 }],
    boxShadow: '0px 10px 22px rgba(41,60,67,0.30)',
  } as object,
  cardImage: { position: 'absolute', top: 0, left: 0, width: CARD_W, height: CARD_H },
  cardName: {
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    lineHeight: 15,
    color: COLORS.beige,
    paddingHorizontal: 9,
    paddingBottom: 9,
  },
  // Portrait-less relations keep their spot in the shelf as monogram tiles.
  monoTile: { alignItems: 'center', justifyContent: 'space-between', paddingTop: 34 },
  monoText: { fontFamily: 'Flame-Regular', fontSize: 32, lineHeight: 40 },

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
