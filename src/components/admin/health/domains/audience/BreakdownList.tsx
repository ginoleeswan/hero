// Tappable horizontal bar list for the Visitors sub-tab. Each row is a bucket
// (a country, a browser, a source…) with its visitor count and a proportional
// fill; tapping a row toggles it as the sessions filter so "who was here from
// Germany on Safari" is two taps. `selected` draws the active row in ink.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../../constants/colors';
import { EmptyState } from '../../ui';

export interface BreakdownRow {
  key: string;
  label: string;
  /** Small trailing note — "views 1,204" or "engaged 40%". */
  note?: string;
  value: number;
}

export function BreakdownList({
  rows,
  empty,
  selected,
  onSelect,
  unit = 'visitors',
}: {
  rows: BreakdownRow[];
  empty: string;
  selected?: string | null;
  /** Omit to render a plain (non-interactive) list. */
  onSelect?: (key: string | null) => void;
  unit?: string;
}) {
  if (rows.length === 0) return <EmptyState text={empty} />;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <View style={s.list}>
      {rows.map((r) => {
        const on = selected === r.key;
        const pct = Math.max(3, Math.round((r.value / max) * 100));
        const share = total > 0 ? Math.round((r.value / total) * 100) : 0;
        const body = (
          <View style={[s.row, on && s.rowOn]}>
            <View style={s.top}>
              <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>
                {r.label}
              </Text>
              {r.note ? (
                <Text style={s.note} numberOfLines={1}>
                  {r.note}
                </Text>
              ) : null}
              <Text style={[s.val, on && s.valOn]}>
                {r.value.toLocaleString()}
                <Text style={s.share}> · {share}%</Text>
              </Text>
              {onSelect ? (
                <Ionicons
                  name={on ? 'close-circle' : 'funnel-outline'}
                  size={13}
                  color={on ? COLORS.orange : 'rgba(41,60,67,0.3)'}
                />
              ) : null}
            </View>
            <View style={s.track}>
              <View style={[s.fill, on && s.fillOn, { width: `${pct}%` }]} />
            </View>
          </View>
        );
        return onSelect ? (
          <Pressable
            key={r.key}
            onPress={() => onSelect(on ? null : r.key)}
            accessibilityLabel={`${on ? 'Clear' : 'Filter sessions by'} ${r.label} (${r.value} ${unit})`}
          >
            {body}
          </Pressable>
        ) : (
          <View key={r.key}>{body}</View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 6 },
  row: { gap: 4, paddingVertical: 3, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: 8 },
  rowOn: { backgroundColor: 'rgba(231,115,51,0.08)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: COLORS.black },
  labelOn: { color: COLORS.orange },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: COLORS.grey },
  val: { fontFamily: 'Flame-Regular', fontSize: 13, color: COLORS.navy },
  valOn: { color: COLORS.orange },
  share: { fontFamily: 'Nunito_400Regular', fontSize: 10.5, color: COLORS.grey },
  track: { height: 6, borderRadius: 999, backgroundColor: '#efe6d6', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: COLORS.navy },
  fillOn: { backgroundColor: COLORS.orange },
});
