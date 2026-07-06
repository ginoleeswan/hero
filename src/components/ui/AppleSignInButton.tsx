import { Platform, Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';

interface Props {
  onPress: () => void;
  loading?: boolean;
}

function AppleLogo() {
  return (
    <Svg width={16} height={19} viewBox="0 0 24 24">
      <Path
        fill={COLORS.navy}
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
    </Svg>
  );
}

export function AppleSignInButton({ onPress, loading }: Props) {
  // Native iOS: Apple requires their official button component
  if (Platform.OS === 'ios') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- iOS-only native module, required lazily behind the platform guard
    const AppleAuth = require('expo-apple-authentication');
    const {
      AppleAuthenticationButton,
      AppleAuthenticationButtonType,
      AppleAuthenticationButtonStyle,
    } = AppleAuth;

    return (
      <AppleAuthenticationButton
        buttonType={AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        cornerRadius={12}
        style={styles.nativeButton}
        onPress={onPress}
      />
    );
  }

  // Apple Sign In is iOS-only on native
  if (Platform.OS === 'android') return null;

  // Web: custom button matching the Google button style
  return (
    <Pressable
      style={({ pressed }) => [styles.button, (pressed || loading) && styles.pressed]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
    >
      {loading ? (
        <ActivityIndicator color={COLORS.navy} />
      ) : (
        <>
          <View style={styles.logo}>
            <AppleLogo />
          </View>
          <Text style={styles.label}>Continue with Apple</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nativeButton: {
    width: '100%',
    height: 50,
    marginBottom: 10,
  } as object,
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0d6ca',
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.8,
  },
  logo: {
    marginRight: 10,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.navy,
    letterSpacing: 0.2,
  },
});
