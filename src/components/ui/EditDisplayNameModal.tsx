import { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { COLORS, PAPER_TEXT } from '../../constants/colors';

interface Props {
  visible: boolean;
  currentName: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export function EditDisplayNameModal({ visible, currentName, onClose, onSubmit }: Props) {
  const [value, setValue] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Seed the field with the current name and focus it when the sheet opens. The
  // reset is paired with the focus timer, so it stays an effect (fires on the
  // open transition, not every render).
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(currentName);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, currentName]);

  const handleClose = () => {
    setValue(currentName);
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    setLoading(true);
    await onSubmit(trimmed);
    setLoading(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      avoidKeyboard
      label="Edit display name"
      style={styles.body}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Edit display name</Text>
        <Pressable onPress={handleClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={COLORS.navy} />
        </Pressable>
      </View>

      <Text style={styles.label}>Display name</Text>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={setValue}
          autoCapitalize="words"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          placeholderTextColor={PAPER_TEXT.placeholder}
          placeholder="Your name"
        />
      </View>
      <Text style={styles.charCount}>{value.length}/40</Text>

      <Pressable
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
        onPress={handleSubmit}
        disabled={loading || !value.trim()}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Save</Text>
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
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputRow: {
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0d6ca',
    marginBottom: 4,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
  },
  charCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    textAlign: 'right',
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontFamily: 'Nunito_700Bold', color: 'white', fontSize: 16 },
});
