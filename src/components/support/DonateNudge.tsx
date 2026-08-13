import { Pressable, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../ui/Sheet';
import { COLORS, PAPER_TEXT } from '../../constants/colors';

export function DonateNudge({
  visible,
  onConvert,
  onDismiss,
}: {
  visible: boolean;
  onConvert: () => void;
  onDismiss: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onDismiss} label="Support Mythique" style={styles.card}>
      <Ionicons name="cafe" size={30} color={COLORS.orange} style={styles.icon} />
      <Text style={styles.title}>Enjoying Mythique?</Text>
      <Text style={styles.body}>It’s free, made by one person — a coffee keeps it alive.</Text>
      <Pressable
        onPress={onConvert}
        style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
      >
        <Text style={styles.primaryText}>Buy me a coffee</Text>
      </Pressable>
      <Pressable onPress={onDismiss} style={styles.later} hitSlop={8}>
        <Text style={styles.laterText}>Maybe later</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 24, alignItems: 'center' },
  icon: { marginBottom: 8 },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    lineHeight: 30, // ≥ 1.22× fontSize
    color: COLORS.navy,
    marginBottom: 6,
  },
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: PAPER_TEXT.faint,
    textAlign: 'center',
    marginBottom: 18,
  },
  primary: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryPressed: { opacity: 0.9 },
  primaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  later: { paddingVertical: 12, marginTop: 4 },
  laterText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: PAPER_TEXT.faint },
});
