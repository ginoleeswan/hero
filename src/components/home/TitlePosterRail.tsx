// src/components/home/TitlePosterRail.tsx — a calm horizontal rail of film/TV
// posters for the "On Screen Now" section. The badge (In Theaters / provider /
// Coming) carries the status; the cast lives one tap away on the title page.
import { View, FlatList, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from '../ui/PressScale';
import { COLORS } from '../../constants/colors';
import { trendingBadge, type BadgeTone, type TrendingTitle } from '../../lib/db/trending';
import { railCardWidth } from '../../constants/layout';

const BADGE_ICON: Record<BadgeTone, 'ticket-outline' | 'calendar-outline' | null> = {
  theaters: 'ticket-outline',
  coming: 'calendar-outline',
  // Fallback for a streamer with no logo: the pill carries its name, and a name
  // isn't a status, so it gets no borrowed glyph.
  streaming: null,
};

const BADGE_COLOR: Record<BadgeTone, string> = {
  theaters: COLORS.orange,
  streaming: COLORS.blue,
  coming: COLORS.gold,
};

/**
 * The card's size, live.
 *
 * Was computed once from Dimensions.get('window') at import — correct on a
 * phone, frozen at launch orientation on an iPad. Above the tablet threshold
 * it becomes a fixed 170pt rather than 34% of the window, so a wide
 * screen shows more cards instead of enormous ones.
 */
function useCardSize() {
  const { width } = useWindowDimensions();
  const w = railCardWidth(width, 0.34, 170);
  return { width: w, height: Math.round(w * 1.5) };
}

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
  // Before the early return: a hook after it would be a conditional hook.
  const cardSize = useCardSize();
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
            <PressScale style={[s.card, cardSize]} onPress={() => onTitlePress(item.id)}>
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
              {/* Mirrors the web rail: a streamer shows its own mark, a status
                  shows a labelled pill. Different shapes for different kinds of
                  fact — where you can watch it vs. when it lands. */}
              {item.provider_logo ? (
                <View style={s.providerMark} accessibilityLabel={item.provider ?? 'Streaming'}>
                  <Image
                    source={{ uri: item.provider_logo }}
                    contentFit="cover"
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              ) : badge ? (
                <View style={s.badge}>
                  {BADGE_ICON[badge.tone] ? (
                    <Ionicons
                      name={BADGE_ICON[badge.tone]!}
                      size={10}
                      color={BADGE_COLOR[badge.tone]}
                    />
                  ) : null}
                  <Text style={s.badgeText} numberOfLines={1}>
                    {badge.label}
                  </Text>
                </View>
              ) : null}
              <Text style={s.cardName} numberOfLines={2}>
                {item.title}
              </Text>
            </PressScale>
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
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
  },
  // Dark chip rather than a block of colour, matching the web rail: a status
  // shouldn't out-shout the brand marks or the poster art. Colour lives on the
  // icon, where it still signals.
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    // Self-relative, not a copy of the card's width: the badge is absolutely
    // positioned inside the card, so a percentage resolves against the card and
    // stays right at any window size. It used to be `CARD_W - 16`, which was a
    // second place the card's width was written down.
    maxWidth: '90%',
    backgroundColor: 'rgba(11,24,32,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.22)',
  },
  // Square, full-bleed, already brand-coloured — chrome would only get in the
  // way. The hairline keeps the near-black marks off a dark poster edge.
  providerMark: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.28)',
    backgroundColor: COLORS.deepNavy,
  },
  badgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.beige,
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
