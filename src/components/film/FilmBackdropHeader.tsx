import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HeroTitle } from '../../lib/db/titles';
import { COLORS } from '../../constants/colors';

const TOPBAR_HEIGHT = 64;

function formatRevenue(n: number | null): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export function FilmBackdropHeader({
  film,
  onBack,
}: {
  film: HeroTitle;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;

  const metaPills: string[] = [
    film.year ? String(film.year) : null,
    film.voteAverage != null ? `★ ${film.voteAverage.toFixed(1)}` : null,
    film.runtime ? `${film.runtime} min` : null,
    formatRevenue(film.revenue),
  ].filter((v): v is string => v !== null);

  return (
    <View style={styles.root}>
      {/* Backdrop */}
      {film.backdropUrl ? (
        <Image
          source={{ uri: film.backdropUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.backdropPlaceholder]} />
      )}

      {/* Dark vertical gradient scrim (bottom) */}
      <LinearGradient
        colors={['rgba(10,14,18,0.55)', 'rgba(10,14,18,0.72)', 'rgba(10,14,18,0.92)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Horizontal left-to-right gradient for web — keeps poster/title legible over bright backdrops */}
      {wide ? (
        <LinearGradient
          colors={['rgba(10,14,18,0.85)', 'rgba(10,14,18,0.0)']}
          locations={[0, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Back button — native only; web has the floating TopBar for navigation */}
      {Platform.OS !== 'web' ? (
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backBtn, { top: insets.top + 12 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
      ) : null}

      {/* Poster + meta row */}
      <View
        style={[
          styles.contentRow,
          wide && styles.contentRowWide,
          { paddingTop: wide ? TOPBAR_HEIGHT + 32 : insets.top + 56 },
        ]}
      >
        {film.posterUrl ? (
          <View style={styles.posterShadow}>
            <View style={styles.posterClip}>
              <Image
                source={{ uri: film.posterUrl }}
                style={styles.poster}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          </View>
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={30} color="rgba(255,255,255,0.5)" />
          </View>
        )}

        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={3}>{film.title}</Text>
          {metaPills.length > 0 ? (
            <View style={styles.pillRow}>
              {metaPills.map((p, i) => (
                <View key={i} style={styles.pill}>
                  <Text style={styles.pillText}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    minHeight: Platform.OS === 'web' ? 420 : 280,
    justifyContent: 'flex-end',
    paddingBottom: 24,
  },
  backdropPlaceholder: {
    backgroundColor: COLORS.navy,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    gap: 16,
  },
  contentRowWide: {
    maxWidth: 1040,
    alignSelf: 'center',
    width: '100%',
  },
  posterShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
    borderRadius: 10,
    flexShrink: 0,
  },
  posterClip: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  poster: {
    width: Platform.OS === 'web' ? 130 : 100,
    height: Platform.OS === 'web' ? 195 : 150,
  },
  posterPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meta: {
    flex: 1,
    gap: 10,
    paddingBottom: 4,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: Platform.OS === 'web' ? 32 : 26,
    color: '#fff',
    lineHeight: Platform.OS === 'web' ? 38 : 31,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pillText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
});
