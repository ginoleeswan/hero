import { View, ActivityIndicator, StyleSheet, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useDraftBattle } from '../../../src/hooks/useDraftBattle';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { ClashArena } from '../../../src/components/versus/ClashArena';
import { parseIds } from '../../../src/lib/parseIds';

export default function DraftClashWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const router = useRouter();
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
  const editTeams = () =>
    router.canGoBack() ? router.back() : router.replace('/compare/pick');

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
      {/* Escape hatch back into the builder — a drafted clash is never a dead end. */}
      <Pressable onPress={editTeams} style={styles.editPill} accessibilityRole="button">
        <Ionicons name="arrow-back" size={14} color="rgba(245,235,220,0.85)" />
        <Text style={styles.editPillText}>Edit teams</Text>
      </Pressable>
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
  editPill: {
    position: 'absolute',
    top: TOPBAR_HEIGHT + 14,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
  },
  editPillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.85)',
  },
});
