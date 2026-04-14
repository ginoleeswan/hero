import { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../../constants/colors';

interface ToastState {
  message: string;
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, visible: true });
    timer.current = setTimeout(() => setToast({ message: '', visible: false }), 2500);
  };

  return { toast, showToast };
}

interface Props {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity },
        Platform.OS === 'web' ? (styles.toastWeb as object) : styles.toastNative,
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: COLORS.navy,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 320,
  },
  toastNative: {},
  toastWeb: {
    bottom: 56,
    zIndex: 9999,
  } as object,
  text: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
  },
});
