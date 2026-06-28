// src/components/home/MonthInHistoryRail.tsx — "This Month in History": the vintage
// debut covers of characters who first appeared in the current calendar month,
// each with its anniversary. Sibling of ComicCoverRail; taps open the character.
import { View, Text, FlatList, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import type { DebutHero } from '../../lib/db/anniversaries';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.min(132, Math.round(SCREEN_WIDTH * 0.34));
const CARD_H = Math.round(CARD_W * 1.5);

const MONTH = new Date().toLocaleString('en-US', { month: 'long' });

export function MonthInHistoryRail({
  debuts,
  onHeroPress,
}: {
  debuts: DebutHero[];
  onHeroPress: (id: string) => void;
}) {
  if (debuts.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.label}>This Month</Text>
        <Text style={s.title}>Debuts in {MONTH}</Text>
      </View>
      <FlatList
        horizontal
        data={debuts}
        keyExtractor={(d) => d.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        initialNumToRender={4}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => onHeroPress(item.id)}>
            {item.debut_cover_url ? (
              <Image
                source={{ uri: item.debut_cover_url }}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, s.fallback]} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(11,24,32,0.92)']}
              locations={[0.4, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.badge}>
              <Text style={s.badgeText}>{item.yearsAgo} yrs</Text>
            </View>
            <Text style={s.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={s.year}>{item.year}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 6 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
  strip: { gap: 10, paddingHorizontal: 15, paddingBottom: 4 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  fallback: { backgroundColor: COLORS.navy },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: COLORS.orange,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#fff',
  },
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    lineHeight: 13,
    paddingHorizontal: 8,
  },
  year: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.6)',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 1,
  },
});
