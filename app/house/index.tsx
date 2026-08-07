// app/house/index.tsx
// Native houses index. expo-router resolves by platform extension and both files
// must exist or it throws.
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../src/constants/colors';
import { StageHeader } from '../../src/components/StageHeader';
import { HouseGrid } from '../../src/components/family/HouseIndex';
import { useHouseList } from '../../src/hooks/useHouseList';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { HouseIndexSkeleton } from '../../src/components/skeletons/HouseIndexSkeleton';
import { FadeOutSkeleton } from '../../src/components/ui/FadeOutSkeleton';
import { useSkeletonTransition } from '../../src/hooks/useSkeletonTransition';
import { OverscrollBleed } from '../../src/components/ui/OverscrollBleed';

export default function HouseIndexPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { houses, isLoading } = useHouseList();
  // pre → the grid region stays empty, so a cached list never blinks a skeleton.
  const phase = useSkeletonTransition(isLoading);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Houses' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Rubber-banding at the top shows navy, not the beige root. */}
        <OverscrollBleed color={COLORS.navy} />
        <StageHeader
          title="The houses"
          subtitle={houses.length > 0 ? `${houses.length} dynasties charted` : undefined}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
        />
        <View style={styles.body}>
          <Text style={styles.intro}>
            A house is a family tree with a front door. Open one to walk the lineage, or to ask how
            any two of its members are related.
          </Text>
          <View>
            {isLoading ? (
              phase === 'skeleton' ? (
                <HouseIndexSkeleton />
              ) : null
            ) : (
              <HouseGrid houses={houses} />
            )}
            {phase === 'crossfade' ? (
              <FadeOutSkeleton>
                <HouseIndexSkeleton />
              </FadeOutSkeleton>
            ) : null}
          </View>
          {!isLoading && houses.length === 0 ? (
            <EmptyState
              icon="home-outline"
              title="No houses are charted yet."
              body="Dynasties appear here as their family trees are drawn."
              tone="light"
              compact
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  body: { padding: 16, gap: 18 },
  intro: { fontFamily: 'FlameSans-Regular', fontSize: 14.5, lineHeight: 22, color: '#5a6a72' },
});
