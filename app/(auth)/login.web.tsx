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

export default function WebLoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={[styles.root, isDesktop && styles.rootDesktop]}>
      {/* Left brand panel — desktop only */}
      {isDesktop && (
        <View style={styles.brand}>
          <HeroLogo iconSize={56} fontSize={56} color={COLORS.beige} gap={16} />
          <View style={styles.brandGlass as object}>
            <Text style={styles.brandTagline}>The Superhero Encyclopedia</Text>
            <Text style={styles.brandSub}>
              Discover the stories, powers, and origins of{'\n'}hundreds of heroes and villains.
            </Text>
          </View>
          <View style={styles.brandAccent} />
        </View>
      )}

      {/* Form panel */}
      <View style={[styles.formPanel, isDesktop && styles.formPanelDesktop]}>
        {!isDesktop && (
          <View style={styles.mobileLogoWrap}>
            <HeroLogo iconSize={40} fontSize={40} color={COLORS.navy} gap={12} />
          </View>
        )}

        <View style={styles.formInner}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Sign in to your account</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
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
          <TextInput
            style={styles.input as object}
            placeholder="••••••••"
            placeholderTextColor="rgba(41,60,67,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },

  // Brand panel
  brand: {
    flex: 1,
    backgroundColor: COLORS.navy,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 56,
  },
  brandLogo: {
    marginBottom: 16,
  },
  brandGlass: {
    marginTop: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.1)',
    padding: 20,
  },
  brandTagline: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    marginBottom: 10,
  },
  brandSub: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 13,
    color: 'rgba(245,235,220,0.55)',
    lineHeight: 21,
  },
  brandAccent: {
    marginTop: 40,
    width: 48,
    height: 4,
    backgroundColor: COLORS.orange,
    borderRadius: 2,
  },

  // Mobile logo
  mobileLogoWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },

  // Form panel
  formPanel: {
    width: '100%',
    maxWidth: 400,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
  },
  formPanelDesktop: {
    width: 440,
    maxWidth: 440,
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 0,
    backgroundColor: COLORS.beige,
    alignItems: 'stretch',
  },
  formInner: {
    width: '100%',
  },

  heading: {
    fontFamily: 'Flame-Bold',
    fontSize: 28,
    color: COLORS.navy,
    marginBottom: 4,
  },
  subheading: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.grey,
    marginBottom: 28,
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

  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 13,
    marginBottom: 16,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    borderWidth: 1,
    borderColor: '#e0d6ca',
    outlineStyle: 'none',
  },

  button: {
    backgroundColor: COLORS.orange,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  buttonText: {
    fontFamily: 'Nunito_700Bold',
    color: 'white',
    fontSize: 15,
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
