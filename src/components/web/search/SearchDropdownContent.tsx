import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../constants/colors';
import { useSearch } from '../../../contexts/SearchContext';
import { useSearchHistory } from '../../../hooks/useSearchHistory';
import { useUnifiedSearch } from '../../../hooks/useUnifiedSearch';
import { useIdleHeroes } from '../../../hooks/useIdleHeroes';
import { IdleSuggestions } from './IdleSuggestions';
import { SuggestionsList } from './SuggestionsList';
import { UniverseChip } from './UniverseChip';
import { TeamResultRow } from './TeamResultRow';
import { TitleResultRow } from './TitleResultRow';
import { TopResultRow } from './TopResultRow';
import { pickTopResult, topResultKey, type TopResult } from '../../../lib/search/topResult';

// Flat, ordered list of the dropdown's selectable rows — top result first, then
// universes, teams, heroes, titles. The palette owns the keyboard cursor and
// drives Enter-to-open (defaulting to the top result).
export type NavItem =
  | { kind: 'universe'; slug: string }
  | { kind: 'team'; id: string }
  | { kind: 'hero'; id: string }
  | { kind: 'title'; id: string };

// Tight per-section caps so the palette shows a "best of every type" taste —
// Top result + a few characters + teams + films above the fold — rather than a
// wall of one type.
const MAX_TEAM_SUGGESTIONS = 2;

const MAX_TITLE_SUGGESTIONS = 2;

const MAX_HERO_SUGGESTIONS = 5;

function topResultNavItem(top: TopResult): NavItem {
  switch (top.kind) {
    case 'universe':
      return { kind: 'universe', slug: top.universe.slug };
    case 'team':
      return { kind: 'team', id: top.team.id };
    case 'hero':
      return { kind: 'hero', id: top.hero.id };
    case 'title':
      return { kind: 'title', id: top.title.id };
  }
}

// Consistent type-labelled section header (Universes / Teams / Characters /
// Films & Shows), with an optional count chip — so no section reads as a bare
// "75 results" while its siblings are type-labelled.
function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <View style={styles.sectionLabelRow as object}>
      <Text style={styles.sectionLabel as object}>{label}</Text>
      {count != null && count > 0 && (
        <Text style={styles.sectionCount as object}>{count >= 100 ? '99+' : count}</Text>
      )}
    </View>
  );
}

