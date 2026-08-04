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

export default function HouseIndexPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { houses, isLoading } = useHouseList();

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Houses' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
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
          {isLoading ? <HouseIndexSkeleton /> : <HouseGrid houses={houses} />}
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
