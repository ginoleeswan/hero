// src/components/family/HouseLinks.tsx
// The way out of a character's family section and into the whole house.
//
// A character page shows one person's relatives; the house page shows the
// dynasty they sit in and can answer how they relate to anyone else in it.
// Someone reading a family section is already asking that question, so this is
// where the link belongs.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import type { HeroHouse } from '../../hooks/useHeroHouses';

export function HouseLinks({
  houses,
  heroId,
}: {
  houses: HeroHouse[];
  heroId: string | null;
}) {
  const router = useRouter();
  if (houses.length === 0) return null;

  return (
    <View style={styles.row}>
      {houses.map((house) => (
        <Pressable
          key={house.slug}
          accessibilityRole="link"
          accessibilityLabel={`See the ${house.name} family tree`}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.link, hovered && styles.linkHover] as object
          }
          onPress={() =>
            router.push(
              `/house/${house.slug}${heroId ? `?focus=${encodeURIComponent(heroId)}` : ''}`,
            )
          }
        >
          <View
            style={[styles.dot, { backgroundColor: house.sigil_tint ?? COLORS.orange }] as object}
          />
          <Text style={styles.text}>{house.name}</Text>
          <Ionicons name="chevron-forward" size={13} color={COLORS.navy} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e7dcc9',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  linkHover: { borderColor: '#cdbfa6' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.black, fontWeight: '700' },
});
