// app/house/index.web.tsx
// The index of houses — what /house/[slug] pages hang off, and the one page that
// can be linked from anywhere without knowing a slug.
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import { PageEndCap } from '../../src/components/web/PageEndCap';
import { StageHeader } from '../../src/components/StageHeader';
import { HouseGrid } from '../../src/components/family/HouseIndex';
import { useHouseList } from '../../src/hooks/useHouseList';

export default function HouseIndexPage() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const { houses, isLoading } = useHouseList();

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Houses — family trees' }} />
      <StageHeader
        title="The houses"
        subtitle={houses.length > 0 ? `${houses.length} dynasties charted` : undefined}
        maxWidth={1080}
      />
      <View style={styles.body}>
        <Text style={styles.intro}>
          A house is a family tree with a front door. Open one to walk the lineage, or to ask how
          any two of its members are related.
        </Text>
        {isLoading ? <Text style={styles.muted}>Loading…</Text> : <HouseGrid houses={houses} />}
        {!isLoading && houses.length === 0 ? (
          <Text style={styles.muted}>No houses are charted yet.</Text>
        ) : null}
      </View>
      <PageEndCap />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: COLORS.beige, minHeight: '100lvh' } as object,
  body: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 56,
    gap: 22,
  },
  intro: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 15,
    lineHeight: 24,
    color: '#5a6a72',
    maxWidth: 560,
  },
  muted: { fontFamily: 'FlameSans-Regular', fontSize: 13.5, color: '#8d8375' },
});
