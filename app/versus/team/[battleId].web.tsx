import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { ClashArena } from '../../../src/components/versus/ClashArena';
import { ClashSkeleton } from '../../../src/components/versus/ClashSkeleton';
import { loginHref } from '../../../src/lib/loginRedirect';

export default function TeamClashWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { loading, sideA, sideB, result, tally, vote } = useTeamBattle(battleId);

  const onVote = (teamId: string) => {
    if (!user) {
      router.push(loginHref(pathname));
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
