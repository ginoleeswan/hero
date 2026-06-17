import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { EditDisplayNameModal } from '../../src/components/ui/EditDisplayNameModal';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { ChangePasswordModal } from '../../src/components/ui/ChangePasswordModal';
import {
  getUserFavouriteHeroes,
  removeFavourite,
  type FavouriteHero,
} from '../../src/lib/db/favourites';
import { getBattleRecord, type BattleRecord } from '../../src/lib/db/matchupVotes';
import {
  getTasteProfile,
  dominantAlignment,
  shortPublisher,
  type TasteProfile,
} from '../../src/lib/db/taste';
import { computeBadges, earnedCount } from '../../src/lib/profile/badges';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { COLORS } from '../../src/constants/colors';
import { Toast, useToast } from '../../src/components/ui/Toast';
import { useWebCanvas } from '../../src/hooks/useWebCanvas';
import { useChromeColor } from '../../src/contexts/WebChromeContext';
import Svg, { Path } from 'react-native-svg';

const HERO_LOGO_PATH =
  'M771.83 359.726C790.233 359.157 809.038 360.561 827.217 363.687C860.194 368.791 880.58 384.832 899.577 411.588C952.323 485.882 910.478 588.451 840.684 635.156C777.716 677.292 684.759 672.267 615.599 648.433C606.232 645.205 596.363 641.14 587.513 636.51C560.951 620.256 539.813 614.985 508.598 616.581C476.925 618.201 457.215 629.785 428.71 641.463C378.199 662.157 312.618 674.016 258.384 663.281C223.369 657.798 188.002 641.874 162.23 617.635C99.3027 558.45 73.5282 462.814 138.958 393.848C166.265 365.064 197.584 361.227 235.229 360.28C291.337 358.869 345.958 367.328 400.078 381.829C413.535 385.43 426.897 389.376 440.151 393.665C470.511 403.519 493.246 412.119 526.372 410.492C544.544 409.599 556.786 403.601 573.782 397.773C584.487 394.125 595.271 390.711 606.126 387.535C659.036 371.973 716.754 361.015 771.83 359.726ZM379.43 580.576C404.316 570.739 422.585 557.516 434.848 532.384C439.037 523.799 439.936 512.178 436.403 503.212C428.365 482.815 393.689 466.137 374.256 457.991C346.125 446.198 312.018 435.868 281.435 435.007C275.287 434.834 268.989 434.216 262.784 434.713C226.343 436.857 209.334 467.83 211.588 501.699C213.173 525.52 224.795 548.661 242.631 564.609C267.287 585.96 306.277 591.723 337.967 589.297C352.112 588.232 366.054 585.299 379.43 580.576ZM669.618 585.812C703.165 593.579 746.514 591.622 776.102 573.056C796.619 559.96 811.158 539.317 816.578 515.588C826.183 473.57 805.637 434.865 760.026 435.926C754.894 436.045 749.642 435.782 744.496 436.282C698.168 440.71 646.68 454.898 608.343 482.267C576.199 505.214 594.861 542.717 619.664 562.508C634.433 574.519 651.324 581.316 669.618 585.812Z';

const KO_FI_URL = 'https://ko-fi.com/glstudio';

const SIDEBAR_BREAKPOINT = 640;

/** Favourites skeleton grids while the user's saved heroes load. */
function MobileFavSkeleton({ thumbSize }: { thumbSize: number }) {
  const opacity = useSkeletonAnim();
  return (
    <View style={mob.grid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonBlock
          key={i}
          opacity={opacity}
          width={thumbSize}
          height={thumbSize * 1.25}
          borderRadius={12}
        />
      ))}
    </View>
  );
}

function DeskFavSkeleton() {
  const opacity = useSkeletonAnim();
  return (
    <View style={deskGrid as object}>
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonBlock key={i} opacity={opacity} height={240} borderRadius={12} />
      ))}
    </View>
  );
}

function username(email: string) {
  return email.split('@')[0] ?? email;
}

function GuestWebProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < SIDEBAR_BREAKPOINT;

  const inner = (
    <View style={guest.content}>
      <LinearGradient colors={[COLORS.orange, '#c04a10']} style={guest.avatar}>
        <Ionicons name="person-outline" size={isMobile ? 32 : 40} color="white" />
      </LinearGradient>
      <Text style={guest.title}>Join the Mythique community</Text>
      <Text style={guest.body}>
        Sign in to save your favourite heroes, customise your profile, and sync across devices.
      </Text>
      <Pressable
        onPress={() => router.push('/(auth)/login')}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [guest.signInBtn, hovered && (guest.signInBtnHover as object)] as object
        }
      >
        <Text style={guest.signInText}>Sign In</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/(auth)/signup')}
        style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
          [guest.signUpBtn, hovered && (guest.signUpBtnHover as object)] as object
        }
      >
        <Text style={guest.signUpText}>Create Account</Text>
      </Pressable>

      <View style={guest.kofiCard}>
        <Pressable
          onPress={() => Linking.openURL(KO_FI_URL)}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
          }
        >
          <View style={[mob.accountIconBadge, mob.accountIconBadgeOrange]}>
            <Ionicons name="heart-outline" size={16} color={COLORS.orange} />
          </View>
          <Text style={mob.accountLabel}>Support this project</Text>
          <Text style={mob.accountValue}>Ko-fi</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
        </Pressable>
      </View>

      <Text style={mob.disclaimer}>
        Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics, or
        any other publisher.
      </Text>
    </View>
  );

  if (isMobile) {
    return (
      <View style={mob.root}>
        <View style={mob.scroll}>
          <LinearGradient
            colors={['#293C43', '#3d5a66']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[mob.cover, { height: 160, cursor: 'default' } as object]}
          >
            <View style={mob.coverDots as object} />
            <View style={mob.coverLogo}>
              <Svg width={72} height={72} viewBox="0 0 1024 1024">
                <Path fill="#ECECDE" d={HERO_LOGO_PATH} />
              </Svg>
            </View>
          </LinearGradient>
          {inner}
        </View>
      </View>
    );
  }

  return (
    <View style={desk.root}>
      <LinearGradient
        colors={['#293C43', '#3d5a66']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[desk.cover, { cursor: 'default' } as object]}
      >
        <View style={desk.coverDots as object} />
        <View style={desk.coverLogo}>
          <Svg width={96} height={96} viewBox="0 0 1024 1024">
            <Path fill="#ECECDE" d={HERO_LOGO_PATH} />
          </Svg>
        </View>
      </LinearGradient>
      <View style={desk.contentOuter as object}>{inner}</View>
    </View>
  );
}

