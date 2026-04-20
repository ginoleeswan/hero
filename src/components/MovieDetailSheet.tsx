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
  if (isNaN(n)) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function MovieDetailSheet({ movie, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = Platform.OS === 'web' && width >= 700;
  const revenue = formatRevenue(movie.totalRevenue);

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
            isDesktop ? styles.sheetDesktop : { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {!isDesktop ? <View style={styles.handle} /> : (
            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.posterRow}>
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
                    <Ionicons name="film-outline" size={32} color={COLORS.grey} />
                  </View>
                )}
              </View>

              <View style={styles.posterMeta}>
                <Text style={styles.label}>On Screen</Text>
                <Text style={styles.title}>{movie.name}</Text>
                {movie.year ? <Text style={styles.year}>{movie.year}</Text> : null}
                <View style={styles.badgeRow}>
                  {movie.rating ? <Badge label={movie.rating} color={COLORS.orange} /> : null}
                  {movie.runtime ? <Badge label={`${movie.runtime} min`} color={COLORS.navy} /> : null}
                </View>
                {revenue ? (
                  <View style={styles.revenueRow}>
                    <Ionicons name="trending-up-outline" size={13} color={COLORS.green} />
                    <Text style={styles.revenue}>{revenue} box office</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {movie.deck ? <Text style={styles.deck}>{movie.deck}</Text> : null}

            <Pressable style={styles.linkBtn} onPress={handleOpenUrl}>
              <Ionicons name="open-outline" size={14} color={COLORS.orange} />
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
    width: 480,
    maxHeight: '85%',
    borderRadius: 16,
    paddingTop: 48,
    paddingBottom: 24,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  posterRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  posterWrapper: {
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  poster: {
    width: 100,
    height: 150,
  },
  posterPlaceholder: {
    width: 100,
    height: 150,
    backgroundColor: COLORS.navy + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterMeta: {
    flex: 1,
    paddingTop: 2,
  },
  label: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Flame-Bold',
    fontSize: 17,
    color: COLORS.navy,
    lineHeight: 22,
    marginBottom: 3,
  },
  year: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    letterSpacing: 0.3,
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
    color: COLORS.navy + 'bb',
    lineHeight: 20,
    marginBottom: 20,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.orange + '18',
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  linkBtnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.orange,
  },
});
