// src/components/home/TitlePosterRail.tsx — a calm horizontal rail of film/TV
// posters for the "On Screen Now" section. The badge (In Theaters / provider /
// Coming) carries the status; the cast lives one tap away on the title page.
import { View, Text, FlatList, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { trendingBadge, type BadgeTone, type TrendingTitle } from '../../lib/db/trending';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_WIDTH * 0.34);
const CARD_H = Math.round(CARD_W * 1.5);

const BADGE_COLOR: Record<BadgeTone, string> = {
  theaters: COLORS.orange,
  streaming: COLORS.blue,
  coming: COLORS.gold,
};

export function TitlePosterRail({
  label,
  title,
  titles,
  onTitlePress,
}: {
  label: string;
  title: string;
  titles: TrendingTitle[];
  onTitlePress: (id: string) => void;
}) {
  if (titles.length === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.header}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.title}>{title}</Text>
      </View>
      <FlatList
        horizontal
        data={titles}
        keyExtractor={(t) => t.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.strip}
        removeClippedSubviews
        initialNumToRender={4}
        renderItem={({ item }) => {
          const badge = trendingBadge(item);
          const uri = item.poster_url ?? item.backdrop_url ?? undefined;
          return (
            <Pressable style={s.card} onPress={() => onTitlePress(item.id)}>
              {uri ? (
                <Image
                  source={{ uri }}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                  onError={(e) => console.warn('[TitlePoster onError]', uri, '::', e?.error ?? e)}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.navy }]} />
              )}
              <LinearGradient
                colors={['transparent', 'rgba(11,24,32,0.88)']}
                locations={[0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
              {badge && (
                <View style={[s.badge, { backgroundColor: BADGE_COLOR[badge.tone] }]}>
                  <Text style={s.badgeText} numberOfLines={1}>
                    {badge.label}
                  </Text>
                </View>
              )}
              <Text style={s.cardName} numberOfLines={2}>
                {item.title}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 4 },
  header: { paddingHorizontal: 16, marginBottom: 12 },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 2,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },
  strip: { gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: CARD_W - 16,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#fff',
  },
  cardName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.beige,
    lineHeight: 14,
    paddingHorizontal: 9,
    paddingBottom: 9,
  },
});
