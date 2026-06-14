import { Platform, Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../constants/colors';

interface Props {
  onPress: () => void;
  loading?: boolean;
}

function AppleLogo() {
  return (
    <Svg width={16} height={19} viewBox="0 0 814 1000">
      <Path
        fill={COLORS.navy}
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-150.7-77.5c-71.8-63.8-130.8-163.1-130.8-257.6s30.5-162.7 91-214.5c51.9-44.6 119.6-71.7 193.7-71.7 74.8 0 131.6 29.6 185.4 29.6 51.7 0 108.2-30.7 185-30.7zm-126.7-93.9c35-41.7 60.1-99.4 60.1-157.1 0-8.2-.7-16.4-2.1-24.4-56.9 2.1-124.1 38-165.1 81.3-30.7 33.4-62.5 90.3-62.5 149.7 0 9.3 1.4 18.6 2.1 21.5 3.5.7 8.9 1.4 14.4 1.4 50.9 0 113.3-33.5 153.1-72.4z"
      />
    </Svg>
  );
}

export function AppleSignInButton({ onPress, loading }: Props) {
  // Native iOS: Apple requires their official button component
  if (Platform.OS === 'ios') {
    const {
      AppleAuthenticationButton,
      AppleAuthenticationButtonType,
      AppleAuthenticationButtonStyle,
    } = require('expo-apple-authentication');

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
