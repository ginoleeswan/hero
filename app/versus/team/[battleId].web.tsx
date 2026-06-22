import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { useScreenChrome } from '../../../src/hooks/useScreenChrome';
import { SURFACE } from '../../../src/constants/colors';
import { TeamClashStage } from '../../../src/components/web/versus/TeamClashStage';

export default function TeamClashWeb() {
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { loading, sideA, sideB, result, tally, vote } = useTeamBattle(battleId);

  const onVote = (teamId: string) => {
    if (!user) { router.push('/(auth)/login'); return; }
    void vote(teamId);
  };

  if (loading || !sideA || !sideB || !result) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.goldAccent} /></View>;
  }

  return (
    <ScrollView style={styles.root}>
      <TeamClashStage sideA={sideA} sideB={sideB} result={result} onVote={onVote} tally={tally} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#181323' },
  center: { flex: 1, minHeight: 400, alignItems: 'center', justifyContent: 'center', backgroundColor: '#181323' },
});
