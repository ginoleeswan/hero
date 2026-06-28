import { Fragment } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HeroTitle } from '../../lib/db/titles';
import { COLORS, SEAM_COLOR } from '../../constants/colors';
import { FilmTrailer } from './FilmTrailer';

const TOPBAR_HEIGHT = 64;

function formatRevenue(n: number | null): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export function FilmBackdropHeader({ film, onBack }: { film: HeroTitle; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = Platform.OS === 'web' && width >= 900;

  const isTv = film.mediaType === 'tv';
  const kicker = isTv ? 'TV Series' : film.mediaType === 'game' ? 'Game' : 'Film';

  // Stat rail — a single divided strip (ticket-stub feel) rather than floating pills.
  const stats: string[] = [
    film.year ? String(film.year) : null,
    film.runtime ? `${film.runtime} MIN` : null,
    film.voteAverage != null ? `★ ${film.voteAverage.toFixed(1)}` : null,
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

      {/* Dark vertical scrim — deepens toward the bottom so the title + rail read. */}
      <LinearGradient
        colors={['rgba(11,24,32,0.35)', 'rgba(11,24,32,0.78)', 'rgba(11,24,32,0.97)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Horizontal left-to-right scrim for web — keeps poster/title legible over bright backdrops */}
      {wide ? (
        <LinearGradient
          colors={['rgba(11,24,32,0.9)', 'rgba(11,24,32,0.0)']}
          locations={[0, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0 }}
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
          { paddingTop: wide ? TOPBAR_HEIGHT + 44 : insets.top + 60 },
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
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} numberOfLines={3}>
            {film.title}
          </Text>

          {stats.length > 0 ? (
            <View style={styles.statRail}>
              {stats.map((s, i) => (
                <Fragment key={s}>
                  {i > 0 ? <View style={styles.statDivider} /> : null}
                  <Text style={styles.statText}>{s}</Text>
                </Fragment>
              ))}
            </View>
          ) : null}

          {film.trailerKey ? (
            <View style={styles.ctaWrap}>
              <FilmTrailer trailerKey={film.trailerKey} accent />
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
    minHeight: Platform.OS === 'web' ? 500 : 340,
    justifyContent: 'flex-end',
    paddingBottom: 26,
    // Seam: warm orange hairline + soft drop where the dark stage meets the
    // beige body scrolling under it — the app's dark→paper signature.
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    ...Platform.select({
      web: { boxShadow: '0 16px 30px -22px rgba(0,0,0,0.55)' } as object,
      default: {},
    }),
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
    gap: 18,
  },
  contentRowWide: {
    maxWidth: 1180,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    gap: 28,
  },
  posterShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
    borderRadius: 12,
    flexShrink: 0,
  },
  posterClip: {
    borderRadius: 12,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  poster: {
    width: Platform.OS === 'web' ? 158 : 112,
    height: Platform.OS === 'web' ? 237 : 168,
  },
  posterPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  meta: {
    flex: 1,
    gap: 12,
    paddingBottom: 4,
  },
  kicker: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: Platform.OS === 'web' ? 46 : 28,
    color: '#fff',
    lineHeight: Platform.OS === 'web' ? 52 : 33,
    letterSpacing: Platform.OS === 'web' ? -0.5 : 0,
  },
  statRail: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 13,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  statText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.4,
  },
  ctaWrap: {
    marginTop: 8,
  },
});
