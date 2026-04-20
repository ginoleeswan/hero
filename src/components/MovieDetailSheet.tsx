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
            isDesktop ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, 28) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {!isDesktop ? (
            <View style={styles.handle} />
          ) : (
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={16} color={COLORS.navy} />
            </Pressable>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            <View style={styles.topRow}>
              {/* Poster */}
              <View style={styles.posterShadow}>
                <View style={styles.posterWrapper}>
                  {movie.imageUrl ? (
                    <Image
                      source={{ uri: movie.imageUrl }}
                      style={styles.poster}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.poster, styles.posterPlaceholder]}>
                      <Ionicons name="film-outline" size={30} color={COLORS.grey} />
                    </View>
                  )}
                </View>
              </View>

              {/* Meta */}
              <View style={styles.meta}>
                <Text style={styles.title}>{movie.name}</Text>

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
                    <Ionicons name="trending-up-outline" size={13} color={COLORS.green} />
                    <Text style={styles.revenue}>{revenue} box office</Text>
                  </View>
                ) : null}

                {movie.deck ? (
                  <Text style={styles.deck}>{movie.deck}</Text>
                ) : null}
              </View>
            </View>

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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdropDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '82%',
  },
  sheetDesktop: {
    width: 520,
    maxHeight: '88%',
    borderRadius: 20,
    paddingTop: 52,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.navy + '28',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.navy + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'flex-start',
  },
  posterShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderRadius: 10,
    flexShrink: 0,
  },
  posterWrapper: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  poster: {
    width: 100,
    height: 150,
  },
  posterPlaceholder: {
    backgroundColor: COLORS.navy + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meta: {
    flex: 1,
    paddingTop: 2,
    gap: 10,
  },
  title: {
    fontFamily: 'Flame-Bold',
    fontSize: 18,
    color: COLORS.navy,
    lineHeight: 23,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: COLORS.navy + '12',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pillText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.navy + 'cc',
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  revenue: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.green,
  },
  deck: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.navy + '99',
    lineHeight: 20,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    backgroundColor: COLORS.orange,
    borderRadius: 14,
  },
  linkBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
