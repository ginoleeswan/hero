// Alert pills shown under the vitals ribbon in every domain. The shell owns the
// alert list + collapsed/expanded state; this renders it. On mobile multiple
// alerts collapse to one worst-first banner that expands on tap.
import { type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';

export type Alert = { tone: 'red' | 'gold'; text: string };

function AlertPill({
  tone,
  text,
  onPress,
  trailing,
  numberOfLines,
}: {
  tone: 'red' | 'gold';
  text: string;
  onPress?: () => void;
  trailing?: ReactNode;
  numberOfLines?: number;
}) {
  const base = tone === 'red' ? COLORS.red : COLORS.yellow;
  const style = [styles.alert, { backgroundColor: base + '2e', borderColor: base + '66' }];
  const inner = (
    <>
      <Ionicons
        name={tone === 'red' ? 'alert-circle' : 'warning'}
        size={16}
        color={tone === 'red' ? '#f08a7e' : COLORS.yellow}
      />
      <Text style={styles.alertText} numberOfLines={numberOfLines}>
        {text}
      </Text>
      {trailing}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={style}>
      {inner}
    </Pressable>
  ) : (
    <View style={style}>{inner}</View>
  );
}

export function AlertStack({
  alerts,
  narrow,
  open,
  onOpen,
  onClose,
}: {
  alerts: Alert[];
  narrow: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  if (alerts.length === 0) return null;
  const lead = alerts.find((a) => a.tone === 'red') ?? alerts[0];
  const collapsed = narrow && !open && alerts.length > 1;

  if (collapsed) {
    return (
      <AlertPill
        tone={lead.tone}
        text={lead.text}
        numberOfLines={1}
        onPress={onOpen}
        trailing={
          <>
            <View style={styles.count}>
              <Text style={styles.countText}>+{alerts.length - 1}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.7)" />
          </>
        }
      />
    );
  }
  return (
    <View style={styles.wrap}>
      {alerts.map((a, i) => (
        <AlertPill key={i} tone={a.tone} text={a.text} />
      ))}
      {narrow && alerts.length > 1 && (
        <Pressable onPress={onClose} style={styles.collapse}>
          <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.collapseText}>Show less</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  alertText: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(255,255,255,0.92)' },
  count: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: '#fff' },
  collapse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingVertical: 4,
  },
  collapseText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: 'rgba(255,255,255,0.6)' },
});
