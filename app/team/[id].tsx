// app/team/[id].tsx — native team roster browse page.
// Mirrors the native category/universe screen: a brand-washed navy stage, a
// native search bar + toolbar filter menus, and an infinite, faceted member
// grid. A team is "heroes whose teams[] contains the team name", so it reuses
// the same paginated/faceted query path (useTeamHeroes → getTeamPage).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTeam, useTeamHeroes } from '../../src/lib/query/heroQueries';
import { flattenCategoryPages } from '../../src/lib/query/heroCache';
import { DEFAULT_FILTERS, type CategoryFilters } from '../../src/lib/db/categoryFilters';
import { HeroImage } from '../../src/components/HeroImage';
import { HeroPeek, type PeekHero } from '../../src/components/compare/HeroPeek';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { TeamSkeleton } from '../../src/components/skeletons/TeamSkeleton';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';
import { BrandLogoView } from '../../src/components/PublisherBadge';
import { COLORS } from '../../src/constants/colors';
import { brandForPublisher } from '../../src/constants/publishers';
import { teamLogo } from '../../src/constants/teamBrands';
import type { Hero } from '../../src/lib/db/heroes';
import { SEAM } from '../../src/design';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_COLUMNS = SCREEN_WIDTH >= 768 ? 4 : 3;
const GAP = 8;
const H_PAD = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.35);

