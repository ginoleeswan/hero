// app/(auth)/login.tsx — THE auth screen, singular.
//
// Login and signup used to be two nearly identical pages, and the split forced
// every caller to guess the user's history for them ("Create Account" vs "I
// already have an account"). Nobody knows that better than the database, so
// the screen asks for the EMAIL first and lets the answer route the flow:
//
//   email step ──→ account with a password  → password step (sign in)
//              ──→ no account               → create step (choose a password)
//              ──→ account, OAuth only      → "you signed up with Apple" +
//                                             the matching button highlighted,
//                                             because a password prompt there
//                                             is a dead end the user cannot
//                                             escape without support mail.
//
// /(auth)/signup now redirects here; the web pair keeps its own flow.
//
// NO SCROLLVIEW, by design. The illustration is the only flexible element, so
// the keyboard compresses ART, never controls. A sign-in form that scrolls is a
// sign-in form whose button can be off-screen. Everything below the art is
// therefore kept lean enough to survive an iPhone SE with the keyboard up.
//
// The card reads top to bottom as: brand anchor -> WHY -> fastest path ->
// fallback -> escape hatch. The logo lives INSIDE the card as its masthead
// rather than floating over the artwork, where it belonged to neither the art
// nor the form; and the headline exists because the screen used to open on a
// bare form that never said what an account is for.
import { useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Text, TextInput } from '../../src/components/ui/Text';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS, PAPER_TEXT, ORANGE_INK } from '../../src/constants/colors';
import { HeroLogo } from '../../src/components/web/HeroLogo';
import { DotGrid } from '../../src/components/ui/DotGrid';
import { AnimatedInput } from '../../src/components/ui/AnimatedInput';
import { SocialDivider } from '../../src/components/ui/SocialDivider';
import { GoogleSignInButton } from '../../src/components/ui/GoogleSignInButton';
import { AppleSignInButton } from '../../src/components/ui/AppleSignInButton';
import { postAuthTarget } from '../../src/lib/loginRedirect';
import { lookupEmail, hasPasswordProvider, oauthProviders } from '../../src/lib/db/authLookup';

// Google Sign-In requires the OAuth URL scheme registered at native build time.
// Expo Go / dev client builds don't have it — hide the button in those environments.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const LOGIN_HERO = require('../../assets/images/login-hero.webp');

/** Which form is on screen. `sent` is signup's parked confirmation card. */
type Step = 'email' | 'password' | 'create' | 'oauth' | 'sent';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "apple" → "Apple" for the you-signed-up-with copy. */
const providerLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

/** The one orange CTA every step ends in. A component rather than a helper
 *  called during render: the handlers it receives close over a ref (the
 *  password field focus), and a render-time call site is exactly what the
 *  compiler's refs rule cannot prove safe. As a component, onPress is
 *  plainly an event handler. */
function PrimaryButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        (pressed || loading) && styles.buttonPressed,
        loading && styles.buttonLoading,
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export default function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [oauthList, setOauthList] = useState<string[]>([]);

  const passwordRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  // ── Step transitions ───────────────────────────────────────────────────────

  const handleContinue = async () => {
    const clean = email.trim();
    if (!EMAIL_RE.test(clean)) {
      setError('That does not look like an email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const found = await lookupEmail(clean);
      if (!found.exists) {
        setStep('create');
      } else if (hasPasswordProvider(found)) {
        setStep('password');
      } else {
        // Account exists but was created with Apple/Google — no password to
        // type. Route to the button they used instead of a prompt that can
        // only fail.
        setOauthList(oauthProviders(found));
        setStep('oauth');
      }
      // Focus lands on the password field once it mounts.
      setTimeout(() => passwordRef.current?.focus(), 80);
    } catch {
      // "Could not check" must never be misread as "no account": a flaky
      // connection would funnel an existing user into sign-up and a baffling
      // "already registered" error.
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(
        /invalid login credentials/i.test(error.message)
          ? 'Wrong password. Try again, or reset it below.'
          : error.message,
      );
      setLoading(false);
    } else {
      // Return to the page the user was acting on (the AuthGate honors the
      // same param and would otherwise win the race anyway).
      router.replace(postAuthTarget(returnTo));
    }
  };

  const handleCreate = async () => {
    if (password.length < 8) {
      setError('Password needs at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await signUp(email.trim(), password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setStep('sent');
      setLoading(false);
    }
  };

  /** Back to the email step, clearing everything the old email implied.
   *
   *  The address is KEPT rather than blanked — "Change" is nearly always
   *  reached because of a typo, and retyping a whole address to fix one
   *  character is the wrong tax. It is focused and fully selected instead, so
   *  typing replaces and a tap-to-place-caret still edits. (Without the
   *  selection the field simply appended to the old value, which produced
   *  addresses like `...@gmailbrandnew...@example.com`.) */
  const changeEmail = () => {
    setStep('email');
    setPassword('');
    setError(null);
    setOauthList([]);
    setTimeout(() => emailRef.current?.focus(), 80);
  };

  const social = (which: 'apple' | 'google') => async () => {
    const setBusy = which === 'apple' ? setAppleLoading : setGoogleLoading;
    const call = which === 'apple' ? signInWithApple : signInWithGoogle;
    setBusy(true);
    setError(null);
    const { error } = await call();
    if (error) setError(error.message);
    setBusy(false);
  };

  // ── Pieces ─────────────────────────────────────────────────────────────────

  // The chosen email, shown as a chip on every post-email step so "wait, typo"
  // is one tap away rather than a restart.
  const emailChip = (
    <Pressable onPress={changeEmail} style={styles.emailChip} accessibilityRole="button">
      <Text style={styles.emailChipText} numberOfLines={1}>
        {email.trim()}
      </Text>
      <Text style={styles.emailChipEdit}>Change</Text>
    </Pressable>
  );

  const passwordField = (isNew: boolean) => (
    <AnimatedInput isFocused={passwordFocused}>
      <View style={[styles.passwordWrapper, passwordFocused && styles.inputFocused]}>
        <TextInput
          ref={passwordRef}
          style={styles.passwordInput}
          placeholder={isNew ? 'Choose a password (8+ characters)' : 'Your password'}
          placeholderTextColor={PAPER_TEXT.placeholder}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          secureTextEntry={!showPassword}
          autoComplete={isNew ? 'new-password' : 'password'}
          textContentType={isNew ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={isNew ? handleCreate : handleSignIn}
          accessibilityLabel={isNew ? 'New password' : 'Password'}
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
            color={PAPER_TEXT.faint}
          />
        </Pressable>
      </View>
    </AnimatedInput>
  );

  // ── Steps ──────────────────────────────────────────────────────────────────

  const stepEmail = (
    <>
      {/* No "EMAIL" label. The placeholder reads you@example.com and the
          keyboard is an email keyboard — a caps-lock label above it was a
          third way of saying the same thing, and the tallest thing on the
          screen that carried no information. */}
      <AnimatedInput isFocused={emailFocused}>
        <TextInput
          ref={emailRef}
          selectTextOnFocus
          style={[styles.input, emailFocused && styles.inputFocused]}
          placeholder="you@example.com"
          placeholderTextColor={PAPER_TEXT.placeholder}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={handleContinue}
          accessibilityLabel="Email address"
        />
      </AnimatedInput>
      <PrimaryButton label="Continue" onPress={handleContinue} loading={loading} />
      {/* Email leads because it is the account the app itself issues; the
          provider tiles are the shortcut, not the headline. */}
      {!isExpoGo && (
        <>
          <SocialDivider label="or continue with" />
          <View style={styles.socialRow}>
            <AppleSignInButton onPress={social('apple')} loading={appleLoading} />
            <GoogleSignInButton onPress={social('google')} loading={googleLoading} />
          </View>
        </>
      )}
      <Pressable onPress={() => router.replace('/explore')} style={styles.guestRow}>
        <Text style={styles.guestText}>Browse without signing in</Text>
      </Pressable>
    </>
  );

  const stepPassword = (
    <>
      <Text style={styles.stepTitle}>Welcome back.</Text>
      {emailChip}
      {passwordField(false)}
      <Pressable
        onPress={() => router.push('/(auth)/forgot-password')}
        style={styles.forgotWrap}
        accessibilityRole="link"
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>
      <PrimaryButton label="Sign In" onPress={handleSignIn} loading={loading} />
    </>
  );

  const stepCreate = (
    <>
      <Text style={styles.stepTitle}>New here. Welcome.</Text>
      {emailChip}
      {passwordField(true)}
      <Text style={styles.hint}>Favourites, takes and streaks will follow this account.</Text>
      <PrimaryButton label="Create Account" onPress={handleCreate} loading={loading} />
    </>
  );

  const stepOauth = (
    <>
      <Text style={styles.stepTitle}>You’re already here.</Text>
      {emailChip}
      <Text style={styles.hint}>
        This account signs in with {oauthList.map(providerLabel).join(' or ')} — no password needed.
      </Text>
      <View style={styles.socialRow}>
        {!isExpoGo && oauthList.includes('apple') && (
          <AppleSignInButton onPress={social('apple')} loading={appleLoading} />
        )}
        {!isExpoGo && oauthList.includes('google') && (
          <GoogleSignInButton onPress={social('google')} loading={googleLoading} />
        )}
      </View>
    </>
  );

  const stepSent = (
    <>
      <View style={styles.sentBadge}>
        <Ionicons name="mail-unread-outline" size={26} color={ORANGE_INK} />
      </View>
      <Text style={styles.stepTitle}>Check your email.</Text>
      <Text style={styles.hint}>
        A confirmation link is on its way to {email.trim()}. Tap it, then come back and sign in.
      </Text>
      <PrimaryButton label="Back to sign in" onPress={changeEmail} loading={loading} />
    </>
  );

  const body = {
    email: stepEmail,
    password: stepPassword,
    create: stepCreate,
    oauth: stepOauth,
    sent: stepSent,
  }[step];

  return (
    <View style={styles.root}>
      {/* Back control. Drawn here rather than as a native header: the group
          sits inside the root layout's headerless Stack, so a nested
          Stack.Screen header never rendered. This is the same chip the
          character page uses over its artwork, and it has the advantage of
          being immune to iOS 26's glass wash. Hidden when there is nothing to
          go back to — a cold deep-link into sign-in has no parent, and a
          chevron that pops the user to a blank stack is worse than none. */}
      {router.canGoBack() && (
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.backChip, { top: insets.top + 8 }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.beige} />
        </Pressable>
      )}
      <KeyboardAvoidingView
        style={styles.kav}
        // iOS only: Android's adjustResize already resizes the window, and
        // stacking "padding" on top of it double-shifts the form.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* The ONLY flexible element. The keyboard compresses this, never the
            form; overflow hidden crops the art instead of squashing it. */}
        <View style={styles.illustrationWrap}>
          <DotGrid />
          <Image
            source={LOGIN_HERO}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
          />
          <LinearGradient
            colors={['transparent', COLORS.navy]}
            locations={[0.4, 1]}
            style={styles.scrim}
          />
        </View>

        <View
          style={[
            styles.card,
            {
              paddingBottom: Math.max(insets.bottom + 12, 20),
              // A short phone in the email step is the tightest fit; cap the
              // card's share so at least a sliver of stage always survives.
              maxHeight: screenHeight * 0.78,
            },
          ]}
        >
          <View style={styles.masthead}>
            <HeroLogo iconSize={22} fontSize={18} color={COLORS.navy} gap={7} />
          </View>

          {step === 'email' && (
            <>
              <Text style={styles.headline}>Keep your streak.</Text>
              <Text style={styles.headlineSub}>
                Favourites, takes and a streak that follows you.
              </Text>
            </>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={COLORS.red} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {body}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  backChip: {
    position: 'absolute',
    left: 16,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(11,24,32,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kav: {
    flex: 1,
    // Beige bg fills the area behind the iOS keyboard's rounded top corners
    backgroundColor: COLORS.beige,
  },

  // Illustration — navy background matches root so any exposed area blends in
  illustrationWrap: {
    flex: 1,
    minHeight: 60,
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

  // Card — content-sized, overlaps the stage by its own radius
  masthead: {
    alignSelf: 'center',
    marginBottom: 14,
  },
  headline: {
    fontFamily: 'Flame-Regular',
    fontSize: 25,
    lineHeight: 31,
    color: COLORS.navy,
    textAlign: 'center',
  },
  headlineSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: PAPER_TEXT.faint,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  // Equal-width marks. `gap` here and `flex: 1` on the buttons means the row
  // divides itself however many providers exist — Android has no Apple button
  // and the Google mark simply takes the full width.
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  card: {
    // Full-bleed on a phone (the cap is wider than the window), a centred panel
    // on a tablet. A sign-in form stretched across 1194pt is the single most
    // recognisable "iPhone app running on an iPad" tell — and a 900pt-wide
    // email field is not easier to fill in than a 460pt one, just a longer
    // distance for the eye between the label and the end of the box.
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: COLORS.beige,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 20,
    marginTop: -28,
  },

  stepTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    lineHeight: 30,
    color: COLORS.navy,
    marginBottom: 14,
  },

  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0d6ca',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  emailChipText: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.navy,
  },
  emailChipEdit: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: ORANGE_INK,
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
    color: PAPER_TEXT.faint,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
  hint: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: PAPER_TEXT.faint,
    marginBottom: 14,
  },
  forgotWrap: {
    alignSelf: 'flex-end',
    marginBottom: 14,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: ORANGE_INK,
    letterSpacing: 0.2,
  },
  button: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 6,
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
  guestRow: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 4,
  },
  guestText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: PAPER_TEXT.faint,
    textDecorationLine: 'underline',
  },
  sentBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(231,115,51,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
});
