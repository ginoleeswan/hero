import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useDraftBattle } from '../../../src/hooks/useDraftBattle';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { ClashArena } from '../../../src/components/versus/ClashArena';

function parseIds(v: string | string[] | undefined): string[] {
  const s = Array.isArray(v) ? v[0] : v;
  return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 5);
}

export default function DraftClashWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const aIds = parseIds(params.a);
  const bIds = parseIds(params.b);
  const { loading, sideA, sideB, result } = useDraftBattle(aIds, bIds);

  if (loading || !sideA || !sideB || !result) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.goldAccent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ClashArena
        sideA={sideA}
        sideB={sideB}
        result={result}
        tally={null}
        onVote={() => {}}
        votable={false}
        topInset={TOPBAR_HEIGHT}
        bottomInset={40}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flexGrow: 1 },
  center: { flex: 1, minHeight: 400, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.deepNavy },
});
