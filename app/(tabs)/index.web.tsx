import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getHeroesByCategory, type Hero, type HeroesByCategory } from '../../src/lib/db/heroes';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { COLORS } from '../../src/constants/colors';

const SECTIONS: { key: keyof HeroesByCategory; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'villain', label: 'Villains' },
  { key: 'xmen', label: 'X-Men' },
];

export default function WebDiscoverScreen() {
  const router = useRouter();
  const [data, setData] = useState<HeroesByCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHeroesByCategory()
      .then(setData)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load heroes')
      );
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.beige },
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
