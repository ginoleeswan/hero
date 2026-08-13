// Integrity panel — continuous data-quality invariant checks (Catalog →
// Hygiene). Each row is one corruption class from the 2026-07-16 famous-roster
// audit, watched forever instead of rediscovered by hand: green at zero, orange
// with the top offenders when something regresses. Read-only — fixes happen in
// the sibling panels (Duplicates, ComicVine review) or via re-enrichment.
import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { Panel } from '../Panel';
import { InfoTip } from '../InfoTip';
import { fetchDataQuality, type DataQualityReport } from '../../../../lib/db/dataQuality';

export function IntegrityPanel() {
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await fetchDataQuality());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const dirty = report?.checks.filter((c) => c.count > 0).length ?? 0;

  return (
    <Panel
      title="Integrity"
      hint={
        loading
          ? 'Running checks…'
          : report
            ? dirty === 0
              ? 'All invariants hold'
              : `${dirty} check${dirty === 1 ? '' : 's'} need attention`
            : 'Unavailable'
      }
      action={
        <View style={styles.actions}>
          <InfoTip text="Continuous invariant checks over the catalogue: stale enrichments (marked done but empty — they never re-fetch), cross-franchise collision drift (should stay zero; growth means the publisher gate leaked), gaps on famous characters, and same-name-same-publisher duplicates. Green means the invariant holds; tap refresh after fixing." />
          <Pressable onPress={load} disabled={loading} accessibilityLabel="Re-run integrity checks">
            <Ionicons name="refresh" size={16} color={loading ? COLORS.grey : COLORS.navy} />
          </Pressable>
        </View>
      }
    >
      {loading && !report ? (
        <ActivityIndicator color={COLORS.orange} style={styles.spin} />
      ) : !report ? (
        <Text style={styles.unavailable}>Couldn’t load the integrity report.</Text>
      ) : (
        <View style={styles.list}>
          {report.checks.map((c) => {
            const ok = c.count === 0;
            return (
              <View key={c.key} style={styles.row}>
                <Ionicons
                  name={ok ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={ok ? COLORS.green : COLORS.orange}
                />
                <View style={styles.body}>
                  <Text style={styles.label}>
                    {c.label}
                    <Text style={[styles.count, !ok && styles.countBad]}>
                      {'  '}
                      {c.count.toLocaleString()}
                    </Text>
                  </Text>
                  {!ok && c.sample.length > 0 ? (
                    <Text style={styles.sample} numberOfLines={2}>
                      {c.sample.map((s) => s.name).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spin: { marginVertical: 10 },
  unavailable: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: COLORS.grey },
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(41,60,67,0.06)',
  },
  body: { flex: 1, minWidth: 0, gap: 1 },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  count: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12.5,
    color: COLORS.green,
    fontVariant: ['tabular-nums'],
  },
  countBad: { color: COLORS.orange },
  sample: { fontFamily: 'Nunito_400Regular', fontSize: 11.5, color: COLORS.grey, lineHeight: 15 },
});
