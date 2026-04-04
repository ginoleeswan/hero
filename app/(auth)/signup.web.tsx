import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { COLORS } from '../../src/constants/colors';

export default function WebSignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.logo}>HERO</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        {error && <Text style={styles.error}>{error}</Text>}
        {message && <Text style={styles.message}>{message}</Text>}

        <TextInput
          style={styles.input as object}
          placeholder="Email"
          placeholderTextColor={COLORS.grey}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input as object}
          placeholder="Password"
          placeholderTextColor={COLORS.grey}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable style={styles.button} onPress={handleSignup} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.beige} />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
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
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 40,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  logo: {
    fontFamily: 'Flame-Regular',
    fontSize: 42,
    color: COLORS.orange,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginBottom: 32,
  },
  error: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.green,
    textAlign: 'center',
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.beige,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.navy,
    outlineStyle: 'none',
  },
  button: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  buttonText: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.beige,
    fontSize: 15,
  },
  link: {
    fontFamily: 'Nunito_400Regular',
    color: COLORS.navy,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: 13,
  },
});
