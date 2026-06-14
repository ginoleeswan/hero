import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';
import { type GeminiSpend } from '../../../../lib/db/catalogHealth';
import { Panel } from '../Panel';

const money = (n: number, cur?: string) =>
  cur && cur !== 'USD' ? `${n.toFixed(2)} ${cur}` : `$${n.toFixed(2)}`;

export function SpendDomain({ spend, loading }: { spend?: GeminiSpend; loading: boolean }) {
  if (loading || !spend) {
    return (
      <Panel title="Gemini / GCP Spend">
        <ActivityIndicator color={COLORS.orange} style={{ marginTop: 16 }} />
      </Panel>
    );
  }
  if (!spend.available) {
    return (
      <Panel title="Gemini / GCP Spend">
        <View style={spend_s.empty}>
          <Ionicons name="cloud-offline-outline" size={26} color={COLORS.grey} />
          <Text style={spend_s.emptyText}>{spend.reason ?? 'Spend data not available yet.'}</Text>
          <Text style={spend_s.emptySub}>
            Enable the BigQuery billing export on the billing account; data appears ~24h later.
          </Text>
        </View>
      </Panel>
    );
  }
  const cur = spend.currency;
  const days = spend.days ?? [];
  const max = Math.max(1, ...days.map((d) => d.cost));
  const services = spend.byService ?? [];
  return (
    <Panel title="Gemini / GCP Spend" hint="BigQuery billing export · last 28 days">
      <View style={spend_s.top}>
        <View>
          <Text style={spend_s.big}>{money(spend.monthToDate ?? 0, cur)}</Text>
          <Text style={spend_s.bigLabel}>this month</Text>
        </View>
        <View>
          <Text style={spend_s.med}>{money(spend.total28 ?? 0, cur)}</Text>
          <Text style={spend_s.bigLabel}>last 28 days</Text>
        </View>
      </View>
      {days.length > 0 && (
        <View style={spend_s.bars}>
          {days.map((d) => (
            <View key={d.day} style={spend_s.barCol}>
              <View style={spend_s.barTrack}>
                <View style={[spend_s.bar, { height: `${Math.round((d.cost / max) * 100)}%` }]} />
              </View>
            </View>
          ))}
        </View>
      )}
      {services.length > 0 && (
        <View style={spend_s.svcWrap}>
          {services.slice(0, 6).map((s) => (
            <View key={s.service} style={spend_s.svcRow}>
              <Text style={spend_s.svcName} numberOfLines={1}>
                {s.service}
              </Text>
              <Text style={spend_s.svcVal}>{money(s.cost, cur)}</Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

const spend_s = StyleSheet.create({
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    maxWidth: 360,
  },
  top: { flexDirection: 'row', gap: 36, marginTop: 10, marginBottom: 14 },
  big: { fontFamily: 'Flame-Regular', fontSize: 38, color: COLORS.green, lineHeight: 40 },
  med: { fontFamily: 'Flame-Regular', fontSize: 30, color: COLORS.navy, lineHeight: 34 },
  bigLabel: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.grey, marginTop: 2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90, marginTop: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: COLORS.green, borderRadius: 3, minHeight: 2 },
  svcWrap: { marginTop: 14, gap: 7 },
  svcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f6f0e6',
  },
  svcName: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.black },
  svcVal: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
});
