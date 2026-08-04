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
import { titleExtras } from '../../lib/db/titles';
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

  const extras = titleExtras(film);
  const certification = extras.certification ?? null;
  const genres = (extras.genres ?? []).slice(0, 3);
  const hasTags = !!certification || genres.length > 0;

  return (
    <View style={[styles.root, wide && styles.rootWide]}>
      {/* Backdrop */}
      {film.backdropUrl ? (
        <Image
          source={{ uri: film.backdropUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={400}
          // Full-bleed backdrop = the above-the-fold LCP element on title pages.
          priority="high"
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
          activeOpacity={0.7}
          onPress={onBack}
          style={[styles.backBtn, { top: insets.top + 12 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
      ) : null}

      {/* Poster + meta row. On wide the poster is omitted here — it floats from
          the body, crossing the seam — so the meta clears its column. */}
      <View
        style={[
          styles.contentRow,
          wide && styles.contentRowWide,
          { paddingTop: wide ? TOPBAR_HEIGHT + 44 : insets.top + 60 },
        ]}
      >
        {!wide ? (
          film.posterUrl ? (
            <View style={styles.posterShadow}>
              <View style={styles.posterClip}>
                <Image
                  source={{ uri: film.posterUrl }}
                  style={styles.poster}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={300}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]}>
              <Ionicons name="film-outline" size={30} color="rgba(255,255,255,0.5)" />
            </View>
          )
        ) : null}

        <View style={styles.meta}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={[styles.title, wide && styles.titleWide]} numberOfLines={3}>
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

          {hasTags ? (
            <View style={styles.tagRow}>
              {certification ? (
                <View style={styles.certBadge}>
                  <Text style={styles.certText}>{certification}</Text>
                </View>
              ) : null}
              {genres.map((g) => (
                <View key={g} style={styles.genrePill}>
                  <Text style={styles.genreText}>{g}</Text>
                </View>
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
    minHeight: Platform.OS === 'web' ? 420 : 340,
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
  // Wide: taller stage with bottom clearance so the body's cards can pull up and
  // straddle the seam without colliding with the title block.
  rootWide: {
    minHeight: 500,
    paddingBottom: 150,
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
    // Clear the floating poster's column (≈300 poster + gap) so the title sits
    // beside it; the poster itself floats up from the body.
    paddingLeft: 24 + 320,
    paddingRight: 24,
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
    fontSize: 28,
    color: '#fff',
    // Generous leading — the Flame display face has tall glyphs/descenders that
    // clip at a tight line-height.
    lineHeight: 36,
    paddingBottom: 2,
  },
  // Desktop only — mobile web keeps the smaller size.
  titleWide: {
    fontSize: 46,
    lineHeight: 58,
    letterSpacing: -0.5,
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 7,
    marginTop: 2,
  },
  certBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  certText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  genrePill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  genreText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  ctaWrap: {
    marginTop: 8,
  },
});
