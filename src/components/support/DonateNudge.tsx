import { Modal, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.emoji}>☕</Text>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,28,32,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 34,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
  },
  emoji: { fontSize: 34, marginBottom: 8 },
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
    color: COLORS.grey,
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
  laterText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.grey },
});
