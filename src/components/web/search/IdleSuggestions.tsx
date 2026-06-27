import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { FEATURED_PUBLISHERS } from '../../../constants/publishers';
import type { HeroSearchResult } from '../../../lib/db/heroes';
import type { TeamSearchResult } from '../../../lib/db/teams';
import type { TitleSearchResult } from '../../../lib/db/titles';
import type { UniverseResult } from '../../../lib/db/universes';
import { SuggestionItem } from './SuggestionItem';
import { UniverseChip } from './UniverseChip';
import { TeamResultRow } from './TeamResultRow';
import { TitleResultRow } from './TitleResultRow';

interface IdleSuggestionsProps {
  trending: HeroSearchResult[];
  trendingLoading: boolean;
  teams: TeamSearchResult[];
  films: TitleSearchResult[];
  history: string[];
  onHeroPress: (id: string) => void;
  onUniversePress: (slug: string) => void;
  onTeamPress: (id: string) => void;
  onTitlePress: (id: string) => void;
  onSelectRecent: (query: string) => void;
  onClearHistory: () => void;
}

const browseUniverses: UniverseResult[] = FEATURED_PUBLISHERS.map((b) => ({
  slug: b.slug,
  name: b.name,
  color: b.color,
  logo: b.logo,
  badgeSize: b.badgeSize,
  logoOnLight: b.logoOnLight,
  logoTint: b.logoTint,
  exact: false,
}));

export function IdleSuggestions({
  trending,
  trendingLoading,
  teams,
  films,
  history,
  onHeroPress,
  onUniversePress,
  onTeamPress,
  onTitlePress,
  onSelectRecent,
  onClearHistory,
}: IdleSuggestionsProps) {
  const hasHistory = history.length > 0;

  return (
    <View style={styles.container as object}>
      <View style={styles.scroll as object}>
        {/* Browse universes — a launchpad into the catalogue's big franchises. */}
        <Text style={styles.sectionLabel}>Browse universes</Text>
        <View style={styles.universeWrap as object}>
          {browseUniverses.map((u) => (
            <View key={u.slug} style={styles.universeChipWrap as object}>
              <UniverseChip universe={u} onPress={() => onUniversePress(u.slug)} />
            </View>
          ))}
        </View>

        {/* Trending characters — fame-ranked icons. */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Trending</Text>
        {trendingLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.orange} />
          </View>
        ) : (
          trending.map((hero) => (
            <SuggestionItem key={hero.id} hero={hero} onPress={() => onHeroPress(hero.id)} />
          ))
        )}

        {/* Popular teams */}
        {teams.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Popular teams</Text>
            {teams.map((t) => (
              <TeamResultRow key={t.id} team={t} onPress={() => onTeamPress(t.id)} />
            ))}
          </>
        )}

        {/* Popular films & shows */}
        {films.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Films & Shows</Text>
            {films.map((t) => (
              <TitleResultRow key={t.id} title={t} onPress={() => onTitlePress(t.id)} />
            ))}
          </>
        )}

        {/* Recent searches */}
        {hasHistory && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Recent</Text>
            {history.map((q) => (
              <Pressable
                key={q}
                onPress={() => onSelectRecent(q)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [styles.recentItem, hovered && (styles.recentItemHover as object)] as object
                }
              >
                <Ionicons name="time-outline" size={16} color="rgba(245,235,220,0.45)" />
                <Text style={styles.recentText} numberOfLines={1}>
                  {q}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </View>

      {hasHistory && (
        <Pressable
          onPress={onClearHistory}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.clearButton, hovered && (styles.clearButtonHover as object)] as object
          }
        >
          <Text style={styles.clearButtonText}>Clear search history</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'column', flex: 1 } as object,
  scroll: { flexDirection: 'column', flex: 1, overflowY: 'auto', paddingBottom: 6 } as object,
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionLabelSpaced: { paddingTop: 14 },
  universeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
  } as object,
  universeChipWrap: { backgroundColor: 'rgba(245,235,220,0.04)', borderRadius: 12 } as object,
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginHorizontal: 6,
    gap: 10,
    height: 40,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  recentItemHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  recentText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.beige },
  clearButton: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.08)',
  } as object,
  clearButtonHover: { backgroundColor: 'rgba(245,235,220,0.05)' } as object,
  clearButtonText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(245,235,220,0.55)' },
});
