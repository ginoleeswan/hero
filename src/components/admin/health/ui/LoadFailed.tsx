// Terminal load-failure state for a lane that couldn't fetch its backing data
// (e.g. catalog_health exhausting its retries during a metric-refresh stall).
// Before this, a failed query left the SKELETON up forever with no feedback —
// a dead-end that read as "still loading". One line of truth + a retry.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';

export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="cloud-offline-outline" size={22} color="rgba(255,255,255,0.45)" />
      <Text style={styles.text}>Couldn’t load {what}. The database may be busy — try again.</Text>
      <Pressable onPress={onRetry} style={styles.btn} accessibilityRole="button">
        <Ionicons name="refresh" size={14} color="#fff" />
        <Text style={styles.btnText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    maxWidth: 420,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  btnText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: '#fff' },
});
