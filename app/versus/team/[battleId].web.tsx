import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { ClashArena } from '../../../src/components/versus/ClashArena';
import { ClashSkeleton } from '../../../src/components/versus/ClashSkeleton';

export default function TeamClashWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { loading, sideA, sideB, result, tally, vote } = useTeamBattle(battleId);

  const onVote = (teamId: string) => {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    void vote(teamId);
  };

  if (loading || !sideA || !sideB || !result) {
    return (
      <View style={[styles.root, styles.content]}>
        <ClashSkeleton topInset={TOPBAR_HEIGHT} bottomInset={24} />
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
        tally={tally}
        onVote={onVote}
        topInset={TOPBAR_HEIGHT}
        bottomInset={24}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flexGrow: 1 },
});
