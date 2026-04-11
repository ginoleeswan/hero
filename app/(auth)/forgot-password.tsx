import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';
import { AnimatedInput } from '../../src/components/ui/AnimatedInput';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email: prefillEmail } = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(prefillEmail ?? '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startCooldown(seconds: number) {
    setResendCooldown(seconds);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleReset() {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
      startCooldown(30);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    await resetPassword(email.trim());
    setLoading(false);
    startCooldown(30);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Back button — pinned at top, never scrolls away */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Go back to sign in"
      >
        <Ionicons name="chevron-back" size={20} color={COLORS.beige} />
        <Text style={styles.backText}>Sign In</Text>
      </Pressable>

      {/* Keyboard-aware scrollable content */}
      <KeyboardAvoidingView
        style={styles.kav}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.centered, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
            {sent ? (
              /* ── Sent state ── */
              <>
                <View style={styles.iconWrap}>
                  <Ionicons name="checkmark-circle-outline" size={28} color={COLORS.orange} />
                </View>
                <Text style={styles.title}>Check your inbox</Text>
                <Text style={styles.subtitle}>
                  A reset link was sent to{'\n'}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>
                <Text style={styles.hint}>
                  Check spam · link expires in 1 hour ·{' '}
                  <Text style={styles.hintLink} onPress={() => setSent(false)}>
                    wrong email?
                  </Text>
                </Text>
                <Pressable
                  onPress={() => router.replace('/(auth)/login')}
                  style={styles.cta}
                >
                  <Text style={styles.ctaText}>Back to Sign In</Text>
                </Pressable>
                <View style={styles.resendRow}>
                  {resendCooldown > 0 ? (
                    <Text style={styles.resendCooldown}>Resend in {resendCooldown}s…</Text>
                  ) : (
                    <Pressable onPress={handleResend} disabled={loading}>
                      <Text style={styles.resendLink}>Didn't get it? Resend</Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              /* ── Form ── */
              <>
                <View style={styles.iconWrap}>
                  <Ionicons name="mail-outline" size={28} color={COLORS.beige} />
                </View>
                <Text style={styles.title}>Reset password</Text>
                <Text style={styles.subtitle}>We'll email you a link to reset it.</Text>

                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle-outline" size={15} color={COLORS.red} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.form}>
                  <AnimatedInput isFocused={emailFocused}>
                    <TextInput
                      style={[styles.input, emailFocused && styles.inputFocused]}
                      placeholder="you@example.com"
                      placeholderTextColor="rgba(245,235,220,0.3)"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="send"
                      onSubmitEditing={handleReset}
                      accessibilityLabel="Email address"
                      keyboardAppearance="dark"
                    />
                  </AnimatedInput>

                  <Pressable
                    style={({ pressed }) => [
                      styles.cta,
                      (pressed || loading || !email.trim()) && styles.ctaDisabled,
                    ]}
                    onPress={handleReset}
                    disabled={loading || !email.trim()}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.ctaText}>Send Reset Link</Text>
                    )}
                  </Pressable>
                </View>
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
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: 'rgba(245,235,220,0.6)',
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    color: COLORS.beige,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.55)',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  emailHighlight: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
  },
  hint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.35)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  hintLink: {
    color: COLORS.orange,
    textDecorationLine: 'underline',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(181,48,43,0.15)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.red,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  input: {
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderRadius: 10,
    padding: 14,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.beige,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.15)',
  },
  inputFocused: {
    borderColor: COLORS.orange,
  },
  cta: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    width: '100%',
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: 'Nunito_700Bold',
    color: 'white',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  resendRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendLink: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.orange,
    textDecorationLine: 'underline',
  },
  resendCooldown: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.4)',
  },
});
