import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../../../constants/colors';
import { useSearch } from '../../../contexts/SearchContext';
import { useAuth } from '../../../hooks/useAuth';
import { useSearchHistory } from '../../../hooks/useSearchHistory';
import { useUnifiedSearch } from '../../../hooks/useUnifiedSearch';
import { useIdleHeroes } from '../../../hooks/useIdleHeroes';
import { getRecentlyViewed } from '../../../lib/db/viewHistory';
import type { RailHero } from './HeroRail';
import { IdleSuggestions } from './IdleSuggestions';
import { SuggestionsList } from './SuggestionsList';
import { UniverseChip } from './UniverseChip';
import { TeamResultRow } from './TeamResultRow';
import { TitleResultRow } from './TitleResultRow';
import { TopResultRow } from './TopResultRow';
import { ScopeBar, type SearchScope } from './ScopeBar';
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

const MAX_HERO_SUGGESTIONS = 4;

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
  scope = 'all',
  onScopeChange,
}: {
  highlightIndex?: number;
  onItemsChange?: (items: NavItem[]) => void;
  scope?: SearchScope;
  onScopeChange?: (s: SearchScope) => void;
} = {}) {
  const router = useRouter();
  const { query, setQuery, setSearchFocused } = useSearch();
  const { user } = useAuth();
  const { history, addSearch, clearHistory } = useSearchHistory();
  const { universes, teams, heroes, titles, loading, resultCount } = useUnifiedSearch(query);

  const isEmptyQuery = query.trim().length === 0;
  // 14 fame-ranked icons for the Popular portrait rail (was 4 for a vertical list).
  const { heroes: trending, isLoading: trendingLoading } = useIdleHeroes(isEmptyQuery, 14);

  // The signed-in user's recently-viewed characters ("jump back in"), shown as a
  // portrait rail at the top of the idle palette. Only fetched while idle.
  const [recentlyViewed, setRecentlyViewed] = useState<RailHero[]>([]);
  useEffect(() => {
    if (!isEmptyQuery || !user?.id) {
      // Only the idle palette shows history; clear otherwise. Effect-based fetch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecentlyViewed([]);
      return;
    }
    let cancelled = false;
    getRecentlyViewed(user.id, 16)
      .then((rows) => {
        if (!cancelled) setRecentlyViewed(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEmptyQuery, user?.id]);

  // Which sections show, and how many — narrowed by the active scope. A scoped
  // view shows just that type (no top result), with a bigger cap.
  const showTop = scope === 'all';
  const showChars = scope === 'all' || scope === 'characters';
  const showTeamsScope = scope === 'all' || scope === 'teams';
  const showFilmsScope = scope === 'all' || scope === 'films';
  const showUniversesScope = scope === 'all' || scope === 'universes';
  const heroCap = scope === 'characters' ? 16 : MAX_HERO_SUGGESTIONS;
  const teamCap = scope === 'teams' ? 12 : MAX_TEAM_SUGGESTIONS;
  const titleCap = scope === 'films' ? 12 : MAX_TITLE_SUGGESTIONS;

  // The featured "Top result" — the single best match across all types ('all'
  // scope only). De-duped from its own section so the same item never shows twice.
  const topResult =
    isEmptyQuery || !showTop ? null : pickTopResult(query, { universes, teams, heroes, titles });
  const topKey = topResult ? topResultKey(topResult) : null;

  const shownTeams = teams.filter((t) => `team:${t.id}` !== topKey).slice(0, teamCap);
  const shownUniverses = universes.filter((u) => `universe:${u.slug}` !== topKey);
  const shownHeroes = heroes.filter((h) => `hero:${h.id}` !== topKey).slice(0, heroCap);
  const shownTitles = titles.filter((t) => `title:${t.id}` !== topKey).slice(0, titleCap);

  const charsVisible = showChars && (loading || shownHeroes.length > 0);
  const teamsVisible = showTeamsScope && shownTeams.length > 0;
  const universesVisible = showUniversesScope && shownUniverses.length > 0;
  const filmsVisible = showFilmsScope && shownTitles.length > 0;

  // Report the current flat item list up to the palette for keyboard nav, in
  // render order. Top result is index 0 → the default Enter target.
  const navItems: NavItem[] = isEmptyQuery
    ? []
    : [
        ...(topResult ? [topResultNavItem(topResult)] : []),
        ...(charsVisible ? shownHeroes.map((h) => ({ kind: 'hero', id: h.id }) as NavItem) : []),
        ...(teamsVisible ? shownTeams.map((t) => ({ kind: 'team', id: t.id }) as NavItem) : []),
        ...(universesVisible
          ? shownUniverses.map((u) => ({ kind: 'universe', slug: u.slug }) as NavItem)
          : []),
        ...(filmsVisible ? shownTitles.map((t) => ({ kind: 'title', id: t.id }) as NavItem) : []),
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
        recentlyViewed={recentlyViewed}
        trending={trending}
        trendingLoading={trendingLoading}
        history={history}
        onHeroPress={handleHeroPress}
        onUniversePress={handleUniversePress}
        onSelectRecent={handleSelectRecentSearch}
        onClearHistory={clearHistory}
      />
    );
  }

  return (
    <View style={styles.wrap as object}>
      <ScopeBar scope={scope} onScope={onScopeChange ?? (() => {})} />
      <View style={styles.scroll as object}>
        {topResult && (
          <View style={styles.section}>
            <SectionLabel label="Top result" />
            <TopResultRow top={topResult} active={highlightIndex <= 0} onPress={handleTopPress} />
          </View>
        )}
        {charsVisible && (
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
        {teamsVisible && (
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
        {universesVisible && (
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
        {filmsVisible && (
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
        {!loading &&
          !topResult &&
          !charsVisible &&
          !teamsVisible &&
          !universesVisible &&
          !filmsVisible && (
            <View style={styles.empty as object}>
              <Text style={styles.emptyText as object}>
                {scope === 'all'
                  ? `No results for "${query.trim()}"`
                  : `No ${scope} for "${query.trim()}"`}
              </Text>
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
  scroll: {
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    scrollbarWidth: 'none', // no desktop scrollbar chrome on mobile web
  } as object,
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
