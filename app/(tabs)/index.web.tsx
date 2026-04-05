import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { getHeroesByCategory, type Hero, type HeroesByCategory } from '../../src/lib/db/heroes';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { heroImageSource } from '../../src/constants/heroImages';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { COLORS } from '../../src/constants/colors';

// ── Grid definitions (CSS props must live outside StyleSheet.create) ──────────
const popularRightGrid = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gridTemplateRows: 'repeat(2, 1fr)',
  gap: 14,
};
const villainsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gridAutoRows: '190px',
  gap: 14,
};
const xmenGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gridAutoRows: '260px',
  gap: 14,
};

// ── Featured hero panel (Popular section left column) ─────────────────────────
function FeaturedHeroPanel({ hero, onPress }: { hero: Hero; onPress: () => void }) {
  const source = heroImageSource(String(hero.id), hero.portrait_url ?? hero.image_url);

  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) =>
        [feat.panel, hovered && (feat.panelHover as object)] as object
      }
    >
      <Image
        source={source}
        contentFit="cover"
        contentPosition="top"
        style={{ width: '100%', height: '100%' } as object}
      />
      <View style={feat.overlay as object} />

      <View style={feat.content}>
        {hero.publisher ? (
          <Text style={feat.publisher}>{hero.publisher}</Text>
        ) : null}
        <Text style={feat.name} numberOfLines={2}>
          {hero.name}
        </Text>
        <View style={feat.cta}>
          <Text style={feat.ctaText}>View profile</Text>
          <Text style={feat.ctaArrow}> →</Text>
        </View>
      </View>
    </Pressable>
  );
}

const feat = StyleSheet.create({
  panel: {
    width: 380,
    flexShrink: 0,
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
  } as object,
  panelHover: {
    transform: [{ scale: 1.018 }],
    boxShadow: '0 20px 56px rgba(0,0,0,0.28)',
    zIndex: 1,
  } as object,
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.97) 0%, rgba(29,45,51,0.4) 45%, transparent 100%)',
  } as object,
  content: {
    position: 'absolute',
    bottom: 28,
    left: 28,
    right: 28,
  },
  publisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 10,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    color: COLORS.beige,
    lineHeight: 36,
    marginBottom: 18,
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
  } as object,
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(245,235,220,0.18)',
    paddingTop: 14,
  },
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  ctaArrow: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.5)',
  },
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

// ── Skeleton ──────────────────────────────────────────────────────────────────
function DiscoverSkeleton() {
  const opacity = useSkeletonAnim();
  const { width } = useWindowDimensions();
  const cols = Math.max(2, Math.floor(Math.min(width - 64, 1200) / 200));

  return (
    <ScrollView style={sk.scroll} contentContainerStyle={sk.content}>
      {/* Popular skeleton — magazine split */}
      <View style={sk.section}>
        <View style={sk.sectionHeader}>
          <View style={{ gap: 6 } as object}>
            <SkeletonBlock opacity={opacity} width={28} height={10} borderRadius={3} />
            <SkeletonBlock opacity={opacity} width={140} height={32} borderRadius={6} />
            <SkeletonBlock opacity={opacity} width={80} height={10} borderRadius={3} />
          </View>
          <SkeletonBlock opacity={opacity} width={60} height={12} borderRadius={3} />
        </View>
        <View style={sk.rule} />
        <View style={{ flexDirection: 'row', gap: 14, height: 460 } as object}>
          <SkeletonBlock opacity={opacity} width={380} height={460} borderRadius={12} style={{ flexShrink: 0 }} />
          <View style={popularRightGrid as object}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} opacity={opacity} height={223} borderRadius={12} />
            ))}
          </View>
        </View>
      </View>

      {/* Villains + X-Men skeleton */}
      {[{ cols: 5, height: 190 }, { cols: 3, height: 260 }].map((conf, si) => (
        <View key={si} style={sk.section}>
          <View style={sk.sectionHeader}>
            <View style={{ gap: 6 } as object}>
              <SkeletonBlock opacity={opacity} width={28} height={10} borderRadius={3} />
              <SkeletonBlock opacity={opacity} width={110} height={32} borderRadius={6} />
              <SkeletonBlock opacity={opacity} width={90} height={10} borderRadius={3} />
            </View>
            <SkeletonBlock opacity={opacity} width={60} height={12} borderRadius={3} />
          </View>
          <View style={sk.rule} />
          <View
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${conf.cols}, 1fr)`,
              gridAutoRows: `${conf.height}px`,
              gap: 14,
            } as object}
          >
            {Array.from({ length: conf.cols }).map((_, i) => (
              <SkeletonBlock key={i} opacity={opacity} height={conf.height} borderRadius={12} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const sk = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  content: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 80,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  section: { marginBottom: 72 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  rule: { height: 1, backgroundColor: COLORS.navy, opacity: 0.12, marginBottom: 20 },
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

  if (!data) return <DiscoverSkeleton />;

  const { popular, villain, xmen } = data;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {/* ── 01 Popular — magazine split ── */}
      {popular.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            index={0}
            label="Popular"
            category="Heroes"
            onViewAll={() => router.push('/search')}
          />
          <View style={{ flexDirection: 'row', gap: 14, height: 460 } as object}>
            <FeaturedHeroPanel
              hero={popular[0]}
              onPress={() => router.push(`/character/${popular[0].id}`)}
            />
            <View style={popularRightGrid as object}>
              {popular.slice(1, 5).map((hero) => (
                <WebHeroCard
                  key={hero.id}
                  id={String(hero.id)}
                  name={hero.name}
                  imageUrl={hero.image_url}
                  onPress={() => router.push(`/character/${hero.id}`)}
                />
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ── 02 Villains — 5-col compact grid ── */}
      {villain.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            index={1}
            label="Villains"
            category="Rogues Gallery"
            onViewAll={() => router.push('/search')}
          />
          <View style={villainsGrid as object}>
            {villain.map((hero) => (
              <WebHeroCard
                key={hero.id}
                id={String(hero.id)}
                name={hero.name}
                imageUrl={hero.image_url}
                onPress={() => router.push(`/character/${hero.id}`)}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── 03 X-Men — 3-col tall grid ── */}
      {xmen.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            index={2}
            label="X-Men"
            category="Mutants"
            onViewAll={() => router.push('/search')}
          />
          <View style={xmenGrid as object}>
            {xmen.map((hero) => (
              <WebHeroCard
                key={hero.id}
                id={String(hero.id)}
                name={hero.name}
                imageUrl={hero.image_url}
                onPress={() => router.push(`/character/${hero.id}`)}
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

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
