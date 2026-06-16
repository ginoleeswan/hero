// Activity log — the session's stream of action/run results. Used in Pipelines.
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { Panel } from './Panel';
import { LOG_TONE_COLOR, logClock, type LogEntry } from './format';

export function ActivityLog({ log, clearLog }: { log: LogEntry[]; clearLog: () => void }) {
  const clearAction =
    log.length > 0 ? (
      <Pressable onPress={clearLog} style={styles.miniBtn}>
        <Ionicons name="trash-outline" size={14} color={COLORS.navy} />
        <Text style={styles.miniBtnText}>Clear</Text>
      </Pressable>
    ) : undefined;

  return (
    <Panel
      title="Activity log"
      hint="Live results of actions & runs this session"
      action={clearAction}
    >
      {log.length === 0 ? (
        <Text style={styles.empty}>
          Nothing yet — run a batch or action and results stream in here.
        </Text>
      ) : (
        <ScrollView style={styles.panel} contentContainerStyle={styles.inner} nestedScrollEnabled>
          {log.map((e) => (
            <View key={e.id} style={styles.row}>
              <Text style={styles.time}>{logClock(e.at)}</Text>
              <View style={[styles.dot, { backgroundColor: LOG_TONE_COLOR[e.tone] }]} />
              <Text style={styles.text}>{e.text}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: COLORS.grey, marginTop: 12 },
  panel: {
    maxHeight: 300,
    marginTop: 6,
    backgroundColor: '#faf6ee',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.06)',
  },
  inner: { paddingVertical: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f1ece2',
  },
  time: {
    width: 62,
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.grey,
    fontVariant: ['tabular-nums'],
  },
  dot: { width: 8, height: 8, borderRadius: 8 },
  text: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.black },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#efe6d6',
  },
  miniBtnText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
});
