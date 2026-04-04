import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { getFavouriteCount } from '../../src/lib/db/favourites';
import { COLORS } from '../../src/constants/colors';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [favCount, setFavCount] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    getFavouriteCount(user.id)
      .then(setFavCount)
      .catch(() => setFavCount(0));
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={COLORS.beige} />
        </View>

        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {favCount === null ? '–' : favCount}
          </Text>
          <Text style={styles.statLabel}>Favourites</Text>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color={COLORS.beige} size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={COLORS.beige} style={styles.signOutIcon} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  email: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 16,
    color: COLORS.navy,
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statNumber: {
    fontFamily: 'Flame-Bold',
    fontSize: 40,
    color: COLORS.orange,
  },
  statLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.grey,
    marginTop: 4,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  signOutIcon: {
    marginRight: 8,
  },
  signOutText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.beige,
  },
});
