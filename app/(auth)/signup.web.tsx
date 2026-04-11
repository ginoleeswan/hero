import { useState } from 'react';
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

const LOGIN_HERO = require('../../assets/images/login-hero.webp');
const HERO_ASPECT = LOGIN_HERO.width / LOGIN_HERO.height;

export default function WebSignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    const { error } = await signUp(email, password);
    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email to confirm your account.');
    }
    setLoading(false);
  };

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
          <View style={styles.mobileCardHandle} />

          <View style={styles.headingRow}>
            <View style={styles.headingAccent} />
            <View style={styles.headingText}>
              <Text style={styles.heading}>Create account</Text>
              <Text style={styles.subheading}>Free to join, no credit card required</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {message && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{message}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input as object}
            placeholder="you@example.com"
            placeholderTextColor="rgba(41,60,67,0.3)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput] as object}
              placeholder="••••••••"
              placeholderTextColor="rgba(41,60,67,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={styles.passwordToggleText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && (styles.buttonPressed as object)]}
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
          <View style={styles.headingRow}>
            <View style={styles.headingAccent} />
            <View style={styles.headingText}>
              <Text style={styles.heading}>Create account</Text>
              <Text style={styles.subheading}>Free to join, no credit card required</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {message && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{message}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input as object}
            placeholder="you@example.com"
            placeholderTextColor="rgba(41,60,67,0.3)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput] as object}
              placeholder="••••••••"
              placeholderTextColor="rgba(41,60,67,0.3)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={styles.passwordToggleText}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && (styles.buttonPressed as object)]}
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
  },
  subheading: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.grey,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(181,48,43,0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.red,
  },
  successBox: {
    backgroundColor: 'rgba(99,169,54,0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  successText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.green,
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
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 64,
    marginBottom: 14,
  },
  passwordToggle: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 14,
    justifyContent: 'center',
  },
  passwordToggleText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.orange,
    letterSpacing: 0.3,
  },
  button: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 18,
    boxShadow: '0 4px 18px rgba(231,115,51,0.32)',
    cursor: 'pointer',
  } as object,
  buttonPressed: {
    opacity: 0.88,
    boxShadow: '0 2px 8px rgba(231,115,51,0.2)',
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
});
