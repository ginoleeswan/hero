import { useCallback, useEffect, useMemo, useState } from 'react';
import { queryClient } from '../lib/query/queryClient';
import { exploreKeys } from '../lib/query/keys';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fetchHeroDetails, fetchHeroGallery } from '../lib/api';
import { heroRowToCharacterData, type RelatedHeroCard } from '../lib/db/heroes';
import { useHeroRow, useHeroPercentile, useRelatedHeroes } from '../lib/query/heroQueries';
import {
  useHeroFamily,
  useHeroNarrative,
  useHeroTitles,
  useHeroPortrayals,
  useHeroLinks,
  useHeroIssues,
  useIsAdmin,
} from '../lib/query/heroDetailQueries';
import { planHeroLoad } from '../lib/query/heroLoadPlan';
import {
  isFavourited,
  addFavourite,
  removeFavourite,
  getHeroFavouriteCount,
} from '../lib/db/favourites';
import { useAuth } from './useAuth';
import { useRecordView } from './useViewHistory';
import { trackEvent } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { getHeroImages } from '../lib/db/heroImages';
import type { CharacterData, HeroImage } from '../types';

// Power-stat keys in dial order. The view keeps its own STAT_CONFIG (keys + tints
// + labels) for rendering; the hook only needs the keys to total the stats.
const STAT_KEYS = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'];

export interface UseHeroDetailParams {
  id: string;
  paramName?: string;
  paramImageUri?: string;
}

/**
 * Platform-neutral data layer for the character detail screen. Owns every fetch,
 * piece of loaded state, and derived value the `app/character/[id].{tsx,web.tsx}`
 * views render — so the views stay thin and the two platforms can't drift.
 *
 * The views keep their own UI-only state (edit sheet, lightbox, animations,
 * scroll/quick-nav) and consume this hook's output by identical name.
 */
