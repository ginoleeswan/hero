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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { getUserFavouriteHeroes, type FavouriteHero } from '../../src/lib/db/favourites';
import { HERO_IMAGES } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 32 - 8) / 3;

function username(email: string) {
  return email.split('@')[0] ?? email;
}

function FavouriteThumb({ hero, onPress }: { hero: FavouriteHero; onPress: () => void }) {
  const src = hero.image_url
    ? (HERO_IMAGES[hero.image_url] ?? HERO_IMAGES[hero.id])
    : HERO_IMAGES[hero.id];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.thumb}>
      <Image source={src} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.thumbName} numberOfLines={1}>
        {hero.name}
      </Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
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
  const name = username(email);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Page title */}
        <Text style={styles.pageTitle}>profile</Text>

        {/* Identity card */}
        <View style={styles.identityCard}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <LinearGradient colors={[COLORS.orange, '#c04a10']} style={styles.avatar}>
              <Text style={styles.avatarInitials}>{name.slice(0, 2).toUpperCase()}</Text>
            </LinearGradient>
          </View>

          <Text style={styles.username}>{name}</Text>
          <Text style={styles.email}>{email}</Text>

          {/* Stat pill */}
          <View style={styles.statPill}>
            <Ionicons name="heart" size={14} color={COLORS.orange} />
            <Text style={styles.statPillText}>
              {loading ? '–' : favourites.length} saved heroes
            </Text>
          </View>
        </View>

        {/* My Favourites */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Favourites</Text>
            {!loading && favourites.length > 0 && (
              <Text style={styles.sectionCount}>{favourites.length}</Text>
            )}
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.orange} />
            </View>
          ) : favourites.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="heart-outline" size={32} color={COLORS.orange} />
              </View>
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyBody}>
                Open any hero and tap the heart to build your collection
              </Text>
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

        {/* Account section */}
        <View style={styles.accountSection}>
          <Text style={styles.accountSectionTitle}>Account</Text>

          <View style={styles.accountCard}>
            <View style={styles.accountRow}>
              <Ionicons name="mail-outline" size={18} color={COLORS.navy} />
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue} numberOfLines={1}>
                {email}
              </Text>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.accountRow}
              onPress={handleSignOut}
              disabled={signingOut}
              activeOpacity={0.7}
            >
              {signingOut ? (
                <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
              ) : (
                <Ionicons name="log-out-outline" size={18} color={COLORS.red} />
              )}
              <Text style={[styles.accountLabel, { color: COLORS.red }]}>
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  // Header
  pageTitle: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 50,
    color: COLORS.navy,
    paddingTop: 8,
    paddingLeft: 4,
    marginBottom: 20,
  },

  // Identity card
  identityCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarWrapper: {
    marginBottom: 14,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Flame-Bold',
    fontSize: 28,
    color: '#fff',
  },
  username: {
    fontFamily: 'Flame-Bold',
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: 4,
  },
  email: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 16,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff5ee',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fde0cc',
  },
  statPillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
  },

  // Favourites
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Flame-Bold',
    fontSize: 20,
    color: COLORS.navy,
    flex: 1,
  },
  sectionCount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.grey,
    backgroundColor: '#e8ddd0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  center: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.25,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  thumbName: {
    fontFamily: 'Flame-Regular',
    fontSize: 10,
    color: '#fff',
    paddingHorizontal: 6,
    paddingBottom: 5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff5ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Flame-Bold',
    fontSize: 17,
    color: COLORS.navy,
    marginBottom: 6,
  },
  emptyBody: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Account section
  accountSection: {
    marginBottom: 8,
  },
  accountSectionTitle: {
    fontFamily: 'Flame-Bold',
    fontSize: 20,
    color: COLORS.navy,
    marginBottom: 12,
  },
  accountCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  accountLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.navy,
    flex: 1,
  },
  accountValue: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    maxWidth: SCREEN_WIDTH * 0.4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ede5d8',
    marginHorizontal: 16,
  },
});
