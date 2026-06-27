import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../../constants/colors';
import type { HeroSearchResult } from '../../../lib/db/heroes';
import { SuggestionItem } from './SuggestionItem';

const MAX_SUGGESTIONS = 8;

interface SuggestionsListProps {
  query: string;
  suggestions: HeroSearchResult[];
  isLoading: boolean;
  resultCount: number;
  onSuggestionPress: (id: string) => void;
  onViewAll: () => void;
  /** Hero id highlighted by the palette's keyboard cursor. */
  activeId?: string;
}

export function SuggestionsList({
  query,
  suggestions,
  isLoading,
  resultCount,
  onSuggestionPress,
  onViewAll,
  activeId,
}: SuggestionsListProps) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={COLORS.orange} />
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No heroes found for "{query}"</Text>
      </View>
    );
  }

  const hasViewAllButton = resultCount > MAX_SUGGESTIONS;

  return (
    <View style={styles.container as object}>
      {resultCount > 0 && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultCountLabel}>
            {resultCount === 1 ? '1 result' : `${resultCount} results`}
          </Text>
        </View>
      )}

      <View style={styles.suggestionsList as object}>
        {suggestions.map((hero) => (
          <SuggestionItem
            key={hero.id}
            hero={hero}
            query={query}
            active={hero.id === activeId}
            onPress={() => onSuggestionPress(hero.id)}
          />
        ))}
      </View>

      {hasViewAllButton && (
        <Pressable
          onPress={onViewAll}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.viewAllButton, hovered && (styles.viewAllButtonHover as object)] as object
          }
        >
          <Text style={styles.viewAllText}>View all {resultCount} results →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  } as object,

  loadingContainer: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  } as object,

  emptyContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  } as object,

  emptyText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.55)',
    textAlign: 'center',
  },

  resultHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    flexShrink: 0,
  } as object,

  resultCountLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.45)',
    letterSpacing: 0.2,
  },

  suggestionsList: {
    flexDirection: 'column',
    paddingBottom: 6,
  } as object,

  viewAllButton: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    flexShrink: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.08)',
  } as object,

  viewAllButtonHover: {
    backgroundColor: 'rgba(245,235,220,0.05)',
  } as object,

  viewAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    letterSpacing: 0.3,
  },
});
