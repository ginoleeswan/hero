import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RenderHTML from 'react-native-render-html';
import { getHeroById } from '../../src/lib/db/heroes';
import { COLORS } from '../../src/constants/colors';
import type { Tables } from '../../src/types/database.generated';

type HeroRow = Tables<'heroes'>;

const TAG_STYLES = {
  p: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy,
    lineHeight: 22,
    marginBottom: 8,
  },
  h2: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    marginTop: 20,
    marginBottom: 6,
  },
  h3: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    color: COLORS.navy,
    marginTop: 16,
    marginBottom: 4,
  },
  h4: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    color: COLORS.navy,
    marginTop: 12,
    marginBottom: 4,
  },
  li: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.navy, lineHeight: 22 },
  a: { color: COLORS.orange },
  b: { fontFamily: 'Flame-Regular' },
  strong: { fontFamily: 'Flame-Regular' },
};
const SYSTEM_FONTS = ['FlameSans-Regular', 'Flame-Regular'];
const IGNORED_TAGS = ['figure', 'figcaption', 'table', 'thead'];

export default function BiographyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hero, setHero] = useState<HeroRow | null>(null);

  useEffect(() => {
    if (!id) return;
    getHeroById(id)
      .then(setHero)
      .catch(() => {});
  }, [id]);

  const contentWidth = width - 40;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerBackTitle: '',
          headerStyle: { backgroundColor: 'transparent' },
          headerTitle: '',
          headerTintColor: COLORS.navy,
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingTop: insets.top + 56,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {hero ? (
          <>
            <Text style={styles.heroName}>{hero.name}</Text>
            <Text style={styles.subtitle}>Biography</Text>
            <View style={styles.divider} />
            {hero.description ? (
              <RenderHTML
                contentWidth={contentWidth}
                source={{ html: hero.description }}
                tagsStyles={TAG_STYLES}
                systemFonts={SYSTEM_FONTS}
                ignoredDomTags={IGNORED_TAGS}
              />
            ) : (
              <Text style={styles.empty}>No biography available.</Text>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { flex: 1 },
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.navy,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    opacity: 0.4,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  divider: {
    height: 2,
    backgroundColor: COLORS.navy,
    opacity: 0.08,
    marginBottom: 16,
  },
  empty: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.navy,
    opacity: 0.4,
  },
});
