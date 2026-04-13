import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  img, figure, table { max-width: 100%; height: auto; margin: 12px 0; border-radius: 8px; }
`;

const SHIMMER_CSS = `
  @keyframes bio-shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position: 600px 0; }
  }
  .bio-sk {
    background: linear-gradient(
      90deg,
      #e4dbd0 0%,
      #d6cdc2 40%,
      #ccc3b8 50%,
      #d6cdc2 60%,
      #e4dbd0 100%
    );
    background-size: 600px 100%;
    animation: bio-shimmer 1.4s ease-in-out infinite;
    border-radius: 6px;
    flex-shrink: 0;
  }
`;

function Sk({ w = '100%', h, r = 6, mb = 0 }: { w?: string | number; h: number; r?: number; mb?: number }) {
  return (
    <div
      className="bio-sk"
      style={{ width: w, height: h, borderRadius: r, marginBottom: mb }}
    />
  );
}

function BiographySkeleton() {
  return (
    <>
      <style>{SHIMMER_CSS}</style>

      {/* Hero name + subtitle */}
      <Sk w="48%" h={44} r={7} mb={10} />
      <Sk w="20%" h={10} r={4} mb={22} />

      <View style={styles.divider} />

      {/* Paragraph 1 */}
      <Sk h={13} mb={10} />
      <Sk w="97%" h={13} mb={10} />
      <Sk w="91%" h={13} mb={10} />
      <Sk w="95%" h={13} mb={10} />
      <Sk w="68%" h={13} mb={32} />

      {/* Section heading */}
      <Sk w="35%" h={20} r={5} mb={16} />

      {/* Paragraph 2 */}
      <Sk h={13} mb={10} />
      <Sk w="98%" h={13} mb={10} />
      <Sk w="85%" h={13} mb={10} />
      <Sk w="92%" h={13} mb={10} />
      <Sk w="74%" h={13} mb={10} />
      <Sk w="55%" h={13} mb={32} />

      {/* Inline image placeholder */}
      <Sk h={220} r={10} mb={32} />

      {/* Section heading */}
      <Sk w="28%" h={20} r={5} mb={16} />

      {/* Paragraph 3 */}
      <Sk h={13} mb={10} />
      <Sk w="96%" h={13} mb={10} />
      <Sk w="89%" h={13} mb={10} />
      <Sk w="62%" h={13} mb={32} />

      {/* Section heading */}
      <Sk w="42%" h={20} r={5} mb={16} />

      {/* Paragraph 4 */}
      <Sk h={13} mb={10} />
      <Sk w="93%" h={13} mb={10} />
      <Sk w="87%" h={13} mb={10} />
      <Sk w="95%" h={13} mb={10} />
      <Sk w="70%" h={13} mb={10} />
      <Sk w="50%" h={13} mb={0} />
    </>
  );
}

export default function WebBiographyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hero, setHero] = useState<HeroRow | null>(null);

  useEffect(() => {
    if (!id) return;
    getHeroById(id)
      .then(setHero)
      .catch(() => {});
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
      <View style={styles.body}>
        {hero ? (
          <>
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
          </>
        ) : (
          <BiographySkeleton />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center' as const,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
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
