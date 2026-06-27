// src/components/search/TitleResultRow.tsx — native film/show search-hit row.
// Poster thumbnail + title + `year · media` meta, a doorway into /title/[id].
// The web surfaces use the web TitleResultRow; this is the native equivalent
// (PressScale feedback, expo-image poster).
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PressScale } from '../ui/PressScale';
import { COLORS } from '../../constants/colors';
import type { TitleSearchResult } from '../../lib/db/titles';

const MEDIA_LABEL: Record<string, string> = { film: 'Film', tv: 'TV', game: 'Game' };

export function TitleResultRow({
  title,
  onPress,
}: {
  title: TitleSearchResult;
  onPress: () => void;
}) {
  const meta = [title.year ?? null, MEDIA_LABEL[title.media_type] ?? title.media_type]
    .filter(Boolean)
    .join(' · ');
  return (
    <PressScale onPress={onPress} style={styles.row}>
      <View style={styles.poster}>
        {title.poster_url ? (
          <Image source={{ uri: title.poster_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Ionicons name="film-outline" size={18} color="rgba(245,235,220,0.3)" />
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title.title}
        </Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(245,235,220,0.35)" />
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  poster: {
    width: 38,
    height: 56,
    borderRadius: 7,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,235,220,0.08)',
  },
  text: { flex: 1, flexDirection: 'column' },
  title: { fontFamily: 'Flame-Regular', fontSize: 17, color: COLORS.beige },
  meta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});
