import { useCallback, useEffect, useState } from 'react';
import { queryClient } from '../../src/lib/query/queryClient';
import { loginHref } from '../../src/lib/loginRedirect';
import { exploreKeys } from '../../src/lib/query/keys';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect, Path } from 'react-native-svg';
import { LOGO_MASK_PATH as HERO_LOGO_PATH } from '../../src/constants/logo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SquircleMask } from '../../src/components/ui/SquircleMask';
import { PressScale } from '../../src/components/ui/PressScale';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { SkeletonProvider } from '../../src/components/ui/SkeletonProvider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, usePathname } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { useProfileData } from '../../src/hooks/useProfileData';
import { openKofi } from '../../src/lib/support/kofi';
import { EditDisplayNameModal } from '../../src/components/ui/EditDisplayNameModal';
import { BadgeDetailModal } from '../../src/components/ui/BadgeDetailModal';
import {
  GettingStartedCard,
  type GettingStartedStep,
} from '../../src/components/ui/GettingStartedCard';
import { useUniverseShareImage } from '../../src/hooks/useUniverseShareImage';
import { useDonationNudge } from '../../src/hooks/useDonationNudge';
import { DonateNudge } from '../../src/components/support/DonateNudge';
import { removeFavourite, type FavouriteHero } from '../../src/lib/db/favourites';
import { deleteTake, type MyTake } from '../../src/lib/db/takes';
import { dominantAlignment, shortPublisher } from '../../src/lib/db/taste';
import { computeBadges, earnedCount, type Badge } from '../../src/lib/profile/badges';
import { buildProfileStats } from '../../src/lib/profile/stats';
import { fanTier, tierProgress } from '../../src/lib/profile/fanTier';
import { StatStrip } from '../../src/components/profile/StatStrip';
import { SectionShell } from '../../src/components/profile/SectionShell';
import { ContributionsList } from '../../src/components/profile/ContributionsList';
import { MyTakes } from '../../src/components/profile/MyTakes';
import { TasteMixBar } from '../../src/components/profile/TasteMixBar';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS } from '../../src/constants/colors';
import { Toast, useToast } from '../../src/components/ui/Toast';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Sized to fit 3 across inside a SectionShell panel (16 gutter + 24 padding
// each side + two 8px gaps).
const THUMB_SIZE = (SCREEN_WIDTH - 32 - 48 - 16) / 3;
// Badge tiles: 4 across inside the same panel (three 10px gaps).
const BADGE_TILE = (SCREEN_WIDTH - 32 - 48 - 30) / 4;

function username(email: string) {
  return email.split('@')[0] ?? email;
}

function FavouriteThumb({
  hero,
  onPress,
  onLongPress,
}: {
  hero: FavouriteHero;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  return (
    <PressScale onPress={onPress} onLongPress={handleLongPress} scale={0.91} style={styles.thumb}>
      <SquircleMask style={StyleSheet.absoluteFill} cornerRadius={26}>
        <HeroImage
          id={hero.id}
          name={hero.name}
          imageUrl={hero.image_url}
          portraitUrl={hero.portrait_url}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          locations={[0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </SquircleMask>
      <Text style={styles.thumbName} numberOfLines={1}>
        {hero.name}
      </Text>
    </PressScale>
  );
}

/** Skeleton grid matching the favourites thumbs while they load. */
function FavouritesSkeleton() {
  return (
    <SkeletonProvider>
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width={THUMB_SIZE} height={THUMB_SIZE * 1.25} borderRadius={20} />
        ))}
      </View>
    </SkeletonProvider>
  );
}

const GUEST_BENEFITS = [
  {
    icon: 'heart' as const,
    badge: 'accountIconBadgeOrange' as const,
    tint: COLORS.orange,
    title: 'Save your favourites',
    sub: 'Build a personal collection of characters',
  },
  {
    icon: 'color-palette' as const,
    badge: 'accountIconBadgeNavy' as const,
    tint: COLORS.navy,
    title: 'Customise your profile',
    sub: 'Add your own avatar and cover photo',
  },
  {
    icon: 'sync' as const,
    badge: 'accountIconBadgeNavy' as const,
    tint: COLORS.navy,
    title: 'Sync across devices',
    sub: 'Pick up right where you left off',
  },
];

function GuestProfileScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
      >
        {/* Cover banner */}
        <View style={[styles.cover, { height: 140 + insets.top }]}>
          <LinearGradient
            colors={['#293C43', '#3d5a66']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            <Svg style={StyleSheet.absoluteFill} width={SCREEN_WIDTH} height={280}>
              <Defs>
                <Pattern id="dots" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
                  <Circle cx="7" cy="7" r="1.5" fill="rgba(231,115,51,0.22)" />
                </Pattern>
              </Defs>
              <Rect width={SCREEN_WIDTH} height={280} fill="url(#dots)" />
            </Svg>
            <View style={styles.coverLogo}>
              <Svg width={72} height={72} viewBox="0 0 1024 1024">
                <Path fill="#ECECDE" d={HERO_LOGO_PATH} />
              </Svg>
            </View>
          </LinearGradient>
        </View>

        {/* Emblem overlapping the cover */}
        <View style={styles.avatarZone}>
          <LinearGradient colors={[COLORS.orange, '#c04a10']} style={styles.avatar}>
            <Ionicons name="person" size={38} color="white" />
          </LinearGradient>
        </View>

        {/* Pitch */}
        <View style={styles.guestHeader}>
          <Text style={styles.guestTitle}>Join the Mythique community</Text>
          <Text style={styles.guestBody}>
            Create a free account to save heroes and make the app your own.
          </Text>
        </View>

        {/* Benefits */}
        <View style={styles.guestSection}>
          <View style={styles.accountCard}>
            {GUEST_BENEFITS.map((b, i) => (
              <View key={b.title}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.benefitRow}>
                  <View style={[styles.accountIconBadge, styles[b.badge]]}>
                    <Ionicons name={b.icon} size={16} color={b.tint} />
                  </View>
                  <View style={styles.benefitText}>
                    <Text style={styles.benefitTitle}>{b.title}</Text>
                    <Text style={styles.benefitSub}>{b.sub}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Call to action */}
        <View style={styles.guestActions}>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            style={styles.guestSignInBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.guestSignInText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push(loginHref(pathname))}
            style={styles.guestSignUpBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.guestSignUpText}>I already have an account</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.guestSection}>
          <TouchableOpacity style={styles.supportRow} onPress={openKofi} activeOpacity={0.7}>
            <View style={[styles.accountIconBadge, styles.accountIconBadgeOrange]}>
              <Ionicons name="cafe-outline" size={16} color={COLORS.orange} />
            </View>
            <Text style={styles.accountLabel}>Support this project</Text>
            <Text style={styles.accountValue}>Ko-fi</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics, or
          any other publisher.
        </Text>
      </ScrollView>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    profile,
    loading: profileLoading,
    avatarUploading,
    coverUploading,
    error: uploadError,
    pickAndUploadAvatar,
    pickAndUploadCover,
    removeAvatar,
    removeCover,
    updateDisplayName,
  } = useProfile(user?.id);
  const {
    favourites,
    setFavourites,
    battle,
    contributions,
    taste,
    takes,
    setTakes,
    loading,
    settled,
    refetch,
  } = useProfileData(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const { toast, showToast } = useToast();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  }, [refetch]);

  const handleAvatarLongPress = () => {
    if (!profile?.avatar_url) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Remove Photo'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) removeAvatar();
        },
      );
    } else {
      Alert.alert('Profile Photo', 'Remove your profile photo?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove Photo', style: 'destructive', onPress: removeAvatar },
      ]);
    }
  };

  const handleCoverLongPress = () => {
    if (!profile?.cover_url) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Remove Cover'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) removeCover();
        },
      );
    } else {
      Alert.alert('Cover Photo', 'Remove your cover photo?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove Cover', style: 'destructive', onPress: removeCover },
      ]);
    }
  };

  const email = user?.email ?? '';
  const name = profile?.display_name ?? username(email);
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // "Your Universe" — taste facets + a handful of franchise/tag chips.
  const tasteChips = taste
    ? Array.from(
        new Set([...taste.franchises.map((f) => f.name), ...taste.tags.map((t) => t.label)]),
      ).slice(0, 7)
    : [];
  const tasteAlignment = taste ? dominantAlignment(taste) : null;
  const tasteTopUniverse = taste?.publishers[0]?.name
    ? shortPublisher(taste.publishers[0].name)
    : null;
  const tasteInsight = [tasteAlignment, tasteTopUniverse].filter(Boolean).join(' · ');
  const showTaste = !!taste && taste.basedOn > 0 && (!!tasteInsight || tasteChips.length > 0);
  const tasteFootnote = taste
    ? `Based on ${taste.basedOn} ${taste.basedOn === 1 ? 'character' : 'characters'} you've saved & viewed`
    : '';

  // Badges — derived from account age + favourites + matchup record + taste.
  const badges = computeBadges({
    accountCreatedAt: user?.created_at ?? null,
    favourites: favourites.length,
    votes: battle?.total ?? 0,
    streak: battle?.streak ?? 0,
    topPublisher: taste?.publishers[0]?.name ?? null,
  });
  const badgesEarned = earnedCount(badges);

  // Fan identity — stat block, tier label, and progress to the next tier.
  const tierInput = {
    saves: favourites.length,
    votes: battle?.total ?? 0,
    contributions: contributions.length,
    badges: badgesEarned,
  };
  const tier = fanTier(tierInput);
  const tierProg = tierProgress(tierInput);

  const nudge = useDonationNudge();
  useEffect(() => {
    // Gate on `settled` (all sources loaded), not `loading` (favourites only),
    // so the tier/badge snapshot is complete — a partial baseline could
    // otherwise trigger a spurious "level-up" nudge when the slow RPCs land.
    if (!settled) return;
    void nudge.syncMilestones({
      tier: tier.name,
      earnedBadgeIds: badges.filter((b) => b.earned).map((b) => b.id),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, tier.name, badges]);

  const profileStats = buildProfileStats({
    savedCount: favourites.length,
    favouritesLoading: loading,
    battle,
    badgesEarned,
  });
  const handleStatPress = (key: 'saved' | 'battles' | 'streak' | 'badges') => {
    if (key === 'battles' || key === 'streak') router.push('/versus');
  };

  // Shareable "My Universe" poster — off-screen card + share().
  const {
    hiddenCard: universeCard,
    share: shareUniverse,
    busy: sharingUniverse,
  } = useUniverseShareImage({
    displayName: name,
    avatarUri: profile?.avatar_url ?? null,
    insight: tasteInsight,
    chips: tasteChips,
    topHeroes: favourites
      .slice(0, 3)
      .map((h) => ({ name: h.name, uri: h.portrait_url ?? h.image_url ?? null })),
    savedCount: favourites.length,
    badgesEarned,
  });

  const handleShareUniverse = async () => {
    const result = await shareUniverse();
    if (result === 'error') showToast('Could not create your card');
    else if (result === 'unsupported') showToast('Sharing not available');
    else void nudge.requestNudge('share');
  };

  // Onboarding checklist — disappears once every step is complete. Hold it back
  // until both data sources have loaded; otherwise every step reads as not-done
  // during the loading window and the card flashes in then vanishes.
  const gettingStartedReady = !loading && !profileLoading;
  const gettingStartedSteps: GettingStartedStep[] = [
    {
      id: 'favourite',
      icon: 'heart-outline',
      label: 'Save your first character',
      done: favourites.length > 0,
      onPress: () => router.push('/explore'),
    },
    {
      id: 'vote',
      icon: 'flash-outline',
      label: 'Call a daily battle',
      done: (battle?.total ?? 0) > 0,
      onPress: () => router.push('/versus'),
    },
    {
      id: 'avatar',
      icon: 'camera-outline',
      label: 'Add a profile photo',
      done: !!profile?.avatar_url,
      onPress: pickAndUploadAvatar,
    },
    {
      id: 'name',
      icon: 'create-outline',
      label: 'Set your display name',
      done: !!profile?.display_name,
      onPress: () => setShowEditName(true),
    },
  ];

  const handleDeleteTake = (id: string) => {
    // Optimistic removal with rollback: deleteTake resolves false on failure,
    // in which case the take goes back where it was (list is created_at-ordered).
    const confirm = () => {
      let removed: MyTake | undefined;
      let removedAt = 0;
      setTakes((prev) => {
        removedAt = prev.findIndex((t) => t.id === id);
        removed = prev[removedAt];
        return prev.filter((t) => t.id !== id);
      });
      deleteTake(id)
        .then((ok) => {
          if (ok || !removed) return;
          const take = removed;
          setTakes((prev) => [...prev.slice(0, removedAt), take, ...prev.slice(removedAt)]);
          showToast('Could not delete take');
        })
        .catch(() => {});
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete Take'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) confirm();
        },
      );
    } else {
      Alert.alert('Delete Take', 'Delete this take? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  const handleUnfavourite = (hero: FavouriteHero) => {
    if (!user) return;
    const confirm = () => {
      // Optimistic removal WITH rollback (mirrors the takes-delete pattern) —
      // a swallowed failure left the UI and DB diverged.
      setFavourites((prev) => prev.filter((h) => h.id !== hero.id));
      showToast(`Removed ${hero.name}`);
      void queryClient.invalidateQueries({ queryKey: exploreKeys.favourites(user.id) });
      removeFavourite(user.id, hero.id).catch(() => {
        setFavourites((prev) => (prev.some((h) => h.id === hero.id) ? prev : [hero, ...prev]));
        showToast(`Couldn't remove ${hero.name} — try again`);
      });
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Remove from Favourites'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) confirm();
        },
      );
    } else {
      Alert.alert('Remove Favourite', `Remove ${hero.name} from your favourites?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  const handleUpdateName = async (newName: string) => {
    await updateDisplayName(newName);
    showToast('Display name updated');
  };

  // All hooks above run unconditionally; the guest view branches only here.
  if (!user) return <GuestProfileScreen />;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.orange}
            colors={[COLORS.orange]}
          />
        }
      >
        {/* Cover banner */}
        <TouchableOpacity
          activeOpacity={profile?.cover_url ? 0.9 : 1}
          onPress={pickAndUploadCover}
          onLongPress={handleCoverLongPress}
          disabled={coverUploading}
          style={[styles.cover, { height: 140 + insets.top }]}
        >
          {profile?.cover_url ? (
            <Image
              source={{ uri: profile.cover_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={['#293C43', '#3d5a66']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            >
              <Svg style={StyleSheet.absoluteFill} width={SCREEN_WIDTH} height={280}>
                <Defs>
                  <Pattern
                    id="dots"
                    x="0"
                    y="0"
                    width="14"
                    height="14"
                    patternUnits="userSpaceOnUse"
                  >
                    <Circle cx="7" cy="7" r="1.5" fill="rgba(231,115,51,0.22)" />
                  </Pattern>
                </Defs>
                <Rect width={SCREEN_WIDTH} height={280} fill="url(#dots)" />
              </Svg>
              <View style={styles.coverLogo}>
                <Svg width={72} height={72} viewBox="0 0 1024 1024">
                  <Path fill="#ECECDE" d={HERO_LOGO_PATH} />
                </Svg>
              </View>
            </LinearGradient>
          )}
          {coverUploading && (
            <View style={styles.coverUploadOverlay}>
              <ActivityIndicator color="white" />
            </View>
          )}
          <View style={[styles.editCoverPill, { bottom: 16 }]}>
            <Ionicons name="camera-outline" size={13} color="white" />
            <Text style={styles.editCoverText}>
              {profile?.cover_url ? 'Edit cover' : 'Add cover'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Avatar overlap */}
        <View style={styles.avatarZone}>
          <TouchableOpacity
            onPress={pickAndUploadAvatar}
            onLongPress={handleAvatarLongPress}
            disabled={avatarUploading}
            activeOpacity={0.85}
          >
            {profile?.avatar_url ? (
              <View style={styles.avatar}>
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
                {avatarUploading && (
                  <View style={styles.avatarUploadOverlay}>
                    <ActivityIndicator color="white" />
                  </View>
                )}
              </View>
            ) : (
              <LinearGradient colors={[COLORS.orange, '#c04a10']} style={styles.avatar}>
                {avatarUploading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.avatarInitials}>{name.slice(0, 2).toUpperCase()}</Text>
                )}
              </LinearGradient>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color="white" />
            </View>
          </TouchableOpacity>
        </View>

        {uploadError && (
          <View style={styles.uploadErrorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
            <Text style={styles.uploadErrorText}>{uploadError}</Text>
          </View>
        )}

        {/* Fan ID — identity, stat block, tier */}
        <View style={styles.identityBlock}>
          <TouchableOpacity
            onPress={() => setShowEditName(true)}
            activeOpacity={0.7}
            style={styles.nameRow}
          >
            <Text style={styles.username}>{name}</Text>
            <Ionicons
              name="pencil-outline"
              size={14}
              color={COLORS.grey}
              style={styles.pencilIcon}
            />
          </TouchableOpacity>
          <View style={styles.tierPill}>
            <Ionicons name={tier.icon} size={12} color={COLORS.orange} />
            <Text style={styles.tierText}>{tier.name}</Text>
          </View>
          <Text style={styles.email}>{email}</Text>
          {joinedDate && <Text style={styles.memberSince}>Member since {joinedDate}</Text>}

          <View style={styles.statStripWrap}>
            <StatStrip stats={profileStats} onPressStat={handleStatPress} />
          </View>

          {tierProg.next && (
            <View style={styles.tierProg}>
              <View style={styles.tierProgTrack}>
                <View
                  style={[styles.tierProgFill, { width: `${Math.round(tierProg.pct * 100)}%` }]}
                />
              </View>
              <Text style={styles.tierProgText}>
                {tierProg.remaining} to {tierProg.next}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleShareUniverse}
            disabled={sharingUniverse}
            style={styles.shareUniverseBtn}
            activeOpacity={0.85}
          >
            {sharingUniverse ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="share-outline" size={15} color="#fff" />
                <Text style={styles.shareUniverseText}>Share my universe</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Settings + Support */}
        <View style={styles.actionCards}>
          <TouchableOpacity
            style={styles.accountCard}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <View style={styles.accountRow}>
              <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                <Ionicons name="settings-outline" size={16} color={COLORS.navy} />
              </View>
              <Text style={styles.accountLabel}>Settings</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.accountCard} onPress={openKofi} activeOpacity={0.7}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIconBadge, styles.accountIconBadgeOrange]}>
                <Ionicons name="heart-outline" size={16} color={COLORS.orange} />
              </View>
              <Text style={styles.accountLabel}>Support this project</Text>
              <Text style={styles.accountValue}>Ko-fi</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
            </View>
          </TouchableOpacity>
        </View>

        {gettingStartedReady && <GettingStartedCard steps={gettingStartedSteps} />}

        {/* Your Universe */}
        {showTaste && (
          <SectionShell title="Your Universe" style={styles.shellGutter}>
            <View style={styles.tasteReadout}>
              {!!tasteAlignment && (
                <View style={styles.tasteFacet}>
                  <Text style={styles.tasteFacetLabel}>Leans</Text>
                  <Text style={styles.tasteFacetValue}>{tasteAlignment}</Text>
                </View>
              )}
              {!!tasteTopUniverse && (
                <View style={styles.tasteFacet}>
                  <Text style={styles.tasteFacetLabel}>Top universe</Text>
                  <Text style={styles.tasteFacetValue}>{tasteTopUniverse}</Text>
                </View>
              )}
            </View>
            {!!taste && <TasteMixBar facets={taste.publishers} />}
            {tasteChips.length > 0 && (
              <>
                <Text style={styles.tasteEyebrow}>Favourite franchises</Text>
                <View style={styles.tasteChipRow}>
                  {tasteChips.map((c) => (
                    <View key={c} style={styles.tasteChip}>
                      <Text style={styles.tasteChipText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            <Text style={styles.tasteFootnote}>{tasteFootnote}</Text>
          </SectionShell>
        )}

        {/* Collection */}
        <SectionShell
          title="Collection"
          count={!loading && favourites.length > 0 ? String(favourites.length) : undefined}
          style={styles.shellGutter}
        >
          {loading ? (
            <FavouritesSkeleton />
          ) : favourites.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="heart-outline" size={32} color={COLORS.orange} />
              </View>
              <Text style={styles.emptyTitle}>Nothing saved yet</Text>
              <Text style={styles.emptyBody}>
                Open any hero and tap the heart to build your collection
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/explore')}
                style={styles.browseBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.browseBtnText}>Browse characters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.grid}>
              {favourites.map((hero) => (
                <FavouriteThumb
                  key={hero.id}
                  hero={hero}
                  onPress={() => router.push(`/character/${hero.id}`)}
                  onLongPress={() => handleUnfavourite(hero)}
                />
              ))}
              <TouchableOpacity
                style={styles.ghostTile}
                onPress={() => router.push('/explore')}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={24} color={COLORS.orange} />
                <Text style={styles.ghostText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </SectionShell>

        {/* Badges */}
        <SectionShell
          title="Badges"
          count={`${badgesEarned}/${badges.length}`}
          style={styles.shellGutter}
        >
          <View style={styles.badgeWall}>
            {badges.map((b) => {
              const pct = b.progress
                ? Math.round(
                    (Math.min(b.progress.current, b.progress.target) / b.progress.target) * 100,
                  )
                : 0;
              return (
                <PressScale
                  key={b.id}
                  onPress={() => setSelectedBadge(b)}
                  scale={0.92}
                  style={[styles.badgeTile, !b.earned && styles.badgeTileLocked]}
                >
                  {b.earned ? (
                    <LinearGradient
                      colors={['#f2924d', '#d9591f']}
                      style={[styles.badgeIcon, styles.badgeIconEarned]}
                    >
                      <Ionicons
                        name={b.icon as keyof typeof Ionicons.glyphMap}
                        size={22}
                        color="#fff"
                      />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.badgeIcon, styles.badgeIconLocked]}>
                      <Ionicons
                        name={b.icon as keyof typeof Ionicons.glyphMap}
                        size={22}
                        color={COLORS.grey}
                      />
                    </View>
                  )}
                  <Text
                    style={[styles.badgeLabel, !b.earned && styles.badgeLabelLocked]}
                    numberOfLines={1}
                  >
                    {b.label}
                  </Text>
                  <Text style={styles.badgeSub} numberOfLines={1}>
                    {!b.earned && b.progress
                      ? `${Math.min(b.progress.current, b.progress.target)}/${b.progress.target}`
                      : b.earned
                        ? 'Earned'
                        : ''}
                  </Text>
                  {!b.earned && b.progress && (
                    <View style={styles.badgeBarTrack}>
                      <View style={[styles.badgeBarFill, { width: `${pct}%` }]} />
                    </View>
                  )}
                </PressScale>
              );
            })}
          </View>
        </SectionShell>

        {/* Contributions */}
        {contributions.length > 0 && (
          <SectionShell
            title="Contributions"
            count={String(contributions.length)}
            style={styles.shellGutter}
          >
            <ContributionsList contributions={contributions} />
          </SectionShell>
        )}

        {/* My takes + debate record */}
        {(takes.length > 0 || (battle?.total ?? 0) > 0) && (
          <SectionShell title="My takes" style={styles.shellGutter}>
            <MyTakes battle={battle} takes={takes} onDelete={handleDeleteTake} />
          </SectionShell>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics, or
          any other publisher.
        </Text>
      </ScrollView>

      <EditDisplayNameModal
        visible={showEditName}
        currentName={name}
        onClose={() => setShowEditName(false)}
        onSubmit={handleUpdateName}
      />
      <BadgeDetailModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      {universeCard}
      <Toast message={toast.message} visible={toast.visible} />
      <DonateNudge
        visible={nudge.visible}
        onConvert={nudge.onConvert}
        onDismiss={nudge.onDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  scroll: {
    paddingBottom: 100,
  },
  disclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(29,45,51,0.35)',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // Guest state
  guestHeader: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  guestTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
    marginBottom: 8,
    textAlign: 'center',
  },
  guestBody: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 21,
  },
  guestSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.navy,
  },
  benefitSub: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12.5,
    color: COLORS.grey,
    marginTop: 1,
  },
  guestActions: {
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  guestSignInBtn: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  guestSignInText: {
    fontFamily: 'Nunito_700Bold',
    color: 'white',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  guestSignUpBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: 13,
    alignItems: 'center',
    width: '100%',
  },
  guestSignUpText: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.navy,
    fontSize: 15,
    letterSpacing: 0.2,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  // Cover
  cover: {
    height: 140,
    overflow: 'hidden',
  },
  coverLogo: {
    position: 'absolute',
    bottom: -4,
    right: 8,
    opacity: 0.18,
  },
  coverUploadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCoverPill: {
    position: 'absolute',
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  editCoverText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'white',
    letterSpacing: 0.2,
  },

  // Avatar
  avatarZone: {
    alignItems: 'center',
    marginTop: -45,
    marginBottom: 12,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.beige,
    overflow: 'hidden',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarInitials: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: '#fff',
  },
  avatarUploadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.beige,
  },
  uploadErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(181,48,43,0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  uploadErrorText: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.red,
  },

  // Identity
  identityBlock: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
  },
  pencilIcon: {
    marginLeft: 6,
    marginTop: 2,
  },
  email: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    marginBottom: 2,
  },
  memberSince: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 14,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff2e8',
    borderWidth: 1,
    borderColor: '#fbdcc4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  tierText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.orange,
  },
  statStripWrap: { alignSelf: 'stretch', paddingHorizontal: 8 },
  tierProg: { alignSelf: 'stretch', alignItems: 'center', marginTop: 14, paddingHorizontal: 8 },
  tierProgTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: '#eaddcb',
    overflow: 'hidden',
  },
  tierProgFill: { height: 5, borderRadius: 3, backgroundColor: COLORS.orange },
  tierProgText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginTop: 5,
  },
  shareUniverseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 7,
    marginTop: 16,
    marginHorizontal: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.orange,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 3,
  },
  shareUniverseText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.3,
  },
  actionCards: {
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 10,
  },
  shellGutter: { marginHorizontal: 16 },
  tasteReadout: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tasteFacet: {
    flex: 1,
    backgroundColor: '#fbf3ea',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0e2d0',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tasteFacetLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 3,
  },
  tasteFacetValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 17,
    lineHeight: 22,
    color: COLORS.navy,
  },
  tasteEyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.grey,
    marginBottom: 9,
  },
  ghostTile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.25,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e3d5c1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ghostText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },
  badgeWall: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e6d8c4',
    marginTop: 5,
    overflow: 'hidden',
  },
  badgeBarFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.orange },

  // Hairline

  // Battle Record — three stat tiles on the navy card surface.

  // Your Universe (taste profile)
  tasteChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tasteChip: {
    backgroundColor: '#e8ddd0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tasteChipText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.navy },
  tasteFootnote: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    marginTop: 12,
  },

  // Badges
  // My Contributions

  badgeTile: { width: BADGE_TILE, alignItems: 'center', gap: 6 },
  badgeTileLocked: { opacity: 0.6 },
  badgeIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconEarned: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeIconLocked: {
    backgroundColor: '#efe6d8',
    borderWidth: 1.5,
    borderColor: '#d9cbb6',
  },
  badgeLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.navy,
    textAlign: 'center',
  },
  badgeLabelLocked: { color: COLORS.grey },
  badgeSub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.grey,
  },

  // Favourites
  center: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE * 1.25,
  },
  thumbName: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 6,
    fontFamily: 'Flame-Regular',
    fontSize: 11,
    color: '#fff',
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
    fontFamily: 'Flame-Regular',
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
    marginBottom: 20,
  },
  browseBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  browseBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.beige,
  },

  // Account section
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
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  accountIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconBadgeNavy: {
    backgroundColor: '#e8f0f2',
  },
  accountIconBadgeOrange: {
    backgroundColor: '#fff5ee',
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