export function SearchDropdownContent({
  highlightIndex = -1,
  onItemsChange,
}: {
  highlightIndex?: number;
  onItemsChange?: (items: NavItem[]) => void;
} = {}) {
  const router = useRouter();
  const { query, setQuery, setSearchFocused } = useSearch();
  const { history, addSearch, clearHistory } = useSearchHistory();
  const { universes, teams, heroes, titles, loading, resultCount } = useUnifiedSearch(query);

  const isEmptyQuery = query.trim().length === 0;
  const { heroes: trending, isLoading: trendingLoading } = useIdleHeroes(isEmptyQuery, 4);

  // The featured "Top result" — the single best match across all types. It's
  // de-duped from its own section below so the same item never shows twice.
  const topResult = isEmptyQuery ? null : pickTopResult(query, { universes, teams, heroes, titles });
  const topKey = topResult ? topResultKey(topResult) : null;

  const shownTeams = teams
    .filter((t) => `team:${t.id}` !== topKey)
    .slice(0, MAX_TEAM_SUGGESTIONS);
  const shownUniverses = universes.filter((u) => `universe:${u.slug}` !== topKey);
  const shownHeroes = heroes.filter((h) => `hero:${h.id}` !== topKey).slice(0, MAX_HERO_SUGGESTIONS);
  const shownTitles = titles
    .filter((t) => `title:${t.id}` !== topKey)
    .slice(0, MAX_TITLE_SUGGESTIONS);

  // Report the current flat item list up to the palette for keyboard nav. Effect
  // (not a render-time call) so we never setState in the parent during render.
  // Top result is index 0 → the default Enter target.
  const navItems: NavItem[] = isEmptyQuery
    ? []
    : [
        ...(topResult ? [topResultNavItem(topResult)] : []),
        ...shownHeroes.map((h) => ({ kind: 'hero', id: h.id }) as NavItem),
        ...shownTeams.map((t) => ({ kind: 'team', id: t.id }) as NavItem),
        ...shownUniverses.map((u) => ({ kind: 'universe', slug: u.slug }) as NavItem),
        ...shownTitles.map((t) => ({ kind: 'title', id: t.id }) as NavItem),
      ];
  const itemsKey = JSON.stringify(navItems);
  useEffect(() => {
    onItemsChange?.(navItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const activeItem = highlightIndex >= 0 ? navItems[highlightIndex] : undefined;
  const activeUniverseSlug = activeItem?.kind === 'universe' ? activeItem.slug : undefined;
  const activeTeamId = activeItem?.kind === 'team' ? activeItem.id : undefined;
  const activeHeroId = activeItem?.kind === 'hero' ? activeItem.id : undefined;
  const activeTitleId = activeItem?.kind === 'title' ? activeItem.id : undefined;

  const close = () => setSearchFocused(false);

  const handleHeroPress = (id: string) => {
    addSearch(query);
    close();
    router.push(`/character/${id}`);
  };

  const handleUniversePress = (slug: string) => {
    addSearch(query);
    close();
    router.push(`/universe/${slug}` as Parameters<typeof router.push>[0]);
  };

  const handleTeamPress = (tid: string) => {
    addSearch(query);
    close();
    router.push(`/team/${tid}` as Parameters<typeof router.push>[0]);
  };

  const handleTitlePress = (id: string) => {
    addSearch(query);
    close();
    router.push(`/title/${id}` as Parameters<typeof router.push>[0]);
  };

  const handleTopPress = () => {
    if (!topResult) return;
    switch (topResult.kind) {
      case 'universe':
        return handleUniversePress(topResult.universe.slug);
      case 'team':
        return handleTeamPress(topResult.team.id);
      case 'hero':
        return handleHeroPress(topResult.hero.id);
      case 'title':
        return handleTitlePress(topResult.title.id);
    }
  };

  const handleSelectRecentSearch = (recentQuery: string) => setQuery(recentQuery);

  const handleViewAll = () => {
    const q = query.trim();
    if (!q) return;
    addSearch(q);
    close();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  if (isEmptyQuery) {
    return (
      <IdleSuggestions
        trending={trending}
        trendingLoading={trendingLoading}
        history={history}
        onHeroPress={handleHeroPress}
        onSelectRecent={handleSelectRecentSearch}
        onClearHistory={clearHistory}
      />
    );
  }

  return (
    <View style={styles.wrap as object}>
      <View style={styles.scroll as object}>
        {topResult && (
          <View style={styles.section}>
            <SectionLabel label="Top result" />
            <TopResultRow top={topResult} active={highlightIndex <= 0} onPress={handleTopPress} />
          </View>
        )}
        {(loading || shownHeroes.length > 0) && (
          <View style={styles.section}>
            <SectionLabel label="Characters" count={resultCount} />
            <SuggestionsList
              query={query}
              suggestions={shownHeroes}
              isLoading={loading}
              activeId={activeHeroId}
              onSuggestionPress={handleHeroPress}
            />
          </View>
        )}
        {shownTeams.length > 0 && (
          <View style={styles.section}>
            <SectionLabel label="Teams" />
            {shownTeams.map((t) => (
              <TeamResultRow
                key={t.id}
                team={t}
                active={t.id === activeTeamId}
                onPress={() => handleTeamPress(t.id)}
              />
            ))}
          </View>
        )}
        {shownUniverses.length > 0 && (
          <View style={styles.section}>
            <SectionLabel label="Universes" />
            {shownUniverses.map((u) => (
              <UniverseChip
                key={u.slug}
                universe={u}
                active={u.slug === activeUniverseSlug}
                onPress={() => handleUniversePress(u.slug)}
              />
            ))}
          </View>
        )}
        {!loading &&
          !topResult &&
          shownUniverses.length === 0 &&
          shownTeams.length === 0 &&
          shownHeroes.length === 0 &&
          shownTitles.length === 0 && (
            <View style={styles.empty as object}>
              <Text style={styles.emptyText as object}>No results for &quot;{query.trim()}&quot;</Text>
            </View>
          )}
        {shownTitles.length > 0 && (
          <View style={styles.section}>
            <SectionLabel label="Films & Shows" />
            {shownTitles.map((t) => (
              <TitleResultRow
                key={t.id}
                title={t}
                active={t.id === activeTitleId}
                onPress={() => handleTitlePress(t.id)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Pinned footer: jump to the full results page. Sits below the scroll area
          so it's always reachable regardless of how many sections are showing. */}
      {resultCount > MAX_HERO_SUGGESTIONS && (
        <Pressable
          onPress={handleViewAll}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.viewAll, hovered && (styles.viewAllHover as object)] as object
          }
        >
          <Text style={styles.viewAllText as object}>View all {resultCount} results →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Column of [scrollable sections] + [pinned View-all footer]. The sections
  // (universes, heroes, titles) scroll together inside `scroll`; the footer stays
  // pinned at the bottom so it's always reachable. (The hero list used to own an
  // inner flex:1 scroll which collapsed and overlapped its button once other
  // sections shared the panel — hence one shared scroll area here.)
  wrap: { flexDirection: 'column', flex: 1, minHeight: 0 } as object,
  scroll: { flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' } as object,
  viewAll: {
    flexShrink: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.10)',
  } as object,
  viewAllHover: { backgroundColor: 'rgba(245,235,220,0.05)' } as object,
  viewAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    letterSpacing: 0.3,
  } as object,
  section: {
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 4,
  } as object,
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  } as object,
  sectionCount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: 'rgba(245,235,220,0.35)',
    letterSpacing: 0.2,
  } as object,
  empty: { paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center' } as object,
  emptyText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.55)',
    textAlign: 'center',
  } as object,
});
