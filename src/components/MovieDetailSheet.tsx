import { Modal, View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions, Platform, Linking } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MovieAppearance } from '../types';
import { COLORS } from '../constants/colors';

interface Props {
  movie: MovieAppearance;
  onClose: () => void;
}

function formatRevenue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export function MovieDetailSheet({ movie, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = Platform.OS === 'web' && width >= 700;
  const revenue = formatRevenue(movie.totalRevenue);

  const metaPills: string[] = [
    movie.year ?? null,
    movie.rating ?? null,
    movie.runtime ? `${movie.runtime} min` : null,
  ].filter((v): v is string => v !== null);

  const handleOpenUrl = () => {
    const url =
      movie.url ?? `https://www.google.com/search?q=${encodeURIComponent(movie.name + ' film')}`;
    Linking.openURL(url);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.backdrop, isDesktop && styles.backdropDesktop]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            isDesktop ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle / close */}
          {!isDesktop ? <View style={styles.handle} /> : (
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Poster + primary meta */}
            <View style={styles.topRow}>
              <View style={styles.posterWrapper}>
                {movie.imageUrl ? (
                  <Image
                    source={{ uri: movie.imageUrl }}
                    style={styles.poster}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View style={styles.posterPlaceholder}>
                    <Ionicons name="film-outline" size={28} color={COLORS.grey} />
                  </View>
                )}
              </View>

              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={4}>{movie.name}</Text>

                {metaPills.length > 0 ? (
                  <View style={styles.pillRow}>
                    {metaPills.map((p, i) => (
                      <View key={i} style={styles.pill}>
                        <Text style={styles.pillText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {revenue ? (
                  <View style={styles.revenueRow}>
                    <Ionicons name="trending-up-outline" size={12} color={COLORS.green} />
                    <Text style={styles.revenue}>{revenue} box office</Text>
                  </View>
                ) : null}

                {movie.deck ? (
                  <Text style={styles.deck} numberOfLines={6}>{movie.deck}</Text>
                ) : null}
              </View>
            </View>

            {/* CTA */}
            <Pressable style={styles.linkBtn} onPress={handleOpenUrl}>
              <Ionicons name="open-outline" size={14} color="#fff" />
              <Text style={styles.linkBtnText}>View on ComicVine</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdropDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  sheetDesktop: {
    width: 440,
    maxHeight: '85%',
    borderRadius: 16,
    paddingTop: 48,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.navy + '30',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.navy + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  posterWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  poster: {
    width: 90,
    height: 135,
  },
  posterPlaceholder: {
    width: 90,
    height: 135,
    backgroundColor: COLORS.navy + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meta: {
    flex: 1,
    paddingTop: 4,
    gap: 8,
  },
  title: {
    fontFamily: 'Flame-Bold',
    fontSize: 19,
    color: COLORS.navy,
    lineHeight: 24,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: COLORS.navy + '14',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revenue: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.green,
  },
  deck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy + 'aa',
    lineHeight: 19,
    marginTop: 8,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    marginTop: 4,
  },
  linkBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: '#fff',
  },
});
