import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { titleExtras, extractProviders } from '../../src/lib/db/titles';
import {
  useTitle,
  useTitleHeroes,
  useRecommendedTitles,
  useCollectionTitles,
} from '../../src/lib/query/titleQueries';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { NotFoundView } from '../../src/components/NotFoundView';
import { TitleSkeleton, TitleBodySkeleton } from '../../src/components/skeletons/TitleSkeleton';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';
import { FilmBackdropHeader } from '../../src/components/film/FilmBackdropHeader';
import { WhereToWatch } from '../../src/components/film/WhereToWatch';
import { CastRail } from '../../src/components/film/CastRail';
import { StillsGallery } from '../../src/components/film/StillsGallery';
import { HeroesInFilmRail } from '../../src/components/film/HeroesInFilmRail';
import { RecommendationsRail } from '../../src/components/film/RecommendationsRail';
import { SocialLinks } from '../../src/components/film/SocialLinks';
import { ReviewsSection } from '../../src/components/film/ReviewsSection';
import { PageEndCap } from '../../src/components/web/PageEndCap';

function fmtMoney(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export default function TitleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const wide = isWeb && width >= 900;

  // Server state via React Query — revisits come from cache (the anti-flash gate
  // skips the skeleton), requests dedup, and data refreshes in the background.
  // placeholderData makes `film` a stub (poster + title + year) the instant you
  // arrive from a rail, so the header paints immediately; isPlaceholderData flags
  // it so recs/collection (which need the *real* row) wait for the live fetch.
  const titleQuery = useTitle(id);
  const film = id ? titleQuery.data : null; // stub | real | null | undefined
  const realFilm = film && !titleQuery.isPlaceholderData ? film : undefined;
  const heroes = useTitleHeroes(id).data;
  const recs = useRecommendedTitles(realFilm).data;
  const collection = useCollectionTitles(realFilm).data;

  // Document scroll so the page bleeds edge-to-edge under the iOS Safari toolbar
  // (dark backdrop header under the status bar, beige body to the very bottom).
  // No-ops on native. Called before the early returns so it applies in every state.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });

  // Two-stage reveal. The HEADER paints as soon as we have any title — a seeded
  // stub OR the real row — while the BODY stays gated on ALL its data and
  // crossfades in, so the body never shifts after landing.
  //   cold      = nothing yet (no seed): show the full-page skeleton (anti-flash
  //               gated, deepNavy shell so it fuses with the boot loader / stage).
  //   bodyReady = the real row plus heroes/recs/collection have all arrived.
  const cold = film === undefined;
  const coldPhase = useSkeletonTransition(cold);
  const bodyReady =
    realFilm != null && heroes !== undefined && recs !== undefined && collection !== undefined;
  // delay:0 — once the header is up, the body skeleton shows immediately under it
  // (no bare-shell window); it dissolves out (crossfade) the moment bodyReady.
  const bodyPhase = useSkeletonTransition(film != null && !bodyReady, { delay: 0 });

  if (cold) {
    return (
      <View style={styles.loadingShell}>
        <Stack.Screen options={{ headerShown: false }} />
        {coldPhase === 'skeleton' ? <TitleSkeleton insets={insets} /> : null}
      </View>
    );
  }

  if (film === null) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <NotFoundView
          stamp="Missing"
          stampColor={COLORS.red}
          icon="film-outline"
          headline="Title not found"
          subline="We don't have this title in the archive yet."
          actions={[{ label: 'Go back', primary: true, onPress: () => router.back() }]}
        />
      </View>
    );
  }

  const watch = extractProviders(film.watchProviders);
  const tmdbUrl = `https://www.themoviedb.org/${film.mediaType === 'tv' ? 'tv' : 'movie'}/${film.externalId}`;

  // ── Dossier cards (web) — match the character page's white-card design system ──
  // Trailer now lives in the backdrop hero as the primary CTA; the overview card
  // is text-only.
  const overviewCard = film.overview ? (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Overview</Text>
      <View style={styles.cardDivider} />
      <Text style={styles.cardOverview}>{film.overview}</Text>
    </View>
  ) : null;

  // Rails live in cards (single card header — `inCard` drops the rail's own
  // label) and scroll horizontally, bleeding to the card edges.
  const castCard =
    film.cast && film.cast.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cast</Text>
        <View style={styles.cardDivider} />
        <CastRail cast={film.cast} heroes={heroes ?? []} inCard />
      </View>
    ) : null;

  const stillsCard =
    film.stills && film.stills.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Stills</Text>
        <View style={styles.cardDivider} />
        <StillsGallery stills={film.stills} inCard />
      </View>
    ) : null;

  // By the time content renders, these have all loaded (see the `loading` gate),
  // so they're a simple present-or-absent — no rail skeletons needed inline.
  const heroesCard =
    heroes && heroes.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Heroes in this Film</Text>
        <View style={styles.cardDivider} />
        <HeroesInFilmRail heroes={heroes} inCard />
      </View>
    ) : null;

  const recsCard =
    recs && recs.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>You might also like</Text>
        <View style={styles.cardDivider} />
        <RecommendationsRail recommendations={recs} inCard />
      </View>
    ) : null;

  const universeCard =
    collection && collection.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>More in this Universe</Text>
        <View style={styles.cardDivider} />
        <RecommendationsRail recommendations={collection} inCard />
      </View>
    ) : null;

  const extras = titleExtras(film);
  const reviewsSection =
    extras.reviews && extras.reviews.length > 0 ? (
      <ReviewsSection reviews={extras.reviews} />
    ) : null;

  const isTv = film.mediaType === 'tv';
  const tv = (film.details ?? {}) as {
    seasons?: number | null;
    episodes?: number | null;
    episode_runtime?: number | null;
    networks?: string[] | null;
  };

  // Details now carries non-redundant credits/metadata (the hero stat rail still
  // owns year/runtime/rating/box office).
  const detailRows: { label: string; value: string }[] = [];
  if (extras.director) detailRows.push({ label: 'Director', value: extras.director });
  if (extras.writers && extras.writers.length > 0)
    detailRows.push({ label: 'Writers', value: extras.writers.slice(0, 3).join(', ') });
  if (isTv) {
    if (tv.seasons) detailRows.push({ label: 'Seasons', value: String(tv.seasons) });
    if (tv.episodes) detailRows.push({ label: 'Episodes', value: String(tv.episodes) });
    if (tv.episode_runtime)
      detailRows.push({ label: 'Episode', value: `${tv.episode_runtime} min` });
    if (tv.networks && tv.networks.length > 0)
      detailRows.push({ label: 'Network', value: tv.networks.join(', ') });
  }
  if (extras.productionCompanies && extras.productionCompanies.length > 0)
    detailRows.push({ label: 'Studio', value: extras.productionCompanies.slice(0, 2).join(', ') });
  const budget = fmtMoney(extras.budget);
  if (budget) detailRows.push({ label: 'Budget', value: budget });
  if (extras.originalLanguage)
    detailRows.push({ label: 'Language', value: extras.originalLanguage.toUpperCase() });
  if (extras.status && extras.status !== 'Released')
    detailRows.push({ label: 'Status', value: extras.status });

  const detailsCard =
    detailRows.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Details</Text>
        <View style={styles.cardDivider} />
        {detailRows.map((r, i) => (
          <View
            key={r.label}
            style={[styles.infoRow, i === detailRows.length - 1 && styles.infoRowLast] as object}
          >
            <Text style={styles.infoLabel}>{r.label}</Text>
            <Text style={styles.infoValue}>{r.value}</Text>
          </View>
        ))}
      </View>
    ) : null;

  const watchCard =
    watch.providers.length > 0 ? (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Where to Watch</Text>
        <View style={styles.cardDivider} />
        <WhereToWatch providers={watch.providers} link={watch.link} inCard />
      </View>
    ) : null;

  const socialCard = extras.externalIds ? (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Links</Text>
      <View style={styles.cardDivider} />
      <SocialLinks externalIds={extras.externalIds} />
    </View>
  ) : null;

  // The big poster that floats from the body up across the seam (wide only).
  const floatingPoster = (
    <View style={styles.posterFloat}>
      {film.posterUrl ? (
        <Image
          source={{ uri: film.posterUrl }}
          style={styles.posterFloatImg}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={300}
        />
      ) : (
        <View style={[styles.posterFloatImg, styles.posterFloatPlaceholder]}>
          <Ionicons name="film-outline" size={40} color={COLORS.grey} />
        </View>
      )}
    </View>
  );

  const tmdbLink = (
    <TouchableOpacity
      style={styles.tmdbLink}
      onPress={() => Linking.openURL(tmdbUrl)}
      activeOpacity={0.7}
    >
      <Ionicons name="open-outline" size={13} color={COLORS.orange} />
      <Text style={styles.tmdbLinkText}>View on TMDB</Text>
    </TouchableOpacity>
  );

  // Web bleeds under the iOS Safari toolbar via the document scroll set up in
  // `app/_layout.web.tsx`; an inner ScrollView would bound the page to 100dvh and
  // break that. Native keeps the component ScrollView.
  if (isWeb) {
    return (
      <View style={styles.webPage}>
        <Stack.Screen options={{ headerShown: false }} />
        <FilmBackdropHeader film={film} onBack={() => router.back()} />
        {/* Header is real (seeded stub or live row); the body waits on all its
            data and dissolves in over a body skeleton — so it never shifts. */}
        <View style={styles.bodyRegion}>
          {bodyReady ? (
            <View style={styles.bodyWrap}>
              {wide ? (
                <>
                  <View style={styles.bodyRowWide}>
                    <View style={styles.posterColWide}>
                      {floatingPoster}
                      <View style={styles.stickyInfo}>
                        {detailsCard}
                        {watchCard}
                        {socialCard}
                        {tmdbLink}
                      </View>
                    </View>
                    <View style={styles.mainCol}>
                      {overviewCard}
                      {castCard}
                      {stillsCard}
                      {heroesCard}
                      {reviewsSection}
                    </View>
                  </View>
                  <View style={styles.fullStack}>
                    {universeCard}
                    {recsCard}
                  </View>
                </>
              ) : (
                <View style={styles.bodyCol}>
                  {overviewCard}
                  {castCard}
                  {stillsCard}
                  {heroesCard}
                  {universeCard}
                  {recsCard}
                  {reviewsSection}
                  {detailsCard}
                  {watchCard}
                  {socialCard}
                  {tmdbLink}
                </View>
              )}
            </View>
          ) : (
            <TitleBodySkeleton />
          )}
          {/* Body crossfade: real body sits settled; the body skeleton dissolves
              off the top of it (header stays put), so placeholders resolve in place. */}
          {bodyPhase === 'crossfade' ? (
            <FadeOutSkeleton>
              <TitleBodySkeleton />
            </FadeOutSkeleton>
          ) : null}
        </View>
        {/* Close the paper sheet onto the ink floor (constant-ink chrome). */}
        <PageEndCap />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <FilmBackdropHeader film={film} onBack={() => router.back()} />

        {/* Header is real (seeded stub or live row); the body waits on all its
            data, then swaps in (gated → in place, no shift). */}
        {bodyReady ? (
          <>
            {film.overview ? (
              <View style={styles.section}>
                <Text style={styles.eyebrow}>Overview</Text>
                <Text style={styles.overview}>{film.overview}</Text>
              </View>
            ) : null}
            {watch.providers.length > 0 ? (
              <View style={styles.railSection}>
                <WhereToWatch providers={watch.providers} link={watch.link} />
              </View>
            ) : null}
            {film.cast && film.cast.length > 0 ? (
              <View style={styles.railSection}>
                <CastRail cast={film.cast} heroes={heroes ?? []} />
              </View>
            ) : null}
            {film.stills && film.stills.length > 0 ? (
              <View style={styles.railSection}>
                <StillsGallery stills={film.stills} />
              </View>
            ) : null}
            {heroes && heroes.length > 0 ? (
              <View style={styles.railSection}>
                <HeroesInFilmRail heroes={heroes} />
              </View>
            ) : null}
            {collection && collection.length > 0 ? (
              <View style={styles.railSection}>
                <RecommendationsRail recommendations={collection} label="More in this Universe" />
              </View>
            ) : null}
            {recs && recs.length > 0 ? (
              <View style={styles.railSection}>
                <RecommendationsRail recommendations={recs} />
              </View>
            ) : null}
            {reviewsSection ? <View style={styles.railSection}>{reviewsSection}</View> : null}
            {detailRows.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.eyebrow}>Details</Text>
                {detailRows.map((r, i) => (
                  <View
                    key={r.label}
                    style={
                      [styles.infoRow, i === detailRows.length - 1 && styles.infoRowLast] as object
                    }
                  >
                    <Text style={styles.infoLabel}>{r.label}</Text>
                    <Text style={styles.infoValue}>{r.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {extras.externalIds ? (
              <View style={styles.section}>
                <Text style={styles.eyebrow}>Links</Text>
                <SocialLinks externalIds={extras.externalIds} />
              </View>
            ) : null}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => Linking.openURL(tmdbUrl)}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={14} color="#fff" />
                <Text style={styles.linkBtnText}>View on TMDB</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TitleBodySkeleton />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.beige,
    // Web must grow with the document-scrolled content; native bounds its ScrollView.
    ...Platform.select({ web: { minHeight: '100lvh' } as object, default: { flex: 1 } }),
  } as object,
  // Loading shell: deepNavy so it fuses with the boot LogoLoader and the
  // skeleton's dark stage (no beige flash between them on web refresh).
  loadingShell: { flex: 1, backgroundColor: COLORS.deepNavy },
  // Web: document-scrolled page (no inner ScrollView) so the body bleeds under
  // the iOS Safari toolbar. paddingBottom keeps the last card off the toolbar.
  webPage: { width: '100%', backgroundColor: COLORS.beige, paddingBottom: 40 },
  // Positioned wrapper for the body so the FadeOutSkeleton overlay (absoluteFill)
  // scopes to the body region and aligns with it (the body floats up across the
  // seam via marginTop, which the overlay inherits identically).
  bodyRegion: { position: 'relative' },
  scroll: { flex: 1 },
  scrollContent: { gap: 0 },

  // ── Native stacked layout ──
  section: { paddingHorizontal: 20, paddingTop: 24 },
  railSection: { paddingTop: 24 },
  eyebrow: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  overview: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    color: COLORS.navy + 'cc',
    lineHeight: 23,
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

  // ── Web dossier (matches character page tokens) ──
  bodyWrap: { maxWidth: 1180, alignSelf: 'center', width: '100%' },
  bodyCol: { padding: 20, gap: 16 },
  mainCol: { flex: 1, minWidth: 0, gap: 18 } as object,
  // Wide: row stretches so the left column matches the main column's height —
  // that lets the info block stay sticky through the whole scroll without a gap.
  bodyRowWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 24,
    paddingHorizontal: 24,
    marginTop: -128,
  } as object,
  posterColWide: { width: 300, flexShrink: 0, gap: 18 } as object,
  // The poster floats high and scrolls away; the info pins beneath it.
  stickyInfo: { gap: 18, position: 'sticky', top: 80 } as object,
  // Full-width stack below the two columns (universe, recommendations).
  fullStack: { paddingHorizontal: 24, paddingTop: 18, gap: 18 },
  posterFloat: {
    marginTop: -260,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0 30px 60px -22px rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  } as object,
  posterFloatImg: { width: 300, height: 450 },
  posterFloatPlaceholder: {
    backgroundColor: COLORS.navy + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e8ddd0',
    boxShadow: '0 14px 36px -12px rgba(41,60,67,0.16)',
  } as object,
  cardTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  cardDivider: { height: 1, backgroundColor: '#ede5da', marginBottom: 14 },
  cardOverview: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    color: COLORS.navy + 'cc',
    lineHeight: 23,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0ea',
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    flexShrink: 0,
    marginRight: 8,
  },
  infoValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    color: COLORS.navy,
    textAlign: 'right',
    flex: 1,
  },
  tmdbLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  tmdbLinkText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.2,
  },
});
