import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { getHeroesByCategory, type Hero, type HeroesByCategory } from '../../src/lib/db/heroes';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { COLORS } from '../../src/constants/colors';

const SECTIONS: { key: keyof HeroesByCategory; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'villain', label: 'Villains' },
  { key: 'xmen', label: 'X-Men' },
];

// ── Skeleton ─────────────────────────────────────────────────────────────────
function DiscoverSkeleton() {
  const opacity = useSkeletonAnim();
  const { width } = useWindowDimensions();
  // Estimate how many cards fit per row at ~220px min
  const cols = Math.max(2, Math.floor(Math.min(width, 1200) / 236));
  const cardCount = cols + 1; // one extra row to fill viewport

  return (
    <ScrollView style={sk.scroll} contentContainerStyle={sk.content}>
      {SECTIONS.map(({ key, label }) => (
        <View key={key} style={sk.section}>
          {/* Section heading */}
          <SkeletonBlock opacity={opacity} width={120} height={22} style={{ marginBottom: 10 }} />
          <View style={sk.divider} />
          {/* Card grid */}
          <View style={sk.grid as object}>
            {Array.from({ length: cardCount }).map((_, i) => (
              <SkeletonBlock
                key={i}
                opacity={opacity}
                height={key === 'popular' && i === 0 ? 380 : 180}
                borderRadius={12}
                style={
                  key === 'popular' && i === 0
                    ? ({ gridColumn: 'span 2', gridRow: 'span 2' } as object)
                    : undefined
                }
              />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const sk = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { padding: 24, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  section: { marginBottom: 40 },
  divider: {
    height: 2,
    backgroundColor: COLORS.navy,
    borderRadius: 2,
    marginBottom: 16,
    opacity: 0.15,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export default function WebDiscoverScreen() {
  const router = useRouter();
  const [data, setData] = useState<HeroesByCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHeroesByCategory()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load heroes'));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return <DiscoverSkeleton />;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {SECTIONS.map(({ key, label }) => {
        const heroes = data[key];
        if (heroes.length === 0) return null;
        return (
          <View key={key} style={styles.section}>
            <Text style={styles.sectionTitle}>{label}</Text>
            <View style={styles.divider} />
            <View style={styles.grid as object}>
              {heroes.map((hero: Hero, index: number) => (
                <WebHeroCard
                  key={hero.id}
                  id={hero.id}
                  name={hero.name}
                  imageUrl={hero.image_url}
                  featured={key === 'popular' && index === 0}
                  publisher={hero.name}
                  onPress={() => router.push(`/character/${hero.id}`)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { padding: 24, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.beige,
  },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.red },
  section: { marginBottom: 40 },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: 8,
  },
  divider: {
    height: 2,
    backgroundColor: COLORS.navy,
    borderRadius: 2,
    marginBottom: 16,
    opacity: 0.15,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
});
