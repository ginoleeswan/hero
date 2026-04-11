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

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const illustrationH = screenHeight * 0.46;
  const cardMinHeight = screenHeight - illustrationH + 40;

  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signUp(email, password);
    if (error) {
      setError(error.message);
    } else {
      setPendingEmail(email.trim());
    }
    setLoading(false);
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
        keyboardVerticalOffset={-24}
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

            {pendingEmail ? (
              /* ── Confirmation pending state ── */
              <View style={styles.pendingWrap}>
                <View style={styles.pendingIconWrap}>
                  <Ionicons name="mail-outline" size={28} color={COLORS.orange} />
                </View>
                <Text style={styles.pendingTitle}>Check your inbox</Text>
                <Text style={styles.pendingBody}>
                  A confirmation link was sent to{'\n'}
                  <Text style={styles.pendingEmail}>{pendingEmail}</Text>
                </Text>
                <Text style={styles.pendingHint}>
                  Can't find it? Check your Spam or Junk folder.
                </Text>
                <Pressable
                  onPress={() => router.push('/(auth)/login')}
                  style={styles.pendingCta}
                >
                  <Text style={styles.pendingCtaText}>Back to Sign In</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPendingEmail(null);
                    setEmail('');
                    setPassword('');
                  }}
                  style={styles.pendingBack}
                >
                  <Text style={styles.pendingBackText}>Wrong email? Go back</Text>
                </Pressable>
              </View>
            ) : (
              /* ── Sign up form ── */
              <>
                <View style={styles.headingRow}>
                  <View style={styles.headingAccent} />
                  <View style={styles.headingText}>
                    <Text style={styles.heading}>Create account</Text>
                    <Text style={styles.subheading}>Free to join, no credit card required</Text>
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
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="go"
                      onSubmitEditing={handleSignup}
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
                  style={({ pressed }) => [
                    styles.button,
                    (pressed || loading) && styles.buttonPressed,
                    loading && styles.buttonLoading,
                  ]}
                  onPress={handleSignup}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </Pressable>

                <Pressable onPress={() => router.push('/(auth)/login')} style={styles.switchRow}>
                  <Text style={styles.switchText}>Already have an account? </Text>
                  <Text style={styles.switchLink}>Sign in</Text>
                </Pressable>
              </>
            )}
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
    backgroundColor: COLORS.beige,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

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

  // Confirmation pending
  pendingWrap: {
    alignItems: 'center',
    paddingTop: 8,
  },
  pendingIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(231,115,51,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(231,115,51,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pendingTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: COLORS.navy,
    marginBottom: 12,
    textAlign: 'center',
  },
  pendingBody: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 8,
  },
  pendingEmail: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.navy,
  },
  pendingHint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(41,60,67,0.45)',
    textAlign: 'center',
    marginBottom: 28,
  },
  pendingCta: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  pendingCtaText: {
    fontFamily: 'Nunito_700Bold',
    color: 'white',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  pendingBack: {
    paddingVertical: 8,
  },
  pendingBackText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textDecorationLine: 'underline',
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
    marginBottom: 20,
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
