import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { TeamRosterColumn } from '../../../src/components/versus/TeamRosterColumn';
import { TugMeter } from '../../../src/components/versus/TugMeter';

export default function TeamClashScreen() {
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { loading, sideA, sideB, result, tally, vote } = useTeamBattle(battleId);

  const onVote = async (teamId: string) => {
    if (!user) { router.push('/(auth)/login'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await vote(teamId);
  };

  if (loading || !sideA || !sideB || !result) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={COLORS.goldAccent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}>
        <Text style={styles.title}>{sideA.team?.name} vs {sideB.team?.name}</Text>

        <View style={styles.arena}>
          <TeamRosterColumn side={sideA} />
          <View style={styles.spine}>
            <Text style={styles.vs}>VS</Text>
            <Text style={styles.syn}>+{Math.round(sideA.synergy.total_pct * 100)}%</Text>
            <Text style={styles.syn}>+{Math.round(sideB.synergy.total_pct * 100)}%</Text>
          </View>
          <TeamRosterColumn side={sideB} />
        </View>

        <View style={styles.foot}>
          <TugMeter splitA={result.splitA} splitB={result.splitB}
            labelA={sideA.team?.name ?? 'A'} labelB={sideB.team?.name ?? 'B'} />
          <Text style={styles.verdict}>{result.verdict}</Text>
          <View style={styles.votes}>
            <Pressable style={[styles.voteBtn, { backgroundColor: COLORS.red }]} onPress={() => onVote(sideA.team!.id)}>
              <Text style={styles.voteTxt}>Vote {sideA.team?.name}</Text>
            </Pressable>
            <Pressable style={[styles.voteBtn, { backgroundColor: COLORS.blue }]} onPress={() => onVote(sideB.team!.id)}>
              <Text style={styles.voteTxt}>Vote {sideB.team?.name}</Text>
            </Pressable>
          </View>
          {tally && tally.total > 0 && (
            <Text style={styles.tally}>{tally.votesA} – {tally.votesB} ({tally.total} votes)</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#181323' },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige, textAlign: 'center', marginBottom: 18, paddingHorizontal: 16 },
  arena: { flexDirection: 'row', paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  spine: { width: 46, alignItems: 'center', gap: 8 },
  vs: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.goldAccent },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: COLORS.goldAccent },
  foot: { paddingHorizontal: 20, paddingTop: 24 },
  verdict: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.goldAccent, textAlign: 'center', marginTop: 12 },
  votes: { flexDirection: 'row', gap: 10, marginTop: 16 },
  voteBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  voteTxt: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff' },
  tally: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: 'rgba(245,235,220,0.7)', textAlign: 'center', marginTop: 10 },
});
