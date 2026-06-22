import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SURFACE } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { TOPBAR_HEIGHT } from '../../../src/components/web/TopBar';
import { ClashArena } from '../../../src/components/versus/ClashArena';

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
        tally={tally}
        onVote={onVote}
        topInset={TOPBAR_HEIGHT}
        bottomInset={40}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#181323' },
  content: { flexGrow: 1 },
  center: { flex: 1, minHeight: 400, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181323' },
});
