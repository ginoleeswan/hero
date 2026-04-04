import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../src/constants/colors';

const ALL_HEROES_URL = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json';

interface CdnHero {
  id: number;
  name: string;
  biography: { publisher: string };
  images: { md: string };
}

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [allHeroes, setAllHeroes] = useState<CdnHero[]>([]);
  const [query, setQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [navigatingId, setNavigatingId] = useState<number | null>(null);

  useEffect(() => {
    fetch(ALL_HEROES_URL)
      .then((r) => r.json())
      .then((data: CdnHero[]) => setAllHeroes(data))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  const results =
    query.trim().length === 0
      ? allHeroes
      : allHeroes.filter((h) => h.name.toLowerCase().includes(query.toLowerCase()));

  const handlePress = useCallback(
    (id: number) => {
      if (navigatingId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setNavigatingId(id);
      inputRef.current?.blur();
      router.push(`/character/${id}`);
      // Reset after navigation so the list is tappable again on back
      setTimeout(() => setNavigatingId(null), 1000);
    },
    [router, navigatingId],
  );

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>search</Text>
        </View>

        {/* Search bar */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.beige} style={styles.searchIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search heroes…"
            placeholderTextColor="rgba(245,235,220,0.5)"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={clearQuery}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="rgba(245,235,220,0.6)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {loadingList ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.orange} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(h) => String(h.id)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const isNavigating = navigatingId === item.id;
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => handlePress(item.id)}
                  activeOpacity={0.7}
                  disabled={!!navigatingId}
                >
                  <Image
                    source={{ uri: item.images.md }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                  <View style={styles.rowText}>
                    <Text style={styles.heroName}>{item.name}</Text>
                    {item.biography.publisher ? (
                      <Text style={styles.publisher}>{item.biography.publisher}</Text>
                    ) : null}
                  </View>
                  {isNavigating ? (
                    <ActivityIndicator size="small" color={COLORS.orange} />
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={COLORS.grey} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No heroes found</Text>
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 50,
    color: COLORS.navy,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    marginHorizontal: 15,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.beige,
  },
  list: {
    paddingHorizontal: 15,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.navy,
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.navy,
  },
  publisher: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d4c8b8',
    marginLeft: AVATAR_SIZE + 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    color: COLORS.grey,
  },
});
