import { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

const isWeb = Platform.OS === 'web';

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
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isWeb) return;
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
  }, [visible, slideAnim]);

  useEffect(() => {
    if (visible) {
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
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={isWeb ? styles.overlayWeb : styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <Animated.View
          style={[
            isWeb ? (styles.dialog as object) : styles.sheet,
            !isWeb && {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [600, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Fills the gap behind the keyboard, covers iOS keyboard border-radius corners */}
          {!isWeb && <View style={styles.keyboardFill} />}
          {!isWeb && <View style={styles.handle} />}

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
              placeholderTextColor="rgba(41,60,67,0.3)"
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
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayWeb: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  keyboardFill: {
    position: 'absolute',
    bottom: -400,
    left: 0,
    right: 0,
    height: 400,
    backgroundColor: COLORS.beige,
  },
  dialog: {
    backgroundColor: COLORS.beige,
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingBottom: 28,
    paddingTop: 24,
    width: 420,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(41,60,67,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
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
    color: COLORS.navy,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.55,
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
    color: 'rgba(41,60,67,0.35)',
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