const guest = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 40,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  } as object,
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: COLORS.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 24,
    color: COLORS.navy,
    marginBottom: 12,
    textAlign: 'center',
  } as object,
  body: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 15,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 32,
  } as object,
  signInBtn: {
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    boxShadow: '0 4px 18px rgba(231,115,51,0.32)',
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  signInBtnHover: { opacity: 0.88 } as object,
  signInText: {
    fontFamily: 'Nunito_700Bold',
    color: 'white',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  signUpBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  signUpBtnHover: { opacity: 0.7 } as object,
  signUpText: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.navy,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  kofiCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default function WebProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < SIDEBAR_BREAKPOINT;
  // Document scroll so the page bleeds edge-to-edge under the iOS Safari toolbar.
  // Called before the guest early-return so it applies in both states.
  useWebCanvas(COLORS.beige);
  // The cover banner bleeds up behind the floating nav, so lock the chrome to its
  // dark top tone for a seamless top edge (matches the rest of the web app).
  useChromeColor('#293C43');
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
  const [favourites, setFavourites] = useState<FavouriteHero[]>([]);
  const [battle, setBattle] = useState<BattleRecord | null>(null);
  const [taste, setTaste] = useState<TasteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const { toast, showToast } = useToast();

  const fetchFavourites = useCallback(() => {
    if (!user) return;
    getBattleRecord()
      .then(setBattle)
      .catch(() => {});
    getTasteProfile()
      .then(setTaste)
      .catch(() => {});
    getUserFavouriteHeroes(user.id)
      .then(setFavourites)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    fetchFavourites();
  }, [fetchFavourites]);

  useEffect(() => {
    const handler = () => {
      if (!document.hidden) fetchFavourites();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchFavourites]);

  if (!user) return <GuestWebProfileScreen />;

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

  const handleAvatarRightClick = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!profile?.avatar_url) return;
    Alert.alert('Profile Photo', 'Remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove Photo', style: 'destructive', onPress: removeAvatar },
    ]);
  };

  const handleCoverRightClick = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!profile?.cover_url) return;
    Alert.alert('Cover Photo', 'Remove your cover photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove Photo', style: 'destructive', onPress: removeCover },
    ]);
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
      ).slice(0, 8)
    : [];
  const tasteInsight = taste
    ? [
        dominantAlignment(taste),
        taste.publishers[0]?.name && shortPublisher(taste.publishers[0].name),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const showTaste = !!taste && taste.basedOn > 0 && (!!tasteInsight || tasteChips.length > 0);
  const tasteFootnote = taste
    ? `Based on ${taste.basedOn} ${taste.basedOn === 1 ? 'hero' : 'heroes'} you've saved & viewed`
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

  const handleUpdateName = async (newName: string) => {
    await updateDisplayName(newName);
    showToast('Display name updated');
  };

  const handleChangePassword = async (current: string, next: string) => {
    const result = await changePassword(current, next);
    if (!result.error) showToast('Password updated');
    return result;
  };

  const handleUnfavourite = (hero: FavouriteHero) => {
    if (!user) return;
    Alert.alert('Remove Favourite', `Remove ${hero.name} from your favourites?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeFavourite(user.id, hero.id).catch(() => {});
          setFavourites((prev) => prev.filter((h) => h.id !== hero.id));
          showToast(`Removed ${hero.name}`);
        },
      },
    ]);
  };

  const thumbSize = (width - 32 - 8) / 3;

  if (isMobile) {
    return (
      <View style={mob.root}>
        <View style={mob.scroll}>
          {/* ── Cover banner ── */}
          <Pressable
            onPress={pickAndUploadCover}
            // @ts-expect-error onContextMenu is a web-only DOM event
            onContextMenu={handleCoverRightClick}
            style={mob.cover as object}
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
                <View style={mob.coverDots as object} />
                <View style={mob.coverLogo}>
                  <Svg width={72} height={72} viewBox="0 0 1024 1024">
                    <Path fill="#ECECDE" d={HERO_LOGO_PATH} />
                  </Svg>
                </View>
              </LinearGradient>
            )}
            {coverUploading && (
              <View style={mob.coverOverlay}>
                <ActivityIndicator color="white" />
              </View>
            )}
            <View style={mob.editCoverPill}>
              <Ionicons name="camera-outline" size={13} color="white" />
              <Text style={mob.editCoverText}>
                {profile?.cover_url ? 'Edit cover' : 'Add cover'}
              </Text>
            </View>
          </Pressable>

          {/* ── Avatar overlap ── */}
          <View style={mob.avatarZone}>
            <Pressable
              onPress={pickAndUploadAvatar}
              // @ts-expect-error onContextMenu is a web-only DOM event
              onContextMenu={handleAvatarRightClick}
            >
              {profile?.avatar_url ? (
                <View style={mob.avatar}>
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                  {avatarUploading && (
                    <View style={mob.avatarOverlay}>
                      <ActivityIndicator color="white" />
                    </View>
                  )}
                </View>
              ) : (
                <LinearGradient colors={[COLORS.orange, '#c04a10']} style={mob.avatar}>
                  {avatarUploading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={mob.avatarInitials}>{name.slice(0, 2).toUpperCase()}</Text>
                  )}
                </LinearGradient>
              )}
              <View style={mob.cameraBadge}>
                <Ionicons name="camera" size={13} color="white" />
              </View>
            </Pressable>
          </View>

          {/* Upload error */}
          {uploadError && (
            <View style={mob.uploadErrorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
              <Text style={mob.uploadErrorText}>{uploadError}</Text>
            </View>
          )}

          {/* ── Identity ── */}
          <View style={mob.identityBlock}>
            <Pressable onPress={() => setShowEditName(true)} style={mob.nameRow}>
              <Text style={mob.username}>{name}</Text>
              <Ionicons
                name="pencil-outline"
                size={14}
                color={COLORS.grey}
                style={mob.pencilIcon}
              />
            </Pressable>
            <Text style={mob.email}>{email}</Text>
            <View style={mob.statPill}>
              <Ionicons name="heart" size={14} color={COLORS.orange} />
              <Text style={mob.statPillText}>{loading ? '–' : favourites.length} saved heroes</Text>
            </View>
          </View>

          <View style={mob.hairline} />

          {/* ── Battle Record ── */}
          {battle && battle.total > 0 && (
            <>
              <View style={mob.section}>
                <View style={mob.sectionHeader}>
                  <Text style={mob.sectionTitle}>Battle Record</Text>
                </View>
                <View style={mob.battleRow}>
                  <View style={mob.battleTile}>
                    <Text style={mob.battleValue}>{battle.total}</Text>
                    <Text style={mob.battleLabel}>{battle.total === 1 ? 'Battle' : 'Battles'}</Text>
                  </View>
                  <View style={mob.battleTile}>
                    <Text style={mob.battleValue}>{battle.agreePct}%</Text>
                    <Text style={mob.battleLabel}>With the crowd</Text>
                  </View>
                  <View style={mob.battleTile}>
                    <Text style={mob.battleValue}>{battle.streak}</Text>
                    <Text style={mob.battleLabel}>Day streak</Text>
                  </View>
                </View>
              </View>
              <View style={mob.hairline} />
            </>
          )}

          {/* ── Your Universe ── */}
          {showTaste && (
            <>
              <View style={mob.section}>
                <View style={mob.sectionHeader}>
                  <Text style={mob.sectionTitle}>Your Universe</Text>
                </View>
                {!!tasteInsight && <Text style={mob.tasteInsight}>{tasteInsight}</Text>}
                {tasteChips.length > 0 && (
                  <View style={mob.tasteChipRow}>
                    {tasteChips.map((c) => (
                      <View key={c} style={mob.tasteChip}>
                        <Text style={mob.tasteChipText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={mob.tasteFootnote}>{tasteFootnote}</Text>
              </View>
              <View style={mob.hairline} />
            </>
          )}

          {/* ── Badges ── */}
          <View style={mob.section}>
            <View style={mob.sectionHeader}>
              <Text style={mob.sectionTitle}>Badges</Text>
              <Text style={mob.sectionCount}>
                {badgesEarned}/{badges.length}
              </Text>
            </View>
            <View style={mob.badgeWall}>
              {badges.map((b) => (
                <View key={b.id} style={[mob.badgeTile, !b.earned && (mob.badgeTileLocked as object)]}>
                  <View
                    style={[
                      mob.badgeIcon,
                      b.earned ? (mob.badgeIconEarned as object) : (mob.badgeIconLocked as object),
                    ]}
                  >
                    <Ionicons
                      name={b.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color={b.earned ? '#fff' : COLORS.grey}
                    />
                  </View>
                  <Text
                    style={[mob.badgeLabel, !b.earned && (mob.badgeLabelLocked as object)]}
                    numberOfLines={1}
                  >
                    {b.label}
                  </Text>
                  <Text style={mob.badgeSub} numberOfLines={1}>
                    {!b.earned && b.progress
                      ? `${Math.min(b.progress.current, b.progress.target)}/${b.progress.target}`
                      : b.earned
                        ? 'Earned'
                        : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={mob.hairline} />

          {/* ── My Favourites ── */}
          <View style={mob.section}>
            <View style={mob.sectionHeader}>
              <Text style={mob.sectionTitle}>My Favourites</Text>
              {!loading && favourites.length > 0 && (
                <Text style={mob.sectionCount}>{favourites.length}</Text>
              )}
            </View>
            {loading ? (
              <MobileFavSkeleton thumbSize={thumbSize} />
            ) : favourites.length === 0 ? (
              <View style={mob.emptyState}>
                <View style={mob.emptyIconWrap}>
                  <Ionicons name="heart-outline" size={32} color={COLORS.orange} />
                </View>
                <Text style={mob.emptyTitle}>Nothing saved yet</Text>
                <Text style={mob.emptyBody}>
                  Open any hero and tap the heart to build your collection
                </Text>
                <Pressable
                  onPress={() => router.push('/explore')}
                  style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                    [mob.browseBtn, hovered && (mob.browseBtnHover as object)] as object
                  }
                >
                  <Text style={mob.browseBtnText}>Browse heroes</Text>
                </Pressable>
              </View>
            ) : (
              <View style={mob.grid}>
                {favourites.map((hero) => (
                  <Pressable
                    key={hero.id}
                    onPress={() => router.push(`/character/${hero.id}`)}
                    onLongPress={() => handleUnfavourite(hero)}
                    style={[mob.thumb, { width: thumbSize, height: thumbSize * 1.25 }]}
                  >
                    <WebHeroCard
                      id={hero.id}
                      name={hero.name}
                      imageUrl={hero.image_url}
                      portraitUrl={hero.portrait_url}
                      onPress={() => router.push(`/character/${hero.id}`)}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* ── Account ── */}
          <View style={mob.accountSection}>
            <Text style={mob.accountSectionTitle}>Account</Text>
            <View style={mob.accountCard}>
              <View style={mob.accountRow}>
                <View style={[mob.accountIconBadge, mob.accountIconBadgeNavy]}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.navy} />
                </View>
                <Text style={mob.accountLabel}>Email</Text>
                <Text style={[mob.accountValue, { maxWidth: width * 0.4 }]} numberOfLines={1}>
                  {email}
                </Text>
              </View>

              {!isEmailUser && (
                <>
                  <View style={mob.divider} />
                  <View style={mob.accountRow as object}>
                    <View style={[mob.accountIconBadge, mob.accountIconBadgeNavy]}>
                      <Ionicons name="logo-google" size={16} color={COLORS.navy} />
                    </View>
                    <Text style={mob.accountLabel}>Signed in with</Text>
                    <Text style={mob.accountValue}>
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </Text>
                  </View>
                </>
              )}

              {isEmailUser && (
                <>
                  <View style={mob.divider} />
                  <Pressable
                    onPress={() => setShowChangePassword(true)}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
                    }
                  >
                    <View style={[mob.accountIconBadge, mob.accountIconBadgeNavy]}>
                      <Ionicons name="lock-closed-outline" size={16} color={COLORS.navy} />
                    </View>
                    <Text style={mob.accountLabel}>Change Password</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
                  </Pressable>
                </>
              )}

              {joinedDate && (
                <>
                  <View style={mob.divider} />
                  <View style={mob.accountRow as object}>
                    <View style={[mob.accountIconBadge, mob.accountIconBadgeNavy]}>
                      <Ionicons name="calendar-outline" size={16} color={COLORS.navy} />
                    </View>
                    <Text style={mob.accountLabel}>Member since</Text>
                    <Text style={mob.accountValue}>{joinedDate}</Text>
                  </View>
                </>
              )}

              {profile?.is_admin && (
                <>
                  <View style={mob.divider} />
                  <Pressable
                    onPress={() => router.push('/admin/health')}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
                    }
                  >
                    <View style={[mob.accountIconBadge, mob.accountIconBadgeNavy]}>
                      <Ionicons name="stats-chart-outline" size={16} color={COLORS.navy} />
                    </View>
                    <Text style={mob.accountLabel}>Catalog Health</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
                  </Pressable>
                </>
              )}

              <View style={mob.divider} />
              <Pressable
                onPress={() => Linking.openURL(KO_FI_URL)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
                }
              >
                <View style={[mob.accountIconBadge, mob.accountIconBadgeOrange]}>
                  <Ionicons name="heart-outline" size={16} color={COLORS.orange} />
                </View>
                <Text style={mob.accountLabel}>Support this project</Text>
                <Text style={mob.accountValue}>Ko-fi</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
              </Pressable>

              <View style={mob.divider} />
              <Pressable
                onPress={handleSignOut}
                disabled={signingOut}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
                }
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
                ) : (
                  <View style={[mob.accountIconBadge, mob.accountIconBadgeRed]}>
                    <Ionicons name="log-out-outline" size={16} color={COLORS.red} />
                  </View>
                )}
                <Text style={[mob.accountLabel, mob.accountLabelDanger]}>
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </Text>
              </Pressable>

              <View style={mob.divider} />
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
                }
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
                ) : (
                  <View style={[mob.accountIconBadge, mob.accountIconBadgeRed]}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                  </View>
                )}
                <Text style={[mob.accountLabel, mob.accountLabelDanger]}>
                  {deletingAccount ? 'Deleting account…' : 'Delete Account'}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={mob.disclaimer}>
            Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics,
            or any other publisher.
          </Text>
        </View>

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
        <Toast message={toast.message} visible={toast.visible} />
      </View>
    );
  }

  // ── Desktop layout ────────────────────────────────────────────────────────────
  return (
    <View style={desk.root}>
      {/* Cover — full browser width */}
      <Pressable
        onPress={pickAndUploadCover}
        // @ts-expect-error onContextMenu is a web-only DOM event
        onContextMenu={handleCoverRightClick}
        style={desk.cover as object}
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
            <View style={desk.coverDots as object} />
            <View style={desk.coverLogo}>
              <Svg width={96} height={96} viewBox="0 0 1024 1024">
                <Path fill="#ECECDE" d={HERO_LOGO_PATH} />
              </Svg>
            </View>
          </LinearGradient>
        )}
        {coverUploading && (
          <View style={desk.coverOverlay}>
            <ActivityIndicator color="white" />
          </View>
        )}
        <View style={desk.editCoverPill}>
          <Ionicons name="camera-outline" size={13} color="white" />
          <Text style={desk.editCoverText}>{profile?.cover_url ? 'Edit cover' : 'Add cover'}</Text>
        </View>
      </Pressable>

      {/* Content — max 1200px */}
      <View style={desk.contentOuter as object}>
        <View style={desk.contentRow as object}>
          {/* ── Sidebar ── */}
          <View style={desk.sidebar as object}>
            {/* Avatar floating over cover */}
            <View style={desk.avatarZone}>
              <Pressable
                onPress={pickAndUploadAvatar}
                // @ts-expect-error onContextMenu is a web-only DOM event
                onContextMenu={handleAvatarRightClick}
              >
                {profile?.avatar_url ? (
                  <View style={desk.avatar}>
                    <Image
                      source={{ uri: profile.avatar_url }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                    {avatarUploading && (
                      <View style={desk.avatarOverlay}>
                        <ActivityIndicator color="white" />
                      </View>
                    )}
                  </View>
                ) : (
                  <LinearGradient colors={[COLORS.orange, '#c04a10']} style={desk.avatar}>
                    {avatarUploading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={desk.avatarInitials}>{name.slice(0, 2).toUpperCase()}</Text>
                    )}
                  </LinearGradient>
                )}
                <View style={desk.cameraBadge}>
                  <Ionicons name="camera" size={13} color="white" />
                </View>
              </Pressable>
            </View>

            {/* Profile card */}
            <View style={desk.profileCard as object}>
              {uploadError && (
                <View style={desk.uploadErrorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.red} />
                  <Text style={desk.uploadErrorText}>{uploadError}</Text>
                </View>
              )}

              <Pressable onPress={() => setShowEditName(true)} style={desk.nameRow as object}>
                <Text style={desk.username}>{name}</Text>
                <Ionicons
                  name="pencil-outline"
                  size={14}
                  color={COLORS.grey}
                  style={desk.pencilIcon}
                />
              </Pressable>

              <Text style={desk.email as object}>{email}</Text>

              <View style={desk.statPill}>
                <Ionicons name="heart" size={14} color={COLORS.orange} />
                <Text style={desk.statPillText}>
                  {loading ? '–' : favourites.length} saved heroes
                </Text>
              </View>
            </View>

            {/* Account card */}
            <View style={desk.accountCard}>
              <View style={desk.accountRow as object}>
                <View style={[desk.accountIconBadge, desk.accountIconBadgeNavy]}>
                  <Ionicons name="mail-outline" size={16} color={COLORS.navy} />
                </View>
                <Text style={desk.accountLabel}>Email</Text>
                <Text style={desk.accountValue} numberOfLines={1}>
                  {email}
                </Text>
              </View>

              {!isEmailUser && (
                <>
                  <View style={desk.divider} />
                  <View style={desk.accountRow as object}>
                    <View style={[desk.accountIconBadge, desk.accountIconBadgeNavy]}>
                      <Ionicons name="logo-google" size={16} color={COLORS.navy} />
                    </View>
                    <Text style={desk.accountLabel}>Signed in with</Text>
                    <Text style={desk.accountValue}>
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </Text>
                  </View>
                </>
              )}

              {isEmailUser && (
                <>
                  <View style={desk.divider} />
                  <Pressable
                    onPress={() => setShowChangePassword(true)}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [desk.accountRow, hovered && (desk.accountRowHover as object)] as object
                    }
                  >
                    <View style={[desk.accountIconBadge, desk.accountIconBadgeNavy]}>
                      <Ionicons name="lock-closed-outline" size={16} color={COLORS.navy} />
                    </View>
                    <Text style={desk.accountLabel}>Change Password</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
                  </Pressable>
                </>
              )}

              {joinedDate && (
                <>
                  <View style={desk.divider} />
                  <View style={desk.accountRow as object}>
                    <View style={[desk.accountIconBadge, desk.accountIconBadgeNavy]}>
                      <Ionicons name="calendar-outline" size={16} color={COLORS.navy} />
                    </View>
                    <Text style={desk.accountLabel}>Member since</Text>
                    <Text style={desk.accountValue}>{joinedDate}</Text>
                  </View>
                </>
              )}

              {profile?.is_admin && (
                <>
                  <View style={desk.divider} />
                  <Pressable
                    onPress={() => router.push('/admin/health')}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [desk.accountRow, hovered && (desk.accountRowHover as object)] as object
                    }
                  >
                    <View style={[desk.accountIconBadge, desk.accountIconBadgeNavy]}>
                      <Ionicons name="stats-chart-outline" size={16} color={COLORS.navy} />
                    </View>
                    <Text style={desk.accountLabel}>Catalog Health</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
                  </Pressable>
                </>
              )}

              <View style={desk.divider} />
              <Pressable
                onPress={() => Linking.openURL(KO_FI_URL)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [desk.accountRow, hovered && (desk.accountRowHover as object)] as object
                }
              >
                <View style={[desk.accountIconBadge, desk.accountIconBadgeRed]}>
                  <Ionicons name="heart-outline" size={16} color={COLORS.orange} />
                </View>
                <Text style={desk.accountLabel}>Support this project</Text>
                <Text style={desk.accountValue}>Ko-fi</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
              </Pressable>

              <View style={desk.divider} />
              <Pressable
                onPress={handleSignOut}
                disabled={signingOut}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [desk.accountRow, hovered && (desk.accountRowHover as object)] as object
                }
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
                ) : (
                  <View style={[desk.accountIconBadge, desk.accountIconBadgeRed]}>
                    <Ionicons name="log-out-outline" size={16} color={COLORS.red} />
                  </View>
                )}
                <Text style={[desk.accountLabel, desk.accountLabelDanger]}>
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </Text>
              </Pressable>

              <View style={desk.divider} />
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [desk.accountRow, hovered && (desk.accountRowHover as object)] as object
                }
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
                ) : (
                  <View style={[desk.accountIconBadge, desk.accountIconBadgeRed]}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                  </View>
                )}
                <Text style={[desk.accountLabel, desk.accountLabelDanger]}>
                  {deletingAccount ? 'Deleting account…' : 'Delete Account'}
                </Text>
              </Pressable>
            </View>

            <Text style={desk.disclaimer}>
              Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC
              Comics, or any other publisher.
            </Text>
          </View>

          {/* ── Main: Battle Record + My Favourites ── */}
          <View style={desk.main}>
            {battle && battle.total > 0 && (
              <View style={desk.battleBlock}>
                <Text style={desk.sectionTitle}>Battle Record</Text>
                <View style={desk.battleRow}>
                  <View style={desk.battleTile}>
                    <Text style={desk.battleValue}>{battle.total}</Text>
                    <Text style={desk.battleLabel}>
                      {battle.total === 1 ? 'Battle' : 'Battles'}
                    </Text>
                  </View>
                  <View style={desk.battleTile}>
                    <Text style={desk.battleValue}>{battle.agreePct}%</Text>
                    <Text style={desk.battleLabel}>With the crowd</Text>
                  </View>
                  <View style={desk.battleTile}>
                    <Text style={desk.battleValue}>{battle.streak}</Text>
                    <Text style={desk.battleLabel}>Day streak</Text>
                  </View>
                </View>
              </View>
            )}
            {showTaste && (
              <View style={desk.battleBlock}>
                <Text style={desk.sectionTitle}>Your Universe</Text>
                {!!tasteInsight && <Text style={desk.tasteInsight}>{tasteInsight}</Text>}
                {tasteChips.length > 0 && (
                  <View style={desk.tasteChipRow}>
                    {tasteChips.map((c) => (
                      <View key={c} style={desk.tasteChip}>
                        <Text style={desk.tasteChipText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={desk.tasteFootnote}>{tasteFootnote}</Text>
              </View>
            )}
            <View style={desk.battleBlock}>
              <View style={desk.badgeHead}>
                <Text style={desk.sectionTitle}>Badges</Text>
                <Text style={desk.sectionCount}>
                  {badgesEarned}/{badges.length}
                </Text>
              </View>
              <View style={desk.badgeWall}>
                {badges.map((b) => (
                  <View key={b.id} style={[desk.badgeTile, !b.earned && (desk.badgeTileLocked as object)]}>
                    <View
                      style={[
                        desk.badgeIcon,
                        b.earned ? (desk.badgeIconEarned as object) : (desk.badgeIconLocked as object),
                      ]}
                    >
                      <Ionicons
                        name={b.icon as keyof typeof Ionicons.glyphMap}
                        size={24}
                        color={b.earned ? '#fff' : COLORS.grey}
                      />
                    </View>
                    <Text
                      style={[desk.badgeLabel, !b.earned && (desk.badgeLabelLocked as object)]}
                      numberOfLines={1}
                    >
                      {b.label}
                    </Text>
                    <Text style={desk.badgeSub} numberOfLines={1}>
                      {!b.earned && b.progress
                        ? `${Math.min(b.progress.current, b.progress.target)}/${b.progress.target}`
                        : b.earned
                          ? 'Earned'
                          : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={desk.sectionHeader}>
              <Text style={desk.sectionTitle}>My Favourites</Text>
              {!loading && favourites.length > 0 && (
                <Text style={desk.sectionCount}>{favourites.length}</Text>
              )}
            </View>

            {loading ? (
              <DeskFavSkeleton />
            ) : favourites.length === 0 ? (
              <View style={desk.emptyState}>
                <View style={desk.emptyIconWrap}>
                  <Ionicons name="heart-outline" size={32} color={COLORS.orange} />
                </View>
                <Text style={desk.emptyTitle}>Nothing saved yet</Text>
                <Text style={desk.emptyBody}>
                  Open any hero and tap the heart to build your collection
                </Text>
                <Pressable
                  onPress={() => router.push('/explore')}
                  style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                    [desk.browseBtn, hovered && (desk.browseBtnHover as object)] as object
                  }
                >
                  <Text style={desk.browseBtnText}>Browse heroes</Text>
                </Pressable>
              </View>
            ) : (
              <View style={deskGrid as object}>
                {favourites.map((hero) => (
                  <Pressable
                    key={hero.id}
                    onPress={() => router.push(`/character/${hero.id}`)}
                    onLongPress={() => handleUnfavourite(hero)}
                  >
                    <WebHeroCard
                      id={hero.id}
                      name={hero.name}
                      imageUrl={hero.image_url}
                      portraitUrl={hero.portrait_url}
                      onPress={() => router.push(`/character/${hero.id}`)}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

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
      <Toast message={toast.message} visible={toast.visible} />
    </View>
  );
}

// ── Mobile-only styles (native parity) ───────────────────────────────────────
const mob = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { paddingBottom: 0 },

  // Cover
  cover: {
    height: 160,
    overflow: 'hidden',
    cursor: 'pointer',
  } as object,
  coverDots: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'radial-gradient(circle, rgba(231,115,51,0.22) 1.5px, transparent 1.5px)',
    backgroundSize: '14px 14px',
  } as object,
  coverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLogo: {
    position: 'absolute',
    bottom: -4,
    right: 8,
    opacity: 0.18,
  },
  editCoverPill: {
    position: 'absolute',
    bottom: 44,
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
  avatarInitials: { fontFamily: 'Flame-Regular', fontSize: 28, color: '#fff' },
  avatarOverlay: {
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
    cursor: 'pointer',
  } as object,
  username: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.navy },
  pencilIcon: { marginLeft: 6, marginTop: 2 },
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
    outlineStyle: 'none',
  } as object,
  nameAction: { padding: 6 },
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

  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e8ddd0',
    marginHorizontal: 16,
    marginBottom: 20,
  },

  // Battle Record
  battleRow: { flexDirection: 'row', gap: 10 },
  battleTile: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 3,
  } as object,
  battleValue: { fontFamily: 'Flame-Regular', fontSize: 26, color: COLORS.beige, lineHeight: 28 },
  battleLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
  } as object,

  // Your Universe
  tasteInsight: { fontFamily: 'Flame-Regular', fontSize: 18, color: COLORS.navy, marginBottom: 12 },
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
  badgeWall: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeTile: { width: 80, alignItems: 'center', gap: 6 },
  badgeTileLocked: { opacity: 0.55 } as object,
  badgeIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconEarned: { backgroundColor: COLORS.orange } as object,
  badgeIconLocked: { backgroundColor: '#e8ddd0' } as object,
  badgeLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: COLORS.navy,
    textAlign: 'center',
  } as object,
  badgeLabelLocked: { color: COLORS.grey } as object,
  badgeSub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.grey,
  } as object,

  // Favourites
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  thumb: { overflow: 'hidden' },
  center: { paddingVertical: 32, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
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
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  browseBtnHover: { opacity: 0.8 } as object,
  browseBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.beige,
  },

  // Account
  accountSection: { paddingHorizontal: 16, marginBottom: 8 },
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
    paddingVertical: 13,
    gap: 12,
    cursor: 'pointer',
  } as object,
  accountRowHover: { backgroundColor: 'rgba(41,60,67,0.04)' } as object,
  accountIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconBadgeNavy: { backgroundColor: '#e8f0f2' },
  accountIconBadgeRed: { backgroundColor: '#fde8e8' },
  accountIconBadgeOrange: { backgroundColor: '#fff5ee' },
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
  },
  accountLabelDanger: { color: COLORS.red },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ede5d8',
    marginHorizontal: 16,
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
});

// ── Desktop-only styles ───────────────────────────────────────────────────────
const desk = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },

  // Cover
  cover: {
    height: 220,
    overflow: 'hidden',
    cursor: 'pointer',
  } as object,
  coverDots: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: 'radial-gradient(circle, rgba(231,115,51,0.22) 1.5px, transparent 1.5px)',
    backgroundSize: '14px 14px',
  } as object,
  coverLogo: {
    position: 'absolute',
    bottom: -4,
    right: 16,
    opacity: 0.18,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCoverPill: {
    position: 'absolute',
    bottom: 16,
    left: 20,
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

  // Content layout
  contentOuter: {
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 32,
  } as object,
  contentRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
    paddingBottom: 60,
  } as object,

  // Sidebar
  sidebar: {
    width: 280,
    flexShrink: 0,
    marginTop: -60,
    zIndex: 10,
  } as object,
  avatarZone: {
    alignItems: 'center',
    zIndex: 2,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.beige,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarInitials: { fontFamily: 'Flame-Regular', fontSize: 34, color: '#fff' },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.beige,
  },

  // Profile card (name / email / stat pill)
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginTop: -50,
    paddingTop: 62,
    paddingHorizontal: 16,
    paddingBottom: 20,
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
  } as object,
  uploadErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(181,48,43,0.08)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.red,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    alignSelf: 'stretch',
  },
  uploadErrorText: {
    flex: 1,
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.red,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    cursor: 'pointer',
  } as object,
  username: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy },
  pencilIcon: { marginLeft: 6, marginTop: 2 },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
    gap: 4,
  } as object,
  nameInput: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.navy,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.orange,
    paddingVertical: 2,
    paddingHorizontal: 4,
    outlineStyle: 'none',
  } as object,
  nameAction: { padding: 6 },
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
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 14,
    textAlign: 'center',
  } as object,
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

  // Account card
  accountCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    cursor: 'pointer',
  } as object,
  accountRowHover: { backgroundColor: 'rgba(41,60,67,0.04)' } as object,
  accountIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconBadgeNavy: { backgroundColor: '#e8f0f2' },
  accountIconBadgeRed: { backgroundColor: '#fde8e8' },
  accountLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.navy,
    flex: 1,
  },
  accountValue: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    maxWidth: 140,
  },
  accountLabelDanger: { color: COLORS.red },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ede5d8',
    marginHorizontal: 16,
  },
  disclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 10,
    color: 'rgba(29,45,51,0.35)',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 4,
  },

  // Main panel
  main: {
    flex: 1,
    paddingTop: 24,
  },
  // Battle Record
  battleBlock: { marginBottom: 28, gap: 14 },
  battleRow: { flexDirection: 'row', gap: 12 },
  battleTile: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 4,
  } as object,
  battleValue: { fontFamily: 'Flame-Regular', fontSize: 34, color: COLORS.beige, lineHeight: 36 },
  battleLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.55)',
  } as object,
  // Your Universe
  tasteInsight: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy, marginBottom: 4 },
  tasteChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tasteChip: {
    backgroundColor: '#e8ddd0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tasteChipText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  tasteFootnote: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey },
  // Badges
  badgeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badgeWall: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  badgeTile: { width: 88, alignItems: 'center', gap: 7 },
  badgeTileLocked: { opacity: 0.55 } as object,
  badgeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconEarned: { backgroundColor: COLORS.orange } as object,
  badgeIconLocked: { backgroundColor: '#e8ddd0' } as object,
  badgeLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    textAlign: 'center',
  } as object,
  badgeLabelLocked: { color: COLORS.grey } as object,
  badgeSub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.grey,
  } as object,
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
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
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff5ee',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 14,
    color: COLORS.grey,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  browseBtn: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  browseBtnHover: { opacity: 0.8 } as object,
  browseBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.beige,
  },
});

const deskGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 14,
};
