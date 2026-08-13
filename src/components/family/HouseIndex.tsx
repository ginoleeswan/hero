// src/components/family/HouseIndex.tsx
// Every house in the catalogue, as crests.
//
// Shared by the /house route's two platform files and by the universe page's
// row, so a house reads the same wherever you meet it. The crest carries the
// card: a grid of eight identical text tiles would be a list with extra steps,
// and the shield is the one thing that makes a house recognisable at a glance.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, HOUSE_INK } from '../../constants/colors';
import { HouseCrest } from './HouseCrest';
import type { HouseSearchResult } from '../../lib/db/houses';

export function HouseCard({ house, width }: { house: HouseSearchResult; width?: number }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${house.name} family tree`}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/house/${house.slug}` as Parameters<typeof router.push>[0]);
      }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.card,
          width ? { width } : null,
          hovered && (styles.cardHover as object),
          pressed && styles.pressed,
        ] as object
      }
    >
      <HouseCrest name={house.name} tint={house.sigil_tint ?? COLORS.orange} size={78} />
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={2}>
          {house.name}
        </Text>
        {house.words ? (
          <Text style={styles.words} numberOfLines={1}>
            {house.words}
          </Text>
        ) : null}
        <Text style={styles.count}>
          {house.memberCount} {house.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
    </Pressable>
  );
}

export function HouseGrid({ houses }: { houses: HouseSearchResult[] }) {
  if (houses.length === 0) return null;
  return (
    <View style={styles.grid}>
      {houses.map((h) => (
        <HouseCard key={h.slug} house={h} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  pressed: { opacity: 0.6 },
  card: {
    flexGrow: 1,
    flexBasis: 190,
    maxWidth: 260,
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eadfcb',
    paddingVertical: 22,
    paddingHorizontal: 16,
    transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease',
    cursor: 'pointer',
  } as object,
  cardHover: { transform: [{ translateY: -3 }], borderColor: '#cdbfa6' } as object,
  meta: { alignItems: 'center', gap: 3 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 19,
    lineHeight: 25,
    color: COLORS.black,
    textAlign: 'center',
  },
  words: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12.5,
    color: '#8d8375',
    textAlign: 'center',
  },
  count: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: HOUSE_INK,
    marginTop: 3,
  },
});
