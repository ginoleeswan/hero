import { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { useSearch } from '../../contexts/SearchContext';
import { heroGridImageSource } from '../../constants/heroImages';
import type { HeroSearchResult } from '../../lib/db/heroes';

const DESKTOP_BP = 768;
const EXPLORE_PATH = '/explore';
const MAX_SUGGESTIONS = 8;

// Publisher logos
const MARVEL_LOGO = require('../../../assets/images/Marvel-Logo.jpg') as number;
const DC_LOGO = require('../../../assets/images/DC-Logo.png') as number;

export function SearchSuggestions() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { query } = useSearch();
  const dropdownRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isDesktop = width >= DESKTOP_BP;
  const isOnExplorePage = pathname === EXPLORE_PATH;
  const shouldShow = isDesktop && isOnExplorePage && query.trim().length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: MouseEvent) => {
      const node = dropdownRef.current as unknown as Element | null;
      if (node && !node.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Open dropdown when suggestions should show
  useEffect(() => {
    setIsOpen(shouldShow);
  }, [shouldShow]);

  if (!shouldShow) return null;

  // Import searchResults from explore context
  // This is a bit tricky - we need access to the search results that explore.web.tsx is managing
  // We'll use SearchContext which should have the results accessible
  // For now, we'll need to pass results through context or use a callback

  // Render the dropdown container
  return (
    <View
      ref={dropdownRef}
      style={styles.dropdownContainer as object}
      pointerEvents="box-none"
    >
      {isOpen && (
        <View style={styles.dropdown as object}>
          <SearchSuggestionsContent />
        </View>
      )}
    </View>
  );
}

// Separated content component to manage search state independently
function SearchSuggestionsContent() {
  const router = useRouter();
  const { query } = useSearch();
  const [suggestions, setSuggestions] = useState<HeroSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resultCount, setResultCount] = useState(0);

  // This effect mirrors the one in explore.web.tsx to fetch suggestions
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        // Dynamic import to avoid circular dependency
        const { searchHeroes, rankResults } = await import('../../lib/db/heroes');
        const results = await searchHeroes(query, 'All', 100);
        const ranked = rankResults(results, query);

        setResultCount(ranked.length);
        setSuggestions(ranked.slice(0, MAX_SUGGESTIONS));
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleResultClick = (id: string) => {
    router.push(`/character/${id}`);
  };

  const handleViewAll = () => {
    // Scroll to results grid (will be added to explore.web.tsx)
    const resultsSection = document.getElementById('search-results-grid');
    if (resultsSection) {
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      {resultCount > 0 && !isLoading && (
        <View style={styles.resultHeader}>
          <Text style={styles.resultCountBadge}>
            {resultCount === 1 ? '1 result' : `${resultCount} results`}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.orange} />
        </View>
      ) : suggestions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No heroes found for "{query}"</Text>
        </View>
      ) : (
        <>
          <View style={styles.suggestionsList}>
            {suggestions.map((hero) => (
              <SuggestionItem
                key={hero.id}
                hero={hero}
                onPress={() => handleResultClick(hero.id)}
              />
            ))}
          </View>

          {resultCount > MAX_SUGGESTIONS && (
            <Pressable
              onPress={handleViewAll}
              style={({ hovered }: { hovered?: boolean }) =>
                [styles.viewAllButton, hovered && (styles.viewAllButtonHover as object)] as object
              }
            >
              <Text style={styles.viewAllText}>
                View All {resultCount} Results →
              </Text>
            </Pressable>
          )}
        </>
      )}
    </>
  );
}

function PublisherBadge({ publisher }: { publisher?: string | null }) {
  if (!publisher) return null;

  const pub = publisher.toLowerCase();
  const isMarvel = pub.includes('marvel');
  const isDC = pub.includes('dc');

  if (isMarvel) {
    return (
      <Image
        source={MARVEL_LOGO}
        style={styles.publisherLogo as object}
        contentFit="contain"
      />
    );
  }

  if (isDC) {
    return (
      <Image
        source={DC_LOGO}
        style={[styles.publisherLogo, styles.publisherLogoDC] as object}
        contentFit="contain"
      />
    );
  }

  return (
    <Text style={styles.publisherText} numberOfLines={1}>
      {publisher}
    </Text>
  );
}

function SuggestionItem({
  hero,
  onPress,
}: {
  hero: HeroSearchResult;
  onPress: () => void;
}) {
  const source = heroGridImageSource(hero.id, hero.image_url, hero.portrait_url, hero.image_md_url);

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [styles.suggestionItem, hovered && (styles.suggestionItemHover as object)] as object
      }
    >
      <Image
        source={source}
        style={styles.suggestionImage}
        contentFit="cover"
        contentPosition="top"
      />
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionName} numberOfLines={1}>
          {hero.name}
        </Text>
        <View style={styles.publisherRow}>
          <PublisherBadge publisher={hero.publisher} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 150,
  } as object,

  dropdown: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.12)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    marginTop: 8,
    maxHeight: 420,
    overflow: 'hidden',
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
  } as object,

  resultCountBadge: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    backgroundColor: 'rgba(231,115,51,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },

  suggestionsList: {
    flexDirection: 'column',
    overflowY: 'auto',
  } as object,

  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
    height: 72,
    cursor: 'pointer',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.05)',
    transition: 'background-color 150ms ease, transform 150ms ease',
  } as object,

  suggestionItemHover: {
    backgroundColor: 'rgba(245,235,220,0.08)',
  } as object,

  suggestionImage: {
    width: 56,
    height: 74,
    borderRadius: 8,
    backgroundColor: 'rgba(245,235,220,0.08)',
    flexShrink: 0,
  } as object,

  suggestionContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
  } as object,

  suggestionName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 16,
  },

  publisherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  } as object,

  publisherLogo: {
    width: 24,
    height: 10,
    borderRadius: 2,
  } as object,

  publisherLogoDC: {
    width: 22,
    height: 22,
  } as object,

  publisherText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(245,235,220,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.15)',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  viewAllButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.08)',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
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
