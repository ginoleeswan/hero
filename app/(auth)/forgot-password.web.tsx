import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';
import { HeroLogo } from '../../src/components/web/HeroLogo';
import { Image } from 'expo-image';

const LOGIN_HERO = require('../../assets/images/login-hero.webp');
const HERO_ASPECT = LOGIN_HERO.width / LOGIN_HERO.height;

export default function WebForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
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

  const formContent = sent ? (
    /* ── Sent state ── */
    <View style={styles.pendingWrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle-outline" size={28} color={COLORS.orange} />
      </View>
      <Text style={styles.heading}>Check your inbox</Text>
      <Text style={styles.subheading}>
        A reset link was sent to{'\n'}
        <Text style={styles.emailHighlight}>{email}</Text>
      </Text>
      <Text style={styles.hint}>
        Check spam · link expires in 1 hour ·{' '}
        <Text style={styles.hintLink} onPress={() => setSent(false)}>
          wrong email?
        </Text>
      </Text>
      <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.button as object}>
        <Text style={styles.buttonText}>Back to Sign In</Text>
      </Pressable>
      <View style={styles.resendRow}>
        {resendCooldown > 0 ? (
          <Text style={styles.resendCooldown}>Resend in {resendCooldown}s…</Text>
        ) : (
          <Pressable onPress={handleResend} disabled={loading} style={styles.resendLink as object}>
            <Text style={styles.resendLinkText}>Didn't get it? Resend</Text>
          </Pressable>
        )}
      </View>
    </View>
  ) : (
    /* ── Form ── */
    <>
      <Pressable
        onPress={() => router.back()}
        style={styles.back as object}
        accessibilityRole="link"
      >
        <Ionicons name="chevron-back" size={18} color="rgba(41,60,67,0.5)" />
        <Text style={styles.backText}>Back to Sign In</Text>
      </Pressable>

      <View style={styles.headingRow}>
        <View style={styles.headingAccent} />
        <View style={styles.headingText}>
          <Text style={styles.heading}>Reset password</Text>
          <Text style={styles.subheading}>We'll email you a link to get back in.</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={[styles.input, emailFocused && styles.inputFocused] as object}
        placeholder="you@example.com"
        placeholderTextColor="rgba(41,60,67,0.3)"
        value={email}
        onChangeText={setEmail}
        onFocus={() => setEmailFocused(true)}
        onBlur={() => setEmailFocused(false)}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={handleReset}
        accessibilityLabel="Email address"
      />

      <Pressable
        style={({ pressed }) =>
          [styles.button, (pressed || loading || !email.trim()) && styles.buttonDisabled] as object
        }
        onPress={handleReset}
        disabled={loading || !email.trim()}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Send Reset Link</Text>
        )}
      </Pressable>
    </>
  );

  // ── Mobile web ─────────────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <View style={styles.mobileRoot}>
        <View style={styles.mobileIllustrationWrap}>
          <Image
            source={LOGIN_HERO}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            contentPosition={{ x: '50%', y: '0%' }}
          />
          <View style={styles.mobileScrim as object} pointerEvents="none" />
        </View>
        <View style={styles.mobileLogo}>
          <HeroLogo iconSize={36} fontSize={28} color={COLORS.beige} gap={10} />
        </View>
        <View style={styles.mobileCard}>
          <View style={styles.mobileCardHandle} />
          {formContent}
        </View>
      </View>
    );
  }

  // ── Desktop split panel ────────────────────────────────────────────────
  return (
    <View style={styles.desktopRoot}>
      <View style={styles.brand}>
        <View style={styles.brandDots as object} pointerEvents="none" />
        <View style={styles.brandGlow as object} pointerEvents="none" />
        <View style={styles.brandLogoWrap}>
          <HeroLogo iconSize={48} fontSize={36} color={COLORS.beige} gap={12} />
        </View>
        <Image source={LOGIN_HERO} style={styles.illustration as object} contentFit="cover" />
        <View style={styles.brandBottom}>
          <Text style={styles.brandTagline}>The Superhero{'\n'}Encyclopedia</Text>
          <Text style={styles.brandSub}>Forgot your password?{'\n'}We've got you covered.</Text>
          <View style={styles.brandAccent} />
        </View>
      </View>
      <View style={styles.formPanelDesktop}>
        <View style={styles.formInner}>{formContent}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Mobile ─────────────────────────────────────────────────────────────
  mobileRoot: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  mobileIllustrationWrap: {
    position: 'absolute',
    top: -32,
    left: 0,
    right: 0,
    height: '58%',
    backgroundColor: COLORS.navy,
    backgroundImage: 'radial-gradient(circle, rgba(245,235,220,0.07) 1.5px, transparent 1.5px)',
    backgroundSize: '24px 24px',
  } as object,
  mobileScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundImage: `linear-gradient(to bottom, transparent 0%, ${COLORS.navy} 70%, ${COLORS.beige} 100%)`,
  },
  mobileLogo: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  mobileCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: '45%',
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 48,
  },
  mobileCardHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(41,60,67,0.15)',
    alignSelf: 'center',
    marginBottom: 24,
  },

  // ── Desktop ────────────────────────────────────────────────────────────
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: COLORS.beige,
  },
  brand: {
    flex: 1,
    backgroundColor: COLORS.navy,
    overflow: 'hidden',
  },
  brandDots: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'radial-gradient(circle, rgba(245,235,220,0.07) 1.5px, transparent 1.5px)',
    backgroundSize: '24px 24px',
  },
  brandGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 480,
    backgroundImage:
      'radial-gradient(ellipse 70% 55% at 65% 100%, rgba(231,115,51,0.28) 0%, transparent 70%)',
  },
  brandLogoWrap: {
    position: 'absolute',
    top: 48,
    left: 48,
    zIndex: 10,
  },
  illustration: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: '100%',
    aspectRatio: HERO_ASPECT,
    zIndex: 5,
  },
  brandBottom: {
    position: 'absolute',
    bottom: 48,
    left: 48,
    right: 160,
    zIndex: 10,
  },
  brandTagline: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    color: COLORS.beige,
    lineHeight: 40,
    marginBottom: 12,
  },
  brandSub: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.5)',
    lineHeight: 22,
    marginBottom: 24,
  },
  brandAccent: {
    width: 48,
    height: 4,
    backgroundColor: COLORS.orange,
    borderRadius: 2,
  },
  formPanelDesktop: {
    width: 480,
    backgroundColor: COLORS.beige,
    justifyContent: 'center',
    paddingHorizontal: 56,
  },
  formInner: {
    width: '100%',
  },

  // ── Shared form styles ─────────────────────────────────────────────────
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 28,
    paddingVertical: 4,
    cursor: 'pointer',
  },
  backText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(41,60,67,0.5)',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 28,
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
    textAlign: 'center',
  },
  subheading: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.grey,
    lineHeight: 20,
    textAlign: 'center',
  },
  emailHighlight: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.navy,
  },
  hint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(41,60,67,0.4)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
    marginTop: 4,
  },
  hintLink: {
    color: COLORS.orange,
    textDecorationLine: 'underline',
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
    marginBottom: 16,
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
    marginBottom: 14,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    borderWidth: 1,
    borderColor: '#e0d6ca',
    outlineStyle: 'none',
    transition: 'border-color 0.15s ease',
  },
  inputFocused: {
    borderColor: COLORS.orange,
  },
  button: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 17,
    alignItems: 'center',
    marginBottom: 18,
    boxShadow: '0 4px 18px rgba(231,115,51,0.32)',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  } as object,
  buttonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  } as object,
  buttonText: {
    fontFamily: 'Nunito_700Bold',
    color: 'white',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // ── Pending / success state ────────────────────────────────────────────
  pendingWrap: {
    alignItems: 'center',
    paddingTop: 8,
  },
  iconWrap: {
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
  resendRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendLink: {
    cursor: 'pointer',
  },
  resendLinkText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.orange,
    textDecorationLine: 'underline',
  },
  resendCooldown: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: 'rgba(41,60,67,0.4)',
  },
});
