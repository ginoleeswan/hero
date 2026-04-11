import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';
import { HeroLogo } from '../../src/components/web/HeroLogo';
import { DotGrid } from '../../src/components/ui/DotGrid';
import { AnimatedInput } from '../../src/components/ui/AnimatedInput';

const LOGIN_HERO = require('../../assets/images/login-hero.webp');

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const illustrationH = screenHeight * 0.46;
  // Card fills remaining space + the negative overlap so it reaches the bottom edge
  const cardMinHeight = screenHeight - illustrationH + 40;

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.root}>
      {/* Logo — floats over illustration, pinned to safe area */}
      <View style={[styles.logoWrap, { top: insets.top + 16 }]}>
        <HeroLogo iconSize={36} fontSize={28} color={COLORS.beige} gap={10} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          bounces={false}
        >
          {/* Illustration — scrolls away naturally when keyboard opens */}
          <View style={[styles.illustrationWrap, { height: illustrationH }]}>
            <DotGrid />
            <Image
              source={LOGIN_HERO}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              contentPosition="top"
            />
            <LinearGradient
              colors={['transparent', COLORS.navy]}
              locations={[0.4, 1]}
              style={styles.scrim}
            />
          </View>

          {/* Card — overlaps illustration, fills remaining space */}
          <View
            style={[
              styles.card,
              {
                minHeight: cardMinHeight,
                paddingBottom: Math.max(insets.bottom + 12, 20),
              },
            ]}
          >
            <View style={styles.cardHandle} />

            <View style={styles.headingRow}>
              <View style={styles.headingAccent} />
              <View style={styles.headingText}>
                <Text style={styles.heading}>Welcome back</Text>
                <Text style={styles.subheading}>Sign in to your account</Text>
              </View>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={COLORS.red} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>Email</Text>
            <AnimatedInput isFocused={emailFocused}>
              <TextInput
                style={[styles.input, emailFocused && styles.inputFocused]}
                placeholder="you@example.com"
                placeholderTextColor="rgba(41,60,67,0.3)"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                accessibilityLabel="Email address"
              />
            </AnimatedInput>

            <Text style={styles.label}>Password</Text>
            <AnimatedInput isFocused={passwordFocused}>
              <View style={[styles.passwordWrapper, passwordFocused && styles.inputFocused]}>
                <TextInput
                  ref={passwordRef}
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(41,60,67,0.3)"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeToggle}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="rgba(41,60,67,0.4)"
                  />
                </Pressable>
              </View>
            </AnimatedInput>

            <Pressable
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotWrap}
              accessibilityRole="link"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (pressed || loading) && styles.buttonPressed,
                loading && styles.buttonLoading,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.switchRow}>
              <Text style={styles.switchText}>Don't have an account? </Text>
              <Text style={styles.switchLink}>Sign up</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  logoWrap: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },

  kav: {
    flex: 1,
    // Beige bg fills the area behind the iOS keyboard's rounded top corners
    backgroundColor: COLORS.beige,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Illustration — navy background matches root so any exposed area blends in
  illustrationWrap: {
    backgroundColor: COLORS.navy,
    overflow: 'hidden',
  },
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
  },

  // Card — overlaps illustration via marginTop, beige fills to bottom
  card: {
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 20,
    marginTop: -40,
  },
  cardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(41,60,67,0.15)',
    alignSelf: 'center',
    marginBottom: 24,
  },

  // Form
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 22,
  },
  headingAccent: {
    width: 4,
    height: 56,
    backgroundColor: COLORS.orange,
    borderRadius: 2,
    marginTop: 3,
    flexShrink: 0,
  },
  headingText: {
    flex: 1,
  },
  heading: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.navy,
    lineHeight: 38,
    marginBottom: 4,
  },
  subheading: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.grey,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(181,48,43,0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.red,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.navy,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.55,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    borderWidth: 1,
    borderColor: '#e0d6ca',
  },
  inputFocused: {
    borderColor: COLORS.orange,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0d6ca',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
  },
  eyeToggle: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
    letterSpacing: 0.2,
  },
  button: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonLoading: {
    opacity: 0.55,
  },
  buttonText: {
    fontFamily: 'Nunito_700Bold',
    color: 'white',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  switchText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
  },
  switchLink: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    textDecorationLine: 'underline',
  },
});
