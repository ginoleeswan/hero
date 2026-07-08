import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useDraftBattle } from '../../../src/hooks/useDraftBattle';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { ClashArena } from '../../../src/components/versus/ClashArena';
import { parseIds } from '../../../src/lib/parseIds';

export default function DraftClashWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const aIds = parseIds(params.a);
  const bIds = parseIds(params.b);
  const { loading, sideA, sideB, result } = useDraftBattle(aIds, bIds);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.goldAccent} />
      </View>
    );
  }

  if (!sideA || !sideB || !result) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>We couldn&apos;t build that battle.</Text>
      </View>
    );
  }

  // Document-flow (not a nested ScrollView): the whole app scrolls the document
  // so iOS Safari's toolbar collapses and content bleeds edge-to-edge under it.
  return (
    <View style={[styles.root, styles.content]}>
      <ClashArena
        sideA={sideA}
        sideB={sideB}
        result={result}
        tally={null}
        onVote={() => {}}
        votable={false}
        topInset={TOPBAR_HEIGHT}
        bottomInset={24}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flexGrow: 1 },
  center: {
    flex: 1,
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.deepNavy,
  },
  empty: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: 'rgba(245,235,220,0.7)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
