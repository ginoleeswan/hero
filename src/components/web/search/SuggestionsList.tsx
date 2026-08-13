import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '../../ui/Text';
import { COLORS } from '../../../constants/colors';
import type { HeroSearchResult } from '../../../lib/db/heroes';
import { SuggestionItem } from './SuggestionItem';

interface SuggestionsListProps {
  query: string;
  suggestions: HeroSearchResult[];
  isLoading: boolean;
  onSuggestionPress: (id: string) => void;
  /** Hero id highlighted by the palette's keyboard cursor. */
  activeId?: string;
}

// Headerless list of character rows. The "Characters" section label (and count)
// is owned by the parent SearchDropdownContent so every section reads the same.
export function SuggestionsList({
  query,
  suggestions,
  isLoading,
  onSuggestionPress,
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
        <Text style={styles.emptyText}>No characters found for “{query}”</Text>
      </View>
    );
  }

  return (
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
  );
}

const styles = StyleSheet.create({
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

  suggestionsList: {
    flexDirection: 'column',
    paddingBottom: 6,
  } as object,
});
