// A horizontal rail of characters trending on Wikipedia this week — circular
// portrait + name + a ▲ +N% spike chip. Renders on both platforms (RN-Web safe).
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../HeroImage';
import { COLORS } from '../../constants/colors';
import type { WikiTrendingHero } from '../../lib/db/trending';

export function WikiTrendingRail({
  heroes,
  onHeroPress,
}: {
  heroes: WikiTrendingHero[];
  onHeroPress: (id: string) => void;
}) {
  if (heroes.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.label}>This Week</Text>
        <Text style={s.title}>Trending Now</Text>
      </View>
      <FlatList
        horizontal
        data={heroes}
        keyExtractor={(h) => h.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        initialNumToRender={6}
        renderItem={({ item }) => (
          <Pressable style={s.card} onPress={() => onHeroPress(item.id)}>
            <View style={s.avatar}>
              <HeroImage
                id={item.id}
                name={item.name}
                imageUrl={item.image_url}
                portraitUrl={item.portrait_url}
                grid
                contentFit="cover"
                contentPosition="top"
                style={StyleSheet.absoluteFill as object}
                recyclingKey={item.id}
              />
            </View>
            {item.spikePct > 0 ? (
              <View style={s.chip}>
                <Ionicons name="trending-up" size={10} color="#fff" />
                <Text style={s.chipText}>{item.spikePct}%</Text>
              </View>
            ) : null}
            <Text style={s.name} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginTop: 4, marginBottom: 8 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
  strip: { gap: 14, paddingHorizontal: 16, paddingBottom: 4 },
  card: { width: 76, alignItems: 'center', gap: 6 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: COLORS.navy,
  },
  chip: {
    position: 'absolute',
    top: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: COLORS.orange,
  },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff' },
  name: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.beige,
    textAlign: 'center',
    marginTop: 2,
  },
});
