import { useCallback, useState } from 'react';
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
  Linking,
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { useProfileData } from '../../src/hooks/useProfileData';
import { ChangePasswordModal } from '../../src/components/ui/ChangePasswordModal';
import { EditDisplayNameModal } from '../../src/components/ui/EditDisplayNameModal';
import { BadgeDetailModal } from '../../src/components/ui/BadgeDetailModal';
import {
  GettingStartedCard,
  type GettingStartedStep,
} from '../../src/components/ui/GettingStartedCard';
import { removeFavourite, type FavouriteHero } from '../../src/lib/db/favourites';
import { describeContribution, type MyContribution } from '../../src/lib/db/contributions';
import { dominantAlignment, shortPublisher } from '../../src/lib/db/taste';
import { computeBadges, earnedCount, type Badge } from '../../src/lib/profile/badges';
import { providerMeta } from '../../src/lib/profile/provider';
import { HeroImage } from '../../src/components/HeroImage';
import { COLORS } from '../../src/constants/colors';
import { Toast, useToast } from '../../src/components/ui/Toast';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 32 - 8) / 3;

const KO_FI_URL = 'https://ko-fi.com/glstudio';

function username(email: string) {
  return email.split('@')[0] ?? email;
}

// ── My Contributions presentation ───────────────────────────────────────────
const STATUS_BG: Record<MyContribution['status'], string> = {
  pending: 'rgba(231,115,51,0.14)',
  approved: 'rgba(99,169,54,0.16)',
  rejected: '#e8ddd0',
  superseded: '#e8ddd0',
};
const STATUS_FG: Record<MyContribution['status'], string> = {
  pending: COLORS.orange,
  approved: COLORS.green,
  rejected: COLORS.grey,
  superseded: COLORS.grey,
};

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
    sub: 'Build a personal collection of heroes',
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
            onPress={() => router.push('/(auth)/login')}
            style={styles.guestSignUpBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.guestSignUpText}>I already have an account</Text>
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.guestSection}>
          <TouchableOpacity
            style={styles.supportRow}
            onPress={() => Linking.openURL(KO_FI_URL)}
            activeOpacity={0.7}
          >
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
  const { user, signOut, changePassword, deleteAccount } = useAuth();
  const {
    profile,
    avatarUploading,
    coverUploading,
    error: uploadError,
    pickAndUploadAvatar,
    pickAndUploadCover,
    removeAvatar,
    removeCover,
    updateDisplayName,
  } = useProfile(user?.id);
  const { favourites, setFavourites, battle, contributions, taste, loading, refetch } =
    useProfileData(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
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

  if (!user) return <GuestProfileScreen />;

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.replace('/explore');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            const { error } = await deleteAccount();
            if (error) {
              setDeletingAccount(false);
              Alert.alert('Error', error.message);
            }
          },
        },
      ],
    );
  };

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
  const provider = user?.app_metadata?.provider ?? 'email';
  const isEmailUser = provider === 'email' || !user?.app_metadata?.provider;
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // "Your Universe" — a one-line lean + a handful of franchise/tag chips.
  const tasteChips = taste
    ? Array.from(
        new Set([...taste.franchises.map((f) => f.name), ...taste.tags.map((t) => t.label)]),
      ).slice(0, 7)
    : [];
  const tasteInsight = taste
    ? [
        dominantAlignment(taste),
        taste.publishers[0]?.name && shortPublisher(taste.publishers[0].name),
      ]
        .filter(Boolean)
        .join(' · ')
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

  // Onboarding checklist — disappears once every step is complete.
  const gettingStartedSteps: GettingStartedStep[] = [
    {
      id: 'favourite',
      icon: 'heart-outline',
      label: 'Save your first hero',
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

  const handleUnfavourite = (hero: FavouriteHero) => {
    if (!user) return;
    const confirm = () => {
      removeFavourite(user.id, hero.id).catch(() => {});
      setFavourites((prev) => prev.filter((h) => h.id !== hero.id));
      showToast(`Removed ${hero.name}`);
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

  const handleChangePassword = async (current: string, next: string) => {
    const result = await changePassword(current, next);
    if (!result.error) showToast('Password updated');
    return result;
  };

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

        {/* Identity */}
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
          <Text style={styles.email}>{email}</Text>
          <View style={styles.statPill}>
            <Ionicons name="heart" size={14} color={COLORS.orange} />
            <Text style={styles.statPillText}>
              {loading ? '–' : favourites.length} saved heroes
            </Text>
          </View>
        </View>

        <View style={styles.hairline} />

        <GettingStartedCard steps={gettingStartedSteps} />

        {/* Battle Record — surfaces the user's matchup votes (Today's Battle). */}
        {battle && battle.total > 0 && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Battle Record</Text>
              </View>
              <View style={styles.battleRow}>
                <View style={styles.battleTile}>
                  <Text style={styles.battleValue}>{battle.total}</Text>
                  <Text style={styles.battleLabel}>
                    {battle.total === 1 ? 'Battle' : 'Battles'}
                  </Text>
                </View>
                <View style={styles.battleTile}>
                  <Text style={styles.battleValue}>{battle.agreePct}%</Text>
                  <Text style={styles.battleLabel}>With the crowd</Text>
                </View>
                <View style={styles.battleTile}>
                  <Text style={styles.battleValue}>{battle.streak}</Text>
                  <Text style={styles.battleLabel}>Day streak</Text>
                </View>
              </View>
            </View>
            <View style={styles.hairline} />
          </>
        )}

        {/* Your Universe — taste profile from favourites + view history. */}
        {taste && taste.basedOn > 0 && (!!tasteInsight || tasteChips.length > 0) && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Universe</Text>
              </View>
              {!!tasteInsight && <Text style={styles.tasteInsight}>{tasteInsight}</Text>}
              {tasteChips.length > 0 && (
                <View style={styles.tasteChipRow}>
                  {tasteChips.map((c) => (
                    <View key={c} style={styles.tasteChip}>
                      <Text style={styles.tasteChipText}>{c}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.tasteFootnote}>
                {`Based on ${taste.basedOn} ${taste.basedOn === 1 ? 'hero' : 'heroes'} you've saved & viewed`}
              </Text>
            </View>
            <View style={styles.hairline} />
          </>
        )}

        {/* Badges — derived achievements (account age, favourites, votes, taste). */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <Text style={styles.sectionCount}>
              {badgesEarned}/{badges.length}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgeRow}
          >
            {badges.map((b) => (
              <PressScale
                key={b.id}
                onPress={() => setSelectedBadge(b)}
                scale={0.92}
                style={[styles.badgeTile, !b.earned && styles.badgeTileLocked]}
              >
                <View
                  style={[
                    styles.badgeIcon,
                    b.earned ? styles.badgeIconEarned : styles.badgeIconLocked,
                  ]}
                >
                  <Ionicons
                    name={b.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={b.earned ? '#fff' : COLORS.grey}
                  />
                </View>
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
              </PressScale>
            ))}
          </ScrollView>
        </View>

        <View style={styles.hairline} />

        {/* My Contributions — submissions + their review status. */}
        {contributions.length > 0 && (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My Contributions</Text>
                <Text style={styles.sectionCount}>{contributions.length}</Text>
              </View>
              <View style={styles.contribList}>
                {contributions.slice(0, 12).map((c) => (
                  <View key={c.id} style={styles.contribRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contribHero} numberOfLines={1}>
                        {c.hero_name}
                      </Text>
                      <Text style={styles.contribWhat} numberOfLines={1}>
                        {describeContribution(c)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: STATUS_BG[c.status] }]}>
                      <Text style={[styles.statusText, { color: STATUS_FG[c.status] }]}>
                        {c.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.hairline} />
          </>
        )}

        {/* My Favourites */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Favourites</Text>
            {!loading && favourites.length > 0 && (
              <Text style={styles.sectionCount}>{favourites.length}</Text>
            )}
          </View>

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
                <Text style={styles.browseBtnText}>Browse heroes</Text>
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
            </View>
          )}
        </View>

        {/* Account section */}
        <View style={styles.accountSection}>
          <Text style={styles.accountSectionTitle}>Account</Text>

          <View style={styles.accountCard}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                <Ionicons name="mail-outline" size={16} color={COLORS.navy} />
              </View>
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue} numberOfLines={1}>
                {email}
              </Text>
            </View>

            {!isEmailUser && (
              <>
                <View style={styles.divider} />
                <View style={styles.accountRow}>
                  <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                    <Ionicons name={providerMeta(provider).icon} size={16} color={COLORS.navy} />
                  </View>
                  <Text style={styles.accountLabel}>Signed in with</Text>
                  <Text style={styles.accountValue}>{providerMeta(provider).label}</Text>
                </View>
              </>
            )}

            {isEmailUser && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.accountRow}
                  onPress={() => setShowChangePassword(true)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                    <Ionicons name="lock-closed-outline" size={16} color={COLORS.navy} />
                  </View>
                  <Text style={styles.accountLabel}>Change Password</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
                </TouchableOpacity>
              </>
            )}

            {joinedDate && (
              <>
                <View style={styles.divider} />
                <View style={styles.accountRow}>
                  <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.navy} />
                  </View>
                  <Text style={styles.accountLabel}>Member since</Text>
                  <Text style={styles.accountValue}>{joinedDate}</Text>
                </View>
              </>
            )}

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.accountRow}
              onPress={() => Linking.openURL(KO_FI_URL)}
              activeOpacity={0.7}
            >
              <View style={[styles.accountIconBadge, styles.accountIconBadgeOrange]}>
                <Ionicons name="heart-outline" size={16} color={COLORS.orange} />
              </View>
              <Text style={styles.accountLabel}>Support this project</Text>
              <Text style={styles.accountValue}>Ko-fi</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.accountRow}
              onPress={handleSignOut}
              disabled={signingOut}
              activeOpacity={0.7}
            >
              {signingOut ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.red}
                  style={styles.signingOutIndicator}
                />
              ) : (
                <View style={[styles.accountIconBadge, styles.accountIconBadgeRed]}>
                  <Ionicons name="log-out-outline" size={16} color={COLORS.red} />
                </View>
              )}
              <Text style={[styles.accountLabel, styles.accountLabelDanger]}>
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.accountRow}
              onPress={handleDeleteAccount}
              disabled={deletingAccount}
              activeOpacity={0.7}
            >
              {deletingAccount ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.red}
                  style={styles.signingOutIndicator}
                />
              ) : (
                <View style={[styles.accountIconBadge, styles.accountIconBadgeRed]}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                </View>
              )}
              <Text style={[styles.accountLabel, styles.accountLabelDanger]}>
                {deletingAccount ? 'Deleting account…' : 'Delete Account'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics, or
          any other publisher.
        </Text>
      </ScrollView>

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={handleChangePassword}
      />
      <EditDisplayNameModal
        visible={showEditName}
        currentName={name}
        onClose={() => setShowEditName(false)}
        onSubmit={handleUpdateName}
      />
      <BadgeDetailModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      <Toast message={toast.message} visible={toast.visible} />
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
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 4,
    gap: 4,
  },
  nameInput: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.orange,
    paddingVertical: 2,
    paddingHorizontal: 4,
    maxWidth: SCREEN_WIDTH * 0.65,
  },
  nameAction: {
    padding: 6,
  },
  nameCharCount: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(41,60,67,0.35)',
    alignSelf: 'stretch',
    textAlign: 'right',
    marginTop: 2,
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

  // Hairline
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e8ddd0',
    marginHorizontal: 16,
    marginBottom: 20,
  },

  // Battle Record — three stat tiles on the navy card surface.
  battleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  battleTile: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 16,
    alignItems: 'center',
    gap: 3,
  },
  battleValue: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.beige,
    lineHeight: 28,
  },
  battleLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
  },

  // Your Universe (taste profile)
  tasteInsight: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
    marginBottom: 12,
  },
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
  contribList: { gap: 8 },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contribHero: { fontFamily: 'Flame-Regular', fontSize: 15, color: COLORS.navy },
  contribWhat: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, marginTop: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  badgeRow: { gap: 10, paddingRight: 16 },
  badgeTile: { width: 92, alignItems: 'center', gap: 6 },
  badgeTileLocked: { opacity: 0.55 },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconEarned: { backgroundColor: COLORS.orange },
  badgeIconLocked: { backgroundColor: '#e8ddd0' },
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
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
  },
  thumbName: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 6,
    fontFamily: 'Flame-Regular',
    fontSize: 10,
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
  accountSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  accountSectionTitle: {
    fontFamily: 'Flame-Regular',
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
  accountIconBadgeRed: {
    backgroundColor: '#fde8e8',
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
  signingOutIndicator: {
    marginRight: 10,
  },
  accountLabelDanger: {
    color: COLORS.red,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ede5d8',
    marginHorizontal: 16,
  },
});
