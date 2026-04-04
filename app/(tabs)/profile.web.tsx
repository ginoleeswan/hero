import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { getUserFavouriteHeroes, type FavouriteHero } from '../../src/lib/db/favourites';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { COLORS } from '../../src/constants/colors';

export default function WebProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    getUserFavouriteHeroes(user.id)
      .then(setFavourites)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace('/(auth)/login');
  };

  const email = user?.email ?? '';
  const initial = email.charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.username}>{email.split('@')[0]}</Text>
        <Text style={styles.email}>{email}</Text>
        <View style={styles.panelDivider} />
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Favourites</Text>
          <Text style={styles.statValue}>{favourites.length}</Text>
        </View>
        <Pressable onPress={handleSignOut} disabled={signingOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>{signingOut ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>
      </View>

      <View style={styles.rightPanel}>
        <Text style={styles.rightTitle}>Favourites</Text>
        {loading ? (
          <FavouritesSkeleton />
        ) : favourites.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No favourites yet.</Text>
            <Pressable onPress={() => router.push('/')} style={styles.browseBtn}>
              <Text style={styles.browseBtnText}>Browse heroes</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid as object}>
            {favourites.map((hero) => (
              <WebHeroCard
                key={hero.id}
                id={hero.id}
                name={hero.name}
                imageUrl={hero.image_url}
                onPress={() => router.push(`/character/${hero.id}`)}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function FavouritesSkeleton() {
  const opacity = useSkeletonAnim();
  return (
    <View style={styles.grid as object}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonBlock key={i} opacity={opacity} height={180} borderRadius={12} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.beige },

  panel: {
    width: 260,
    backgroundColor: COLORS.navy,
    padding: 24,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: 'white',
  },
  username: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
  },
  email: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.5)',
    marginTop: 3,
  },
  panelDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  statLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.4)',
  },
  statValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.beige,
  },
  signOutBtn: {
    marginTop: 'auto' as unknown as number,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(232,98,26,0.15)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  signOutText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
  },

  rightPanel: { flex: 1, padding: 24 },
  rightTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: COLORS.grey,
  },
  browseBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  browseBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.beige,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
  },
});
