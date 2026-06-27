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

// Flat, ordered list of the dropdown's selectable rows — universes, teams,
// heroes, titles. The palette owns the keyboard cursor and drives Enter-to-open.
export type NavItem =
  | { kind: 'universe'; slug: string }
  | { kind: 'team'; id: string }
  | { kind: 'hero'; id: string }
  | { kind: 'title'; id: string };

const MAX_TEAM_SUGGESTIONS = 3;

const MAX_TITLE_SUGGESTIONS = 3;

const MAX_HERO_SUGGESTIONS = 8;

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

  const shownTeams = teams.slice(0, MAX_TEAM_SUGGESTIONS);
  const shownHeroes = heroes.slice(0, MAX_HERO_SUGGESTIONS);
  const shownTitles = titles.slice(0, MAX_TITLE_SUGGESTIONS);

  // Report the current flat item list up to the palette for keyboard nav. Effect
  // (not a render-time call) so we never setState in the parent during render.
  const navItems: NavItem[] = isEmptyQuery
    ? []
    : [
        ...universes.map((u) => ({ kind: 'universe', slug: u.slug }) as NavItem),
        ...shownTeams.map((t) => ({ kind: 'team', id: t.id }) as NavItem),
        ...shownHeroes.map((h) => ({ kind: 'hero', id: h.id }) as NavItem),
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
        {universes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel as object}>Universes</Text>
            {universes.map((u) => (
              <UniverseChip
                key={u.slug}
                universe={u}
                active={u.slug === activeUniverseSlug}
                onPress={() => handleUniversePress(u.slug)}
              />
            ))}
          </View>
        )}
        {shownTeams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel as object}>Teams</Text>
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
        <SuggestionsList
          query={query}
          suggestions={shownHeroes}
          isLoading={loading}
          resultCount={resultCount}
          activeId={activeHeroId}
          onSuggestionPress={handleHeroPress}
        />
        {shownTitles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel as object}>Films & Shows</Text>
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
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingBottom: 4,
  } as object,
});
