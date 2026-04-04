import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { getUserFavouriteHeroes, type FavouriteHero } from '../../src/lib/db/favourites';
import { HERO_IMAGES } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 48 - 12) / 3; // 3-column grid, 16px outer padding + 12px gap

function initials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

function FavouriteThumb({ hero, onPress }: { hero: FavouriteHero; onPress: () => void }) {
  const src = hero.image_url ? (HERO_IMAGES[hero.image_url] ?? HERO_IMAGES[hero.id]) : HERO_IMAGES[hero.id];
  return (
    <TouchableOpacity style={styles.thumb} onPress={onPress} activeOpacity={0.8}>
      <Image source={src} contentFit="cover" style={styles.thumbImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.65)']}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.thumbName} numberOfLines={1}>{hero.name}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserFavouriteHeroes(user.id)
      .then(setFavourites)
      .catch(() => setFavourites([]))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const email = user?.email ?? '';

  return (
    <View style={styles.container}>
      {/* Banner */}
      <LinearGradient
        colors={[COLORS.navy, '#1e3a45']}
        style={[styles.banner, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(email)}</Text>
          </View>
        </View>
        <Text style={styles.emailText}>{email}</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{favourites.length}</Text>
            <Text style={styles.statLabel}>Favourites</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Favourites grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Favourites</Text>
          {loading ? (
            <ActivityIndicator color={COLORS.orange} style={{ marginTop: 24 }} />
          ) : favourites.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={40} color={COLORS.grey} />
              <Text style={styles.emptyText}>No favourites yet</Text>
              <Text style={styles.emptySubtext}>Tap the heart on any hero to save them here</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {favourites.map((hero) => (
                <FavouriteThumb
                  key={hero.id}
                  hero={hero}
                  onPress={() => router.push(`/character/${hero.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
        >
          {signingOut ? (
            <ActivityIndicator color={COLORS.beige} size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={COLORS.beige} style={{ marginRight: 8 }} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  banner: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#2a4a55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Flame-Bold',
    fontSize: 26,
    color: COLORS.orange,
  },
  emailText: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: 'rgba(245,235,220,0.75)',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: 'Flame-Bold',
    fontSize: 28,
    color: COLORS.beige,
  },
  statLabel: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.6)',
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Flame-Bold',
    fontSize: 20,
    color: COLORS.navy,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.2,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbName: {
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: '#fff',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.grey,
  },
  emptySubtext: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.navy,
    paddingVertical: 14,
    borderRadius: 14,
  },
  signOutText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.beige,
  },
});
