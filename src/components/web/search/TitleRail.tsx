// src/components/web/search/TitleRail.tsx — a horizontal, poster-forward rail of
// film/TV/game hits for the /search results page. Posters are visual and a query
// can match many titles, so a swipe rail conserves vertical space (one row) and
// stops "Films & Shows" from burying the character grid on a phone. Beige-page
// styling (navy text); routes to /title/[id].
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { TitleSearchResult } from '../../../lib/db/titles';

const MEDIA_LABEL: Record<string, string> = { film: 'Film', tv: 'TV', game: 'Game' };

export function TitleRail({
  titles,
  onPress,
  edge = 0,
}: {
  titles: TitleSearchResult[];
  onPress: (id: string) => void;
  /** Horizontal page padding to bleed past so the rail scrolls edge-to-edge. */
  edge?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -edge } as object}
      contentContainerStyle={[styles.track, { paddingLeft: edge, paddingRight: edge }] as object}
    >
      {titles.map((t) => {
        const meta = [t.year ?? null, MEDIA_LABEL[t.media_type] ?? t.media_type]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={t.id}
            onPress={() => onPress(t.id)}
            accessibilityRole="link"
            accessibilityLabel={t.title}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.card, hovered && (styles.cardHover as object)] as object
            }
          >
            <View style={styles.poster as object}>
              {t.poster_url ? (
                <Image
                  source={{ uri: t.poster_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <Ionicons name="film-outline" size={22} color="rgba(245,235,220,0.35)" />
              )}
            </View>
            <Text style={styles.title as object} numberOfLines={2}>
              {t.title}
            </Text>
            {meta ? <Text style={styles.meta as object}>{meta}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const POSTER_W = 108;

const styles = StyleSheet.create({
  track: { gap: 12, paddingVertical: 2 } as object,
  card: {
    width: POSTER_W,
    cursor: 'pointer',
    transition: 'transform 180ms ease',
  } as object,
  cardHover: { transform: [{ translateY: -3 }] } as object,
  poster: {
    width: POSTER_W,
    height: Math.round(POSTER_W * 1.5),
    borderRadius: 10,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy,
    boxShadow: '0 6px 18px -8px rgba(11,24,32,0.45)',
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 13.5,
    lineHeight: 17,
    color: COLORS.beige,
    marginTop: 7,
  } as object,
  meta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.5)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 2,
  } as object,
});
