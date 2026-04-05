import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { getHeroesByCategory, type Hero, type HeroesByCategory } from '../../src/lib/db/heroes';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { COLORS } from '../../src/constants/colors';

interface Section {
  key: keyof HeroesByCategory;
  label: string;
  category: string;
  featured: boolean;
}

const SECTIONS: Section[] = [
  { key: 'popular', label: 'Popular', category: 'Heroes', featured: true },
  { key: 'villain', label: 'Villains', category: 'Rogues Gallery', featured: false },
  { key: 'xmen', label: 'X-Men', category: 'Mutants', featured: false },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DiscoverSkeleton() {
  const opacity = useSkeletonAnim();
  const { width } = useWindowDimensions();
  const cols = Math.max(2, Math.floor(Math.min(width - 64, 1200) / 236));

  return (
    <ScrollView style={sk.scroll} contentContainerStyle={sk.content}>
      {SECTIONS.map(({ key, label }) => (
        <View key={key} style={sk.section}>
          <View style={sk.sectionHeader}>
            <View style={{ gap: 6 } as object}>
              <SkeletonBlock opacity={opacity} width={28} height={10} borderRadius={3} />
              <SkeletonBlock opacity={opacity} width={140} height={32} borderRadius={6} />
              <SkeletonBlock opacity={opacity} width={80} height={10} borderRadius={3} />
            </View>
            <SkeletonBlock opacity={opacity} width={60} height={12} borderRadius={3} />
          </View>
          <View style={sk.rule} />
          <View style={skGrid as object}>
            {Array.from({ length: cols }).map((_, i) => (
              <SkeletonBlock
                key={i}
                opacity={opacity}
                height={key === 'popular' && i === 0 ? 376 : 180}
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

const skGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gridAutoRows: '180px',
  gap: 14,
};

const sk = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 80, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  section: { marginBottom: 72 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  rule: { height: 1, backgroundColor: COLORS.navy, opacity: 0.12, marginBottom: 20 },
});

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({
  index,
  label,
  category,
  onViewAll,
}: {
  index: number;
  label: string;
  category: string;
  onViewAll: () => void;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleGroup}>
          <Text style={styles.sectionNumber}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={styles.sectionTitle}>{label}</Text>
          <Text style={styles.sectionCategory}>{category}</Text>
        </View>
        <Pressable
          onPress={onViewAll}
          style={({ hovered }: { hovered?: boolean }) =>
            [styles.viewAllBtn, hovered && (styles.viewAllBtnHover as object)] as object
          }
        >
          <Text style={styles.viewAllText}>View all →</Text>
        </Pressable>
      </View>
      <View style={styles.sectionRule} />
    </>
  );
}

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

  if (!data) return <DiscoverSkeleton />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {SECTIONS.map(({ key, label, category, featured }, sectionIndex) => {
        const heroes = data[key];
        if (heroes.length === 0) return null;

        const gridStyle = featured ? bentoGrid : uniformGrid;

        return (
          <View key={key} style={styles.section}>
            <SectionHeader
              index={sectionIndex}
              label={label}
              category={category}
              onViewAll={() => router.push('/search')}
            />
            <View style={gridStyle as object}>
              {heroes.map((hero: Hero, index: number) => (
                <WebHeroCard
                  key={hero.id}
                  id={hero.id}
                  name={hero.name}
                  imageUrl={hero.image_url}
                  featured={featured && index === 0}
                  publisher={featured && index === 0 ? hero.name : undefined}
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

// CSS grid properties must live outside StyleSheet.create
const bentoGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gridAutoRows: '180px',
  gap: 14,
};
const uniformGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gridAutoRows: '210px',
  gap: 14,
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 80,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.beige },
  errorText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.red },

  // ── Section ────────────────────────────────────────────────────────────────
  section: { marginBottom: 72 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  sectionTitleGroup: { gap: 3 },
  sectionNumber: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.orange,
    letterSpacing: 2,
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 38,
    color: COLORS.navy,
    lineHeight: 40,
  },
  sectionCategory: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  viewAllBtn: {
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  viewAllBtnHover: {
    borderBottomColor: COLORS.navy,
  } as object,
  viewAllText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    opacity: 0.45,
    letterSpacing: 0.5,
  },

  sectionRule: {
    height: 1,
    backgroundColor: COLORS.navy,
    opacity: 0.12,
    marginBottom: 20,
  },

});