const headerOptions = {
  headerShown: true,
  headerTitle: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
} as const;

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Team summary via React Query (cached, deduped) — resolves the header identity
  // and the membership term that drives useTeamHeroes below.
  const teamQuery = useTeam(id);
  const team = teamQuery.data ?? null;
  const [filters, setFilters] = useState<CategoryFilters>(() => ({ ...DEFAULT_FILTERS }));
  const [peek, setPeek] = useState<PeekHero | null>(null);

  const setFilter = useCallback(
    <K extends keyof CategoryFilters>(key: K, value: CategoryFilters[K]) => {
      setFilters((prev) => {
        let next: CategoryFilters = { ...prev, [key]: value };
        if (key === 'sort' && value === 'power') next = { ...next, hasStats: true };
        return next;
      });
    },
    [],
  );

  // Debounce search into the query key so we don't refetch per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const queryFilters: CategoryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const { data, isPending, isFetchingNextPage, fetchNextPage, hasNextPage } = useTeamHeroes(
    team?.name ?? null,
    queryFilters,
  );

  const heroes = flattenCategoryPages(data);
  const total = data?.pages[0]?.total ?? 0;
  // isSuccess, not isFetched: isFetched is true after a FAILURE too, so an
  // outage used to render "This team doesn't exist."
  const notFound = teamQuery.isSuccess && team === null;
  const failed = teamQuery.isError;

  // The roster grid is pending (the stage header is already real). pre → nothing,
  // so a cached roster never blinks a skeleton.
  const gridLoading = isPending && !!team;
  const gridPhase = useSkeletonTransition(gridLoading);

  const brand = brandForPublisher(team?.publisher);
  const tlogo = team ? teamLogo(team) : undefined;
  const LOGO_H = 44;
  const headerHeight = insets.top + 44;
  const eyebrow = team
    ? `${(total || team.member_count).toLocaleString()} ${(total || team.member_count) === 1 ? 'MEMBER' : 'MEMBERS'}${team.publisher ? ` · ${team.publisher.toUpperCase()}` : ''}`
    : '';

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handlePress = useCallback(
    (h: Hero) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/character/${h.id}`);
    },
    [router],
  );

  const listHeader = (
    <>
      <View style={[styles.stage, { paddingTop: headerHeight + 16 }]}>
        {brand && (
          <LinearGradient
            colors={[brand.color, brand.colorDark, COLORS.navy]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.9, y: 0 }}
            end={{ x: 0.1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        {tlogo ? (
          <View style={styles.stageLogo}>
            <BrandLogoView
              logo={tlogo.logo}
              width={LOGO_H * (tlogo.badgeSize.width / tlogo.badgeSize.height)}
              height={LOGO_H}
              tint={tlogo.logoTint}
              shadow
            />
          </View>
        ) : (
          <Text style={styles.stageTitle} numberOfLines={2}>
            {team?.name ?? (notFound ? 'Team not found' : '')}
          </Text>
        )}
      </View>
      <View style={styles.sheetTop} />
      {/* Roster crossfade. The cards are list items, so a zero-height anchor at
          the stage's bottom edge — exactly where the first row starts — carries
          the dissolving overlay. */}
      {gridPhase === 'crossfade' ? (
        <View style={styles.skelAnchor}>
          <View style={styles.skelOverlay}>
            <FadeOutSkeleton>
              <TeamSkeleton />
            </FadeOutSkeleton>
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.root}>
      <Stack.Screen options={headerOptions} />
      <StatusBar style="light" />

      {team && (
        <>
          <Stack.SearchBar
            placeholder={`Search ${team.name}…`}
            onChangeText={(e) => setFilter('search', e.nativeEvent.text)}
            onCancelButtonPress={() => setFilter('search', '')}
            hideWhenScrolling
            autoCapitalize="none"
          />
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Menu icon="line.3.horizontal.decrease">
              <Stack.Toolbar.Menu inline title="Sort">
                <Stack.Toolbar.MenuAction
                  isOn={filters.sort === 'popular'}
                  onPress={() => setFilter('sort', 'popular')}
                >
                  Popular
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  isOn={filters.sort === 'az'}
                  onPress={() => setFilter('sort', 'az')}
                >
                  A–Z
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  isOn={filters.sort === 'power'}
                  onPress={() => setFilter('sort', 'power')}
                >
                  Power
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
              <Stack.Toolbar.Menu inline title="Alignment">
                <Stack.Toolbar.MenuAction
                  isOn={filters.alignment === 'any'}
                  onPress={() => setFilter('alignment', 'any')}
                >
                  Any
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  isOn={filters.alignment === 'good'}
                  onPress={() => setFilter('alignment', 'good')}
                >
                  Good
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  isOn={filters.alignment === 'bad'}
                  onPress={() => setFilter('alignment', 'bad')}
                >
                  Bad
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  isOn={filters.alignment === 'neutral'}
                  onPress={() => setFilter('alignment', 'neutral')}
                >
                  Neutral
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
              <Stack.Toolbar.Menu inline title="Gender">
                <Stack.Toolbar.MenuAction
                  isOn={filters.gender === 'any'}
                  onPress={() => setFilter('gender', 'any')}
                >
                  Any
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  isOn={filters.gender === 'male'}
                  onPress={() => setFilter('gender', 'male')}
                >
                  Male
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  isOn={filters.gender === 'female'}
                  onPress={() => setFilter('gender', 'female')}
                >
                  Female
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
              <Stack.Toolbar.Menu inline title="Power stats">
                <Stack.Toolbar.MenuAction
                  isOn={!filters.hasStats}
                  onPress={() => setFilter('hasStats', false)}
                >
                  Any
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  isOn={filters.hasStats}
                  onPress={() => setFilter('hasStats', true)}
                >
                  Rated only
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
            </Stack.Toolbar.Menu>
          </Stack.Toolbar>
        </>
      )}

      <FlatList
        style={styles.list}
        data={heroes}
        keyExtractor={(h) => String(h.id)}
        numColumns={NUM_COLUMNS}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        columnWrapperStyle={styles.row}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.82}
            onPress={() => handlePress(item)}
            onLongPress={() => setPeek(item)}
            delayLongPress={300}
          >
            <HeroImage
              id={String(item.id)}
              name={item.name}
              imageUrl={item.image_url}
              portraitUrl={item.portrait_url}
              contentFit="cover"
              contentPosition="top"
              style={StyleSheet.absoluteFill}
              recyclingKey={String(item.id)}
              transition={150}
            />
            <LinearGradient
              colors={['transparent', 'rgba(29,45,51,0.88)']}
              locations={[0.4, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.cardName} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          gridLoading ? (
            gridPhase === 'skeleton' ? (
              <TeamSkeleton />
            ) : null
          ) : failed ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn’t load this team"
              body="Check your connection and try again."
              action={{ label: 'Try again', onPress: () => void teamQuery.refetch() }}
              tone="light"
              compact
            />
          ) : notFound ? (
            <EmptyState
              icon="people-outline"
              title="This team doesn’t exist."
              tone="light"
              compact
            />
          ) : (
            <EmptyState
              icon="funnel-outline"
              title="No members found"
              body="Try clearing a filter or searching for a different name."
              tone="light"
              compact
            />
          )
        }
        ListFooterComponent={isFetchingNextPage ? <TeamSkeleton rows={1} /> : null}
      />

      {peek && (
        <HeroPeek
          hero={peek}
          onClose={() => setPeek(null)}
          onFight={() => router.push(`/compare/${peek.id}/pick`)}
          onViewProfile={() => {
            setPeek(null);
            router.push(`/character/${peek.id}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.navy },
  list: { flex: 1, backgroundColor: COLORS.navy },
  listContent: { backgroundColor: COLORS.beige, flexGrow: 1 },
  stage: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: H_PAD,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: COLORS.beige,
    opacity: 0.85,
    marginBottom: 6,
  },
  stageTitle: { fontFamily: 'Flame-Regular', fontSize: 32, color: COLORS.beige, lineHeight: 40 },
  stageLogo: { alignSelf: 'flex-start' },
  sheetTop: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: SEAM.radius,
    borderTopRightRadius: SEAM.radius,
    borderCurve: 'continuous',
    marginTop: -SEAM.overlap,
    height: 30,
  },
  // Zero-height anchor + a viewport-tall overlay box, so the dissolving roster
  // skeleton starts at the seam under the stage and covers the visible grid.
  skelAnchor: { height: 0 },
  skelOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT },
  row: { gap: GAP, marginBottom: GAP, paddingHorizontal: H_PAD },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    justifyContent: 'flex-end',
    padding: 6,
  },
  cardName: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: COLORS.beige, lineHeight: 14 },
});
