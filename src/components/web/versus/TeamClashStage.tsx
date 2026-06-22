import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../../constants/colors';
import { TugMeter } from '../../versus/TugMeter';
import type { TeamSide, TeamBattleResult } from '../../../lib/teamBattle';

interface Props {
  sideA: TeamSide; sideB: TeamSide; result: TeamBattleResult;
  onVote: (teamId: string) => void;
  tally: { votesA: number; votesB: number; total: number } | null;
}

function Roster({ side, align }: { side: TeamSide; align: 'flex-start' | 'flex-end' }) {
  return (
    <View style={[styles.row, { justifyContent: align }]}>
      {side.roster.map((h) => (
        <View key={h.id} style={styles.card}>
          <Image source={{ uri: h.portrait_url ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      ))}
    </View>
  );
}

export function TeamClashStage({ sideA, sideB, result, onVote, tally }: Props) {
  return (
    <View style={styles.stage}>
      <View style={styles.teamL}>
        <Text style={[styles.tname, { color: COLORS.red }]}>{sideA.team?.name}</Text>
        <Roster side={sideA} align="flex-start" />
      </View>
      <View style={styles.center}>
        <Text style={styles.clash}>CLASH</Text>
        <TugMeter splitA={result.splitA} splitB={result.splitB}
          labelA={sideA.team?.name ?? 'A'} labelB={sideB.team?.name ?? 'B'} />
        <View style={styles.synRow}>
          <Text style={[styles.syn, { color: COLORS.red }]}>+{Math.round(sideA.synergy.total_pct * 100)}%</Text>
          <Text style={[styles.syn, { color: COLORS.blue }]}>+{Math.round(sideB.synergy.total_pct * 100)}%</Text>
        </View>
        <Text style={styles.verdict}>{result.verdict}</Text>
        <View style={styles.votes}>
          <Pressable style={[styles.voteBtn, { backgroundColor: COLORS.red }]} onPress={() => onVote(sideA.team!.id)}>
            <Text style={styles.voteTxt}>Vote {sideA.team?.name}</Text></Pressable>
          <Pressable style={[styles.voteBtn, { backgroundColor: COLORS.blue }]} onPress={() => onVote(sideB.team!.id)}>
            <Text style={styles.voteTxt}>Vote {sideB.team?.name}</Text></Pressable>
        </View>
        {tally && tally.total > 0 && <Text style={styles.tally}>{tally.votesA} – {tally.votesB}</Text>}
      </View>
      <View style={styles.teamR}>
        <Text style={[styles.tname, { color: COLORS.blue, textAlign: 'right' }]}>{sideB.team?.name}</Text>
        <Roster side={sideB} align="flex-end" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flexDirection: 'row', gap: 30, alignItems: 'center', paddingVertical: 40, paddingHorizontal: 40,
    backgroundColor: '#181323' },
  teamL: { flex: 1 }, teamR: { flex: 1 },
  center: { width: 300, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  card: { width: 84, aspectRatio: 7 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#241a36' },
  tname: { fontFamily: 'Nunito_700Bold', fontSize: 14, marginBottom: 8 },
  clash: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.goldAccent, marginBottom: 16 },
  synRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  verdict: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.goldAccent, marginTop: 16, textAlign: 'center' },
  votes: { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  voteBtn: { flex: 1, borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  voteTxt: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
  tally: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: 'rgba(245,235,220,0.7)', marginTop: 10 },
});
