import { useEffect, useState } from 'react';
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
import { BadgeDetailModal } from '../../src/components/ui/BadgeDetailModal';
import {
  GettingStartedCard,
  type GettingStartedStep,
} from '../../src/components/ui/GettingStartedCard';
import { useUniverseShareImage } from '../../src/hooks/useUniverseShareImage';
import { LOGO_MASK_PATH as HERO_LOGO_PATH } from '../../src/constants/logo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { useProfileData } from '../../src/hooks/useProfileData';
import { removeFavourite, type FavouriteHero } from '../../src/lib/db/favourites';
import { dominantAlignment, shortPublisher } from '../../src/lib/db/taste';
import { computeBadges, earnedCount, type Badge } from '../../src/lib/profile/badges';
import { buildProfileStats } from '../../src/lib/profile/stats';
import { StatStrip } from '../../src/components/profile/StatStrip';
import { SectionShell } from '../../src/components/profile/SectionShell';
import { ContributionsList } from '../../src/components/profile/ContributionsList';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { useSkeletonAnim, SkeletonBlock } from '../../src/components/web/Skeleton';
import { COLORS, SURFACE } from '../../src/constants/colors';
import { Toast, useToast } from '../../src/components/ui/Toast';
import { useScreenChrome } from '../../src/hooks/useScreenChrome';
import Svg, { Path } from 'react-native-svg';

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
  // Ink chrome over a beige canvas, declared together (before the guest early-
  // return so it applies in both states). Ink — not navy — so iOS doesn't wash
  // the status bar to a light scrim; the cover banner's dark top fuses with it.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });
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
  const { favourites, setFavourites, battle, contributions, taste, loading, refetch } =
    useProfileData(user?.id);
  const [showEditName, setShowEditName] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handler = () => {
      if (!document.hidden) refetch();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [refetch]);

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

  const profileStats = buildProfileStats({
    savedCount: favourites.length,
    favouritesLoading: loading,
    battle,
    badgesEarned,
  });

  const handleStatPress = (key: 'saved' | 'battles' | 'streak' | 'crowd' | 'badges') => {
    if (key === 'battles' || key === 'streak' || key === 'crowd') router.push('/versus');
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
    else if (result === 'downloaded') showToast('Saved your universe card');
  };

  // Onboarding checklist — disappears once every step is complete. Hold it back
  // until both data sources have loaded; otherwise every step reads as not-done
  // during the loading window and the card flashes in then vanishes.
  const gettingStartedReady = !loading && !profileLoading;
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

  const handleUpdateName = async (newName: string) => {
    await updateDisplayName(newName);
    showToast('Display name updated');
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

  // All hooks above run unconditionally; the guest view branches only here.
  if (!user) return <GuestWebProfileScreen />;

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
            {joinedDate && <Text style={mob.memberSince}>Member since {joinedDate}</Text>}

            <StatStrip stats={profileStats} onPressStat={handleStatPress} />

            <Pressable
              onPress={handleShareUniverse}
              disabled={sharingUniverse}
              style={mob.shareUniverseBtn as object}
            >
              {sharingUniverse ? (
                <ActivityIndicator size="small" color={COLORS.navy} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={15} color={COLORS.navy} />
                  <Text style={mob.shareUniverseText}>Share my universe</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={mob.hairline} />

          {gettingStartedReady && <GettingStartedCard steps={gettingStartedSteps} />}

          {/* ── Your Universe ── */}
          {showTaste && (
            <SectionShell title="Your Universe" style={mob.shellGutter}>
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
            </SectionShell>
          )}

          {/* ── Collection (anchor) ── */}
          <SectionShell
            title="Collection"
            count={!loading && favourites.length > 0 ? String(favourites.length) : undefined}
            style={mob.shellGutter}
          >
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
                <Pressable
                  onPress={() => router.push('/explore')}
                  style={[mob.ghostTile, { width: thumbSize, height: thumbSize * 1.25 }]}
                >
                  <Ionicons name="add" size={24} color={COLORS.orange} />
                  <Text style={mob.ghostText}>Add</Text>
                </Pressable>
              </View>
            )}
          </SectionShell>

          {/* ── Badges ── */}
          <SectionShell
            title="Badges"
            count={`${badgesEarned}/${badges.length}`}
            style={mob.shellGutter}
          >
            <View style={mob.badgeWall}>
              {badges.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => setSelectedBadge(b)}
                  style={
                    [mob.badgeTile, mob.badgeTileBtn, !b.earned && mob.badgeTileLocked] as object
                  }
                >
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
                </Pressable>
              ))}
            </View>
          </SectionShell>

          {/* ── Contributions ── */}
          {contributions.length > 0 && (
            <SectionShell
              title="Contributions"
              count={String(contributions.length)}
              style={mob.shellGutter}
            >
              <ContributionsList contributions={contributions} />
            </SectionShell>
          )}

          <View style={mob.kofiCard}>
            <Pressable
              onPress={() => router.push('/settings')}
              style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
              }
            >
              <View style={[mob.accountIconBadge, mob.accountIconBadgeOrange]}>
                <Ionicons name="settings-outline" size={16} color={COLORS.navy} />
              </View>
              <Text style={mob.accountLabel}>Settings</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
            </Pressable>
          </View>

          <View style={mob.kofiCard}>
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
            Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics,
            or any other publisher.
          </Text>
        </View>

        <EditDisplayNameModal
          visible={showEditName}
          currentName={name}
          onClose={() => setShowEditName(false)}
          onSubmit={handleUpdateName}
        />
        <BadgeDetailModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
        {universeCard}
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
              {joinedDate && (
                <Text style={desk.memberSince as object}>Member since {joinedDate}</Text>
              )}

              <StatStrip stats={profileStats} onPressStat={handleStatPress} />

              <Pressable
                onPress={handleShareUniverse}
                disabled={sharingUniverse}
                style={desk.shareUniverseBtn as object}
              >
                {sharingUniverse ? (
                  <ActivityIndicator size="small" color={COLORS.navy} />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={15} color={COLORS.navy} />
                    <Text style={desk.shareUniverseText}>Share my universe</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Settings */}
            <View style={desk.kofiCard}>
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [desk.accountRow, hovered && (desk.accountRowHover as object)] as object
                }
              >
                <View style={[desk.accountIconBadge, desk.accountIconBadgeOrange]}>
                  <Ionicons name="settings-outline" size={16} color={COLORS.navy} />
                </View>
                <Text style={desk.accountLabel}>Settings</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
              </Pressable>
            </View>

            {/* Ko-fi footer */}
            <View style={desk.kofiCard}>
              <Pressable
                onPress={() => Linking.openURL(KO_FI_URL)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [desk.accountRow, hovered && (desk.accountRowHover as object)] as object
                }
              >
                <View style={[desk.accountIconBadge, desk.accountIconBadgeOrange]}>
                  <Ionicons name="heart-outline" size={16} color={COLORS.orange} />
                </View>
                <Text style={desk.accountLabel}>Support this project</Text>
                <Text style={desk.accountValue}>Ko-fi</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
              </Pressable>
            </View>

            <Text style={desk.disclaimer}>
              Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC
              Comics, or any other publisher.
            </Text>
          </View>

          {/* ── Main: Your Universe, Badges, Contributions, Favourites ── */}
          <View style={desk.main}>
            {gettingStartedReady && <GettingStartedCard steps={gettingStartedSteps} />}

            {showTaste && (
              <SectionShell title="Your Universe">
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
              </SectionShell>
            )}

            {/* Collection — the anchor: the fan's saved heroes, filling the width. */}
            <SectionShell
              title="Collection"
              count={!loading && favourites.length > 0 ? String(favourites.length) : undefined}
            >
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
                      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                        [desk.cardWrap, hovered && (desk.cardWrapHover as object)] as object
                      }
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
                  {/* Ghost tile — keeps a small collection from looking empty and
                      invites another save. */}
                  <Pressable
                    onPress={() => router.push('/explore')}
                    style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                      [desk.ghostTile, hovered && (desk.ghostTileHover as object)] as object
                    }
                  >
                    <Ionicons name="add" size={26} color={COLORS.orange} />
                    <Text style={desk.ghostText}>Add heroes</Text>
                  </Pressable>
                </View>
              )}
            </SectionShell>

            <SectionShell title="Badges" count={`${badgesEarned}/${badges.length}`}>
              <View style={desk.badgeWall}>
                {badges.map((b) => (
                  <Pressable
                    key={b.id}
                    onPress={() => setSelectedBadge(b)}
                    style={
                      [
                        desk.badgeTile,
                        desk.badgeTileBtn,
                        !b.earned && desk.badgeTileLocked,
                      ] as object
                    }
                  >
                    <View
                      style={[
                        desk.badgeIcon,
                        b.earned
                          ? (desk.badgeIconEarned as object)
                          : (desk.badgeIconLocked as object),
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
                  </Pressable>
                ))}
              </View>
            </SectionShell>

            {contributions.length > 0 && (
              <SectionShell title="Contributions" count={String(contributions.length)}>
                <ContributionsList contributions={contributions} />
              </SectionShell>
            )}
          </View>
        </View>
      </View>

      <EditDisplayNameModal
        visible={showEditName}
        currentName={name}
        onClose={() => setShowEditName(false)}
        onSubmit={handleUpdateName}
      />
      <BadgeDetailModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      {universeCard}
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
    marginBottom: 2,
  },
  memberSince: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: COLORS.grey,
    marginBottom: 16,
  },
  shareUniverseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8ccbb',
    backgroundColor: '#fff',
    cursor: 'pointer',
  } as object,
  shareUniverseText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    letterSpacing: 0.2,
  },

  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e8ddd0',
    marginHorizontal: 16,
    marginBottom: 20,
  },

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
  badgeWall: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeTile: { width: 80, alignItems: 'center', gap: 6 },
  badgeTileBtn: { cursor: 'pointer' } as object,
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
  shellGutter: { marginHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.navy,
    flex: 1,
  },
  sectionTitleElevated: { fontSize: 23 },
  sectionAccent: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
    marginRight: 9,
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
  ghostTile: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e3d5c1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ghostText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.orange },
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

  // Ko-fi footer (reuses the old account-row shape)
  kofiCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 4,
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
    // Pin identity + stats in view while the long right column scrolls. Clears
    // the fixed nav header at the top.
    position: 'sticky',
    top: 88,
    alignSelf: 'flex-start',
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
    marginBottom: 2,
    textAlign: 'center',
  } as object,
  memberSince: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: COLORS.grey,
    marginBottom: 14,
    textAlign: 'center',
  } as object,
  shareUniverseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8ccbb',
    backgroundColor: '#fff',
    cursor: 'pointer',
  } as object,
  shareUniverseText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    letterSpacing: 0.2,
  },

  // Settings / Ko-fi cards (reuse the old account-row shape)
  kofiCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
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
  accountIconBadgeOrange: { backgroundColor: '#fff5ee' },
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
    paddingTop: 8,
  },
  cardWrap: { borderRadius: 16, transition: 'transform 160ms ease' } as object,
  cardWrapHover: { transform: [{ translateY: -4 }] } as object,
  ghostTile: {
    alignSelf: 'stretch',
    minHeight: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e3d5c1',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    cursor: 'pointer',
    transition: 'background-color 160ms ease, border-color 160ms ease',
  } as object,
  ghostTileHover: { backgroundColor: '#fff5ee', borderColor: COLORS.orange } as object,
  ghostText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange },
  battleBlock: { marginBottom: 28, gap: 14 },
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
  contribList: { gap: 8 },
  contribRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  contribHero: { fontFamily: 'Flame-Regular', fontSize: 16, color: COLORS.navy },
  contribWhat: { fontFamily: 'Nunito_400Regular', fontSize: 13, color: COLORS.grey, marginTop: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  statusText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badgeWall: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  badgeTile: { width: 88, alignItems: 'center', gap: 7 },
  badgeTileBtn: { cursor: 'pointer' } as object,
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
  sectionHeaderElevated: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.navy,
    flex: 1,
  },
  sectionTitleElevated: { fontSize: 30 },
  sectionAccent: {
    width: 3,
    height: 22,
    borderRadius: 2,
    backgroundColor: COLORS.orange,
    marginRight: 10,
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
