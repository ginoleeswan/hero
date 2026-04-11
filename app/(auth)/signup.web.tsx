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
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';
import { HeroLogo } from '../../src/components/web/HeroLogo';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SocialDivider } from '../../src/components/ui/SocialDivider';
import { GoogleSignInButton } from '../../src/components/ui/GoogleSignInButton';

const LOGIN_HERO = require('../../assets/images/login-hero.webp');
const HERO_ASPECT = LOGIN_HERO.width / LOGIN_HERO.height;

export default function WebSignupScreen() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordRef = useRef<TextInput>(null);

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

  const pendingContent = (
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
        style={styles.pendingCta as object}
      >
        <Text style={styles.pendingCtaText}>Back to Sign In</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setPendingEmail(null);
          setEmail('');
          setPassword('');
        }}
        style={styles.pendingBack as object}
      >
        <Text style={styles.pendingBackText}>Wrong email? Go back</Text>
      </Pressable>
    </View>
  );

  const formContent = pendingEmail ? pendingContent : (
    <>
      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={COLORS.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <GoogleSignInButton
        onPress={async () => {
          setGoogleLoading(true);
          setError(null);
          const { error } = await signInWithGoogle();
          if (error) setError(error.message);
          setGoogleLoading(false);
        }}
        loading={googleLoading}
      />

      <SocialDivider label="or continue with email" />

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
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        accessibilityLabel="Email address"
      />

      <Text style={styles.label}>Password</Text>
      <View style={[styles.passwordWrapper, passwordFocused && styles.inputFocused] as object}>
        <TextInput
          ref={passwordRef}
          style={styles.passwordInput as object}
          placeholder="••••••••"
          placeholderTextColor="rgba(41,60,67,0.3)"
          value={password}
          onChangeText={setPassword}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={handleSignup}
          accessibilityLabel="Password"
        />
        <Pressable
          onPress={() => setShowPassword((v) => !v)}
          style={styles.eyeToggle as object}
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

      <Pressable
        style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed, loading && styles.buttonLoading] as object}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Create Account</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/login')} style={styles.switchRow as object}>
        <Text style={styles.switchText}>Already have an account? </Text>
        <Text style={styles.switchLink}>Sign in</Text>
      </Pressable>
    </>
  );

  // ── Mobile layout: full-bleed illustration + bottom card ───────────────
  if (!isDesktop) {
    return (
      <View style={styles.mobileRoot}>
        {/* Hero illustration — contained in top region */}
        <View style={styles.mobileIllustrationWrap}>
          <Image
            source={LOGIN_HERO}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            contentPosition={{ x: '50%', y: '0%' }}
          />
          {/* Scrim fades bottom of illustration into card */}
          <View style={styles.mobileScrim as object} pointerEvents="none" />
        </View>

        {/* Logo — floats top-left over illustration */}
        <View style={styles.mobileLogo}>
          <HeroLogo iconSize={36} fontSize={28} color={COLORS.beige} gap={10} />
        </View>

        {/* Form card — rises from bottom */}
        <View style={styles.mobileCard}>
          <View style={styles.cardAccent} />
          {formContent}
        </View>
      </View>
    );
  }

  // ── Desktop layout: split panel ────────────────────────────────────────
  return (
    <View style={styles.desktopRoot}>
      {/* Left brand panel */}
      <View style={styles.brand}>
        <View style={styles.brandDots as object} pointerEvents="none" />
        <View style={styles.brandGlow as object} pointerEvents="none" />

        <View style={styles.brandLogoWrap}>
          <HeroLogo iconSize={48} fontSize={36} color={COLORS.beige} gap={12} />
        </View>

        <Image
          source={LOGIN_HERO}
          style={styles.illustration as object}
          contentFit="cover"
        />

        <View style={styles.brandBottom}>
          <Text style={styles.brandTagline}>Join the{'\n'}Universe</Text>
          <Text style={styles.brandSub}>
            Track your favourite heroes across{'\n'}Marvel, DC, and beyond.
          </Text>
          <View style={styles.brandAccent} />
        </View>
      </View>

      {/* Right form panel */}
      <View style={styles.formPanelDesktop}>
        <View style={styles.formInner}>
          {formContent}
        </View>
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
    backgroundImage:
      'radial-gradient(circle, rgba(245,235,220,0.07) 1.5px, transparent 1.5px)',
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
  cardAccent: {
    width: 40,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
    alignSelf: 'center',
    marginBottom: 24,
    opacity: 0.7,
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
    backgroundImage:
      'radial-gradient(circle, rgba(245,235,220,0.07) 1.5px, transparent 1.5px)',
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
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0d6ca',
    transition: 'border-color 0.15s ease',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    outlineStyle: 'none',
  },
  eyeToggle: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    cursor: 'pointer',
  } as object,
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
    cursor: 'pointer',
  } as object,
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

  // ── Confirmation pending ────────────────────────────────────────────────
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
    marginBottom: 32,
  },
  pendingCta: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 17,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    boxShadow: '0 4px 18px rgba(231,115,51,0.32)',
    cursor: 'pointer',
  },
  pendingCtaText: {
    fontFamily: 'Nunito_700Bold',
    color: 'white',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  pendingBack: {
    paddingVertical: 8,
    cursor: 'pointer',
  },
  pendingBackText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textDecorationLine: 'underline',
  },
});
