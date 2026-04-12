import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getHeroById } from '../../src/lib/db/heroes';
import { COLORS } from '../../src/constants/colors';
import type { Tables } from '../../src/types/database.generated';

type HeroRow = Tables<'heroes'>;

const HTML_STYLES = `
  body { font-family: FlameSans-Regular, sans-serif; font-size: 14px; color: ${COLORS.navy}; line-height: 1.8; }
  h2, h3, h4 { font-family: Flame-Regular, serif; color: ${COLORS.navy}; margin-top: 20px; margin-bottom: 6px; }
  h2 { font-size: 22px; }
  h3 { font-size: 18px; }
  h4 { font-size: 15px; }
  p { margin-bottom: 10px; }
  a { color: ${COLORS.orange}; text-decoration: none; }
  ul, ol { padding-left: 20px; margin-bottom: 10px; }
  li { margin-bottom: 4px; }
  img, figure, table { display: none; }
`;

export default function WebBiographyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hero, setHero] = useState<HeroRow | null>(null);

  useEffect(() => {
    if (!id) return;
    getHeroById(id).then(setHero).catch(() => {});
  }, [id]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={16} color={COLORS.navy} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      {hero ? (
        <View style={styles.body}>
          <Text style={styles.heroName}>{hero.name}</Text>
          <Text style={styles.subtitle}>Biography</Text>
          <View style={styles.divider} />
          {hero.description ? (
            <>
              <style>{HTML_STYLES}</style>
              <div dangerouslySetInnerHTML={{ __html: hero.description }} />
            </>
          ) : (
            <Text style={styles.empty}>No biography available.</Text>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { maxWidth: 720, width: '100%', alignSelf: 'center' as const, paddingHorizontal: 24, paddingVertical: 32 },
  header: { marginBottom: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: 'FlameSans-Regular', fontSize: 13, color: COLORS.navy },
  body: {},
  heroName: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.navy,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: COLORS.navy,
    opacity: 0.4,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  divider: { height: 2, backgroundColor: COLORS.navy, opacity: 0.08, marginBottom: 24 },
  empty: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.navy, opacity: 0.4 },
});
