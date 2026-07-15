import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { SEARCH_UNIVERSES } from '../../../constants/publishers';
import type { HeroSearchResult } from '../../../lib/db/heroes';
import { HeroRail, type RailHero } from './HeroRail';
import { UniverseChip } from './UniverseChip';

interface IdleSuggestionsProps {
  recentlyViewed: RailHero[];
  trending: HeroSearchResult[];
  trendingLoading: boolean;
  history: string[];
  onHeroPress: (id: string) => void;
  onUniversePress: (slug: string) => void;
  onSelectRecent: (query: string) => void;
  onClearHistory: () => void;
}

// Aligns rail cards / chips with the inset section labels; rails don't break out
// of the panel (it's already the full overlay width), so bleed=0.
const RAIL_INSET = 14;

export function IdleSuggestions({
  recentlyViewed,
  trending,
  trendingLoading,
  history,
  onHeroPress,
  onUniversePress,
  onSelectRecent,
  onClearHistory,
}: IdleSuggestionsProps) {
  const hasHistory = history.length > 0;

  return (
    <View style={styles.container as object}>
      <View style={styles.scroll as object}>
        {/* Returning context first — characters you opened. */}
        {recentlyViewed.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recently viewed</Text>
            <HeroRail
              heroes={recentlyViewed}
              edge={RAIL_INSET}
              bleed={0}
              onPress={(h) => onHeroPress(h.id)}
            />
          </>
        )}

        {/* Popular — fame-ranked icons as a portrait rail (the discovery hook). */}
        <Text style={[styles.sectionLabel, recentlyViewed.length > 0 && styles.sectionLabelSpaced]}>
          Popular
        </Text>
        {trendingLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.orange} />
          </View>
        ) : (
          <HeroRail
            heroes={trending}
            edge={RAIL_INSET}
            bleed={0}
            onPress={(h) => onHeroPress(h.id)}
          />
        )}

        {/* Universes — the full set, a horizontal rail (not a 4-chip wrap). */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Universes</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.universeRail as object}
          contentContainerStyle={styles.universeTrack as object}
        >
          {SEARCH_UNIVERSES.map((b) => (
            <UniverseChip
              key={b.slug}
              universe={{
                slug: b.slug,
                name: b.name,
                color: b.color,
                logo: b.logo,
                badgeSize: b.badgeSize,
                logoOnLight: b.logoOnLight,
                logoTint: b.logoTint,
                exact: false,
              }}
              onPress={() => onUniversePress(b.slug)}
            />
          ))}
        </ScrollView>

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
  scroll: {
    flexDirection: 'column',
    flex: 1,
    overflowY: 'auto',
    scrollbarWidth: 'none', // no desktop scrollbar chrome on mobile web
    paddingBottom: 6,
  } as object,
  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    paddingHorizontal: RAIL_INSET,
    paddingTop: 10,
    paddingBottom: 8,
  },
  sectionLabelSpaced: { paddingTop: 16 },
  // Fixed height + flexShrink:0 — the fixed-height flex-column panel would
  // otherwise shrink this horizontal scroller to 0 (~56 chip + breathing room).
  universeRail: { height: 60, flexShrink: 0 } as object,
  universeTrack: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: RAIL_INSET,
    paddingRight: RAIL_INSET,
    paddingBottom: 4,
    alignItems: 'center',
  } as object,
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
