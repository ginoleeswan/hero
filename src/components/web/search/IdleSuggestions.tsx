import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import type { HeroSearchResult } from '../../../lib/db/heroes';
import { SuggestionItem } from './SuggestionItem';

interface IdleSuggestionsProps {
  trending: HeroSearchResult[];
  trendingLoading: boolean;
  history: string[];
  onHeroPress: (id: string) => void;
  onSelectRecent: (query: string) => void;
  onClearHistory: () => void;
}

export function IdleSuggestions({
  trending,
  trendingLoading,
  history,
  onHeroPress,
  onSelectRecent,
  onClearHistory,
}: IdleSuggestionsProps) {
  const hasHistory = history.length > 0;

  return (
    <View style={styles.container as object}>
      <View style={styles.scroll as object}>
        {/* Trending */}
        <Text style={styles.sectionLabel}>Trending</Text>
        {trendingLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.orange} />
          </View>
        ) : (
          trending.map((hero) => (
            <SuggestionItem key={hero.id} hero={hero} onPress={() => onHeroPress(hero.id)} />
          ))
        )}

        {/* Recent */}
        {hasHistory && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Recent</Text>
            {history.map((q) => (
              <Pressable
                key={q}
                onPress={() => onSelectRecent(q)}
                style={({ hovered }: { hovered?: boolean }) =>
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
          style={({ hovered }: { hovered?: boolean }) =>
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
  container: {
    flexDirection: 'column',
    flex: 1,
  } as object,

  scroll: {
    flexDirection: 'column',
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 6,
  } as object,

  sectionLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.2,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },

  sectionLabelSpaced: {
    paddingTop: 12,
  },

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

  recentItemHover: {
    backgroundColor: 'rgba(245,235,220,0.08)',
  } as object,

  recentText: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.beige,
  },

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

  clearButtonHover: {
    backgroundColor: 'rgba(245,235,220,0.05)',
  } as object,

  clearButtonText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.55)',
  },
});
