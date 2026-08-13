import { useState, useRef } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, TextInput } from './Text';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { COLORS, PAPER_TEXT } from '../../constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
}

export function ChangePasswordModal({ visible, onClose, onSubmit }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const reset = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    setLoading(false);
    setShowCurrent(false);
    setShowNext(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!current || !next || !confirm) {
      setError('All fields are required.');
      return;
    }
    if (next.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await onSubmit(current, next);
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    reset();
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      avoidKeyboard
      label="Change password"
      style={styles.body}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Change Password</Text>
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={22} color={COLORS.navy} />
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Current password</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry={!showCurrent}
          autoComplete="password"
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
          placeholderTextColor={PAPER_TEXT.placeholder}
          placeholder="••••••••"
        />
        <Pressable
          onPress={() => setShowCurrent((v) => !v)}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={showCurrent ? 'Hide current password' : 'Show current password'}
        >
          <Ionicons
            name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="rgba(41,60,67,0.4)"
          />
        </Pressable>
      </View>

      <Text style={styles.label}>New password</Text>
      <View style={styles.inputRow}>
        <TextInput
          ref={nextRef}
          style={styles.input}
          value={next}
          onChangeText={setNext}
          secureTextEntry={!showNext}
          autoComplete="new-password"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          placeholderTextColor={PAPER_TEXT.placeholder}
          placeholder="••••••••"
        />
        <Pressable
          onPress={() => setShowNext((v) => !v)}
          style={styles.eye}
          accessibilityRole="button"
          accessibilityLabel={showNext ? 'Hide new password' : 'Show new password'}
        >
          <Ionicons
            name={showNext ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color="rgba(41,60,67,0.4)"
          />
        </Pressable>
      </View>

      <Text style={styles.label}>Confirm new password</Text>
      <TextInput
        ref={confirmRef}
        style={[styles.inputRow, styles.inputStandalone]}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        placeholderTextColor={PAPER_TEXT.placeholder}
        placeholder="••••••••"
      />

      <Pressable
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Update Password</Text>
        )}
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 22 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(181,48,43,0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  errorText: { flex: 1, fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.red },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0d6ca',
    marginBottom: 14,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16, // ≥16: iOS zooms on focus below this
    color: COLORS.navy,
  },
  inputStandalone: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'Nunito_400Regular',
    fontSize: 16, // ≥16: iOS zooms on focus below this
    color: COLORS.navy,
  },
  eye: { paddingHorizontal: 12, paddingVertical: 13 },
  button: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontFamily: 'Nunito_700Bold', color: 'white', fontSize: 16 },
});