export function useHeroDetail({ id, paramName, paramImageUri }: UseHeroDetailParams) {
  const { user } = useAuth();
  useRecordView(user?.id, id);

  const [data, setData] = useState<CharacterData | null>(null);
  const [comicVineLoading, setComicVineLoading] = useState(true);
  const [statsGenerating, setStatsGenerating] = useState(false);
  // Two distinct failure modes: the hero genuinely doesn't exist (404 → poster),
  // versus a transient load failure (network/server → retryable). `retryToken`
  // re-runs the load effect when the user taps Retry.
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [favourited, setFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [favCount, setFavCount] = useState<number>(0);
  const [galleryImages, setGalleryImages] = useState<HeroImage[] | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const heroRowQuery = useHeroRow(id);
  const heroRow = heroRowQuery.data;

  // Secondary read-only data via React Query (keyed by hero id) — cached across
  // revisits, deduped, no longer manual useEffect/useState. The ComicVine
  // read-through enrichment (below) and the favourite toggle stay imperative.
  const isAdmin = useIsAdmin(user?.id).data ?? false;
  const family = useHeroFamily(id).data ?? [];
  const narrative = useHeroNarrative(id).data ?? null;
  const titles = useHeroTitles(id).data ?? null;
  const portrayals = useHeroPortrayals(id).data ?? null;
  const links = useHeroLinks(id).data ?? null;
  const newIssues = useHeroIssues(id).data ?? [];

  // Total powerstats — drives both the vitals strip and the percentile hook.
  const powerTotal = useMemo(() => {
    if (!data) return 0;
    return STAT_KEYS.map((key) =>
      parseInt((data.stats.powerstats as Record<string, string>)[key] ?? '0', 10),
    )
      .filter((n) => !isNaN(n) && n > 0)
      .reduce((sum, n) => sum + n, 0);
  }, [data]);

  const { data: percentile } = useHeroPercentile(powerTotal || null);

  // A hero with a cover image gets the visual "First Appearance" section; without
  // one, the same fact shows as a text row inside the Dossier (no duplication).
  const hasFirstVisual = !!data?.firstIssue?.imageUrl;

  // Enemies / allies / teammates from the relationship graph (same-universe,
  // popularity-ranked). The map drives the enemy/ally strips; teammates render
  // straight from the graph (there's no ComicVine "teammates" name list).
  const { data: related } = useRelatedHeroes(id);
  const relatedHeroMap = useMemo(() => {
    const m = new Map<string, RelatedHeroCard>();
    for (const h of [
      ...(related?.enemies ?? []),
      ...(related?.allies ?? []),
      ...(related?.teammates ?? []),
    ]) {
      m.set(h.name, h);
    }
    return m;
  }, [related]);
  // Names in the graph's popularity-ranked order so the strips lead with the
  // recognisable foes/allies/teammates (every one resolves to a card).
  const enemyNames = useMemo(() => (related?.enemies ?? []).map((h) => h.name), [related]);
  const allyNames = useMemo(() => (related?.allies ?? []).map((h) => h.name), [related]);
  const teammateNames = useMemo(() => (related?.teammates ?? []).map((h) => h.name), [related]);

  useEffect(() => {
    if (!id) return;

    const plan = planHeroLoad({
      isPlaceholderData: heroRowQuery.isPlaceholderData,
      isError: heroRowQuery.isError,
      isSuccess: heroRowQuery.isSuccess,
      row: heroRow,
    });

    // Still resolving (instant placeholder, or no row yet) — keep the skeleton.
    if (plan === 'wait') return;

    // The DB is the only source of characters. An id with no row is not-found —
    // never fetched live from the external SuperheroAPI, which still resolves
    // ids we merged away (e.g. 70 → Batman 69) and used to fabricate a full
    // phantom page for them.
    if (plan === 'not-found') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotFound(true);
      return;
    }

    // Transient row-query failure — retryable error screen, not a false 404.
    if (plan === 'error') {
      setLoadError(true);
      return;
    }

    // plan === 'render-row': a real DB row exists. Paint from it immediately, then
    // layer ComicVine enrichment on top. This serves both base-enriched heroes and
    // ComicVine-only `cv-` heroes (e.g. the franchise characters), which never get
    // an `enriched_at` timestamp and previously fell through to a 404'ing
    // SuperheroAPI fetch that wiped the screen.
    if (heroRow) {
      // Seed the screen from the already-loaded row so it paints instantly.
      // Effect-based detail fetch (pre-React-Query).
      setData(heroRowToCharacterData(heroRow));

      // Gallery images (primary art + covers, multi-source) from hero_images.
      getHeroImages(heroRow.id)
        .then((imgs) => {
          if (imgs.length > 0) setGalleryImages(imgs);
        })
        .catch(() => {});

      // First-ever fetch: enrich from ComicVine, then re-read the rows.
      const needsGallery = heroRow.comicvine_id != null && heroRow.gallery_enriched_at === null;
      if (needsGallery) {
        setGalleryLoading(true);
        fetchHeroGallery(heroRow.id, heroRow.comicvine_id!)
          .then(() => getHeroImages(heroRow.id))
          .then((imgs) => {
            if (imgs.length > 0) setGalleryImages(imgs);
          })
          .catch(() => {})
          .finally(() => setGalleryLoading(false));
      }

      // Refetch ComicVine only when this hero has never been successfully
      // enriched. Gate on the terminal `comicvine_status` (written by the
      // get-comicvine-hero edge fn) — NOT on individual fields being null.
      // ComicVine legitimately returns no powers/movies for civilians, and the
      // old field-nullness gate treated that as "unfetched", so ~97% of heroes
      // re-fetched ~13 ComicVine calls on every single view, forever.
      // IGDB-sourced heroes have no ComicVine identity (comicvine_status stays
      // null). Without this guard they'd fire a get-comicvine-hero read-through
      // by name on every view — wasteful and liable to match the wrong comic
      // character. Their DB row is already the source of truth.
      const cvStatus = heroRow.comicvine_status;
      const isIgdbHero = heroRow.igdb_id != null;
      const needsComicVine = !isIgdbHero && (cvStatus == null || cvStatus === 'pending');
      const moviesIncomplete =
        !needsComicVine &&
        heroRow.movie_count != null &&
        heroRow.movies != null &&
        heroRow.movie_count > (heroRow.movies as unknown[]).length;
      const moviesLackDetail =
        !needsComicVine &&
        !moviesIncomplete &&
        heroRow.movies != null &&
        (heroRow.movies as unknown[]).length > 0 &&
        (
          heroRow.movies as {
            deck?: string | null;
            rating?: string | null;
            runtime?: string | null;
          }[]
        )
          .slice(0, 5)
          .every((m) => m.deck === null && m.rating === null && m.runtime === null);
      setComicVineLoading(needsComicVine);

      if (needsComicVine || moviesIncomplete || moviesLackDetail) {
        fetchHeroDetails(heroRow.id, heroRow.name)
          .then((details) => {
            setData((prev) => {
              if (!prev) return prev;
              const p = prev.details;
              // Additive merge: the live ComicVine fetch FILLS gaps, it must never
              // ERASE a good DB value. Every field ComicVine returns as null falls
              // back to what the row already had — so a partial response (or an
              // all-null NULL_RESPONSE when ComicVine is throttled/unmatched) keeps
              // the DB data on screen instead of flashing it then blanking it.
              // Listing fields explicitly makes tsc flag any HeroDetails addition.
              return {
                ...prev,
                details: {
                  summary: details.summary ?? p.summary,
                  publisher: details.publisher ?? p.publisher,
                  firstIssueId: details.firstIssueId ?? p.firstIssueId,
                  firstIssueData: details.firstIssueData ?? p.firstIssueData,
                  powers: details.powers ?? p.powers,
                  description: details.description ?? p.description,
                  origin: details.origin ?? p.origin,
                  issueCount: details.issueCount ?? p.issueCount,
                  creators: details.creators ?? p.creators,
                  enemies: details.enemies ?? p.enemies,
                  friends: details.friends ?? p.friends,
                  movies: details.movies ?? p.movies,
                  movieCount: details.movieCount ?? p.movieCount,
                  teams: details.teams ?? p.teams,
                },
                firstIssue: details.firstIssueData ?? prev.firstIssue,
              };
            });
          })
          .catch(() => {})
          .finally(() => {
            if (needsComicVine) setComicVineLoading(false);
          });
      }

      // Lazy AI stat generation for ComicVine characters with no stats yet. The
      // generate-hero-stats edge fn fills powerstats and tags the source as 'ai'.
      if (heroRow.intelligence === null && heroRow.ai_stats_status === 'pending') {
        setStatsGenerating(true);
        supabase.functions
          .invoke<Record<string, number>>('generate-hero-stats', { body: { heroId: heroRow.id } })
          .then(({ data: stats }) => {
            if (stats && typeof stats.intelligence === 'number') {
              setData((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  statsSource: 'ai',
                  stats: {
                    ...prev.stats,
                    powerstats: {
                      intelligence: String(stats.intelligence),
                      strength: String(stats.strength),
                      speed: String(stats.speed),
                      durability: String(stats.durability),
                      power: String(stats.power),
                      combat: String(stats.combat),
                    },
                  },
                };
              });
            }
          })
          .catch(() => {})
          .finally(() => setStatsGenerating(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    heroRow?.id,
    heroRow?.enriched_at,
    heroRowQuery.isPlaceholderData,
    heroRowQuery.isError,
    heroRowQuery.isSuccess,
    retryToken,
  ]);

  const retryLoad = useCallback(() => {
    setLoadError(false);
    setRetryToken((t) => t + 1);
    heroRowQuery.refetch();
  }, [heroRowQuery]);

  useEffect(() => {
    if (!user || !id) return;
    isFavourited(user.id, id)
      .then(setFavourited)
      .catch(() => {});
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    getHeroFavouriteCount(id)
      .then(setFavCount)
      .catch(() => {});
  }, [id]);

  const toggleFavourite = useCallback(async () => {
    if (!user || !id || favLoading) return;
    setFavLoading(true);
    const next = !favourited;
    setFavourited(next);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(
        next ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
      );
    }
    try {
      await (next ? addFavourite(user.id, id) : removeFavourite(user.id, id));
      if (next) trackEvent('favourite_add', { hero_id: id });
      // Explore's "Your Favourites" row caches for 5 min with no focus refetch —
      // invalidate it so the row reflects this change on the next visit.
      void queryClient.invalidateQueries({ queryKey: exploreKeys.favourites(user.id) });
      getHeroFavouriteCount(id)
        .then(setFavCount)
        .catch(() => {});
    } catch {
      setFavourited(!next);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setFavLoading(false);
    }
  }, [user, id, favourited, favLoading]);

  // Priority: Supabase portrait → param portrait (from card) → API image → CDN
  const heroImageUrl = data?.stats.image.url ?? heroRow?.image_url ?? null;
  const heroPortraitUrl =
    data?.stats.image.portraitUrl ?? heroRow?.portrait_url ?? paramImageUri ?? null;

  // Show name immediately from params while API loads
  const displayName = data?.stats.name ?? heroRow?.name ?? paramName ?? '';

  return {
    user,
    isAdmin,
    data,
    setData,
    narrative,
    family,
    comicVineLoading,
    statsGenerating,
    notFound,
    loadError,
    favourited,
    favLoading,
    favCount,
    titles,
    portrayals,
    links,
    galleryImages,
    galleryLoading,
    newIssues,
    heroRow,
    heroRowQuery,
    powerTotal,
    percentile,
    hasFirstVisual,
    relatedHeroMap,
    enemyNames,
    allyNames,
    teammateNames,
    heroImageUrl,
    heroPortraitUrl,
    displayName,
    retryLoad,
    toggleFavourite,
  };
}
