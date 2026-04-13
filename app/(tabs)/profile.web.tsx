import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { ChangePasswordModal } from '../../src/components/ui/ChangePasswordModal';
import { getUserFavouriteHeroes, type FavouriteHero } from '../../src/lib/db/favourites';
import { WebHeroCard } from '../../src/components/web/WebHeroCard';
import { COLORS } from '../../src/constants/colors';

const SIDEBAR_BREAKPOINT = 640;

function username(email: string) {
  return email.split('@')[0] ?? email;
}

export default function WebProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < SIDEBAR_BREAKPOINT;
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
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<TextInput>(null);

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

  const startEditingName = () => {
    setNameValue(profile?.display_name ?? username(email));
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    await updateDisplayName(trimmed);
    setSavingName(false);
    setEditingName(false);
  };

  const email = user?.email ?? '';
  const name = profile?.display_name ?? username(email);
  const isEmailUser = user?.app_metadata?.provider === 'email' || !user?.app_metadata?.provider;

  const profilePanel = (
    <View style={[styles.panel, isMobile && styles.panelMobile]}>
      {/* Avatar */}
      <Pressable
        onPress={pickAndUploadAvatar}
        onContextMenu={handleAvatarRightClick as unknown as () => void}
        style={[styles.avatarWrap, isMobile && styles.avatarWrapMobile]}
      >
        {profile?.avatar_url ? (
          <View style={[styles.avatar, isMobile && styles.avatarMobile]}>
            <Image
              source={{ uri: profile.avatar_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {avatarUploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="white" size="small" />
              </View>
            )}
          </View>
        ) : (
          <LinearGradient
            colors={[COLORS.orange, '#c04a10']}
            style={[styles.avatar, isMobile && styles.avatarMobile]}
          >
            {avatarUploading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={[styles.avatarText, isMobile && styles.avatarTextMobile]}>
                {name.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </LinearGradient>
        )}
        <View style={[styles.cameraBadge, isMobile && styles.cameraBadgeMobile]}>
          <Ionicons name="camera" size={isMobile ? 13 : 11} color="white" />
        </View>
      </Pressable>

      {uploadError && <Text style={styles.uploadError}>{uploadError}</Text>}

      {/* Display name */}
      {editingName ? (
        <View style={[styles.nameEditRow, isMobile && styles.nameEditRowMobile]}>
          <TextInput
            ref={nameInputRef}
            style={[styles.nameInput, isMobile && styles.nameInputMobile]}
            value={nameValue}
            onChangeText={setNameValue}
            returnKeyType="done"
            onSubmitEditing={handleSaveName}
            autoCapitalize="words"
            maxLength={40}
          />
          <Pressable onPress={handleSaveName} disabled={savingName} style={styles.nameBtn}>
            {savingName ? (
              <ActivityIndicator size="small" color={isMobile ? COLORS.orange : COLORS.orange} />
            ) : (
              <Ionicons name="checkmark" size={16} color={COLORS.orange} />
            )}
          </Pressable>
          <Pressable onPress={() => setEditingName(false)} style={styles.nameBtn}>
            <Ionicons
              name="close"
              size={16}
              color={isMobile ? COLORS.grey : 'rgba(245,235,220,0.5)'}
            />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={startEditingName}
          style={[styles.nameRow, isMobile && styles.nameRowMobile]}
        >
          <Text style={[styles.username, isMobile && styles.usernameMobile]}>{name}</Text>
          <Ionicons
            name="pencil-outline"
            size={12}
            color={isMobile ? COLORS.grey : 'rgba(245,235,220,0.4)'}
            style={styles.pencil}
          />
        </Pressable>
      )}

      <Text style={[styles.email, isMobile && styles.emailMobile]}>{email}</Text>

      <View style={[styles.panelDivider, isMobile && styles.panelDividerMobile]} />

      <View style={[styles.statRow, isMobile && styles.statRowMobile]}>
        <Text style={[styles.statLabel, isMobile && styles.statLabelMobile]}>Favourites</Text>
        <Text style={[styles.statValue, isMobile && styles.statValueMobile]}>
          {favourites.length}
        </Text>
      </View>

      <View style={[styles.panelDivider, isMobile && styles.panelDividerMobile]} />

      {isEmailUser && (
        <Pressable
          onPress={() => setShowChangePassword(true)}
          style={[styles.actionRow, isMobile && styles.actionRowMobile]}
        >
          <Ionicons name="lock-closed-outline" size={14} color="rgba(245,235,220,0.55)" />
          <Text style={[styles.actionText, isMobile && styles.actionTextMobile]}>
            Change Password
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={handleSignOut}
        disabled={signingOut}
        style={[styles.actionRow, isMobile && styles.actionRowMobile]}
      >
        <Ionicons name="log-out-outline" size={14} color={COLORS.orange} />
        <Text style={[styles.actionText, styles.actionTextOrange]}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleDeleteAccount}
        disabled={deletingAccount}
        style={[styles.actionRow, isMobile && styles.actionRowMobile]}
      >
        <Ionicons name="trash-outline" size={14} color="rgba(181,48,43,0.8)" />
        <Text style={[styles.actionText, styles.actionTextRed]}>
          {deletingAccount ? 'Deleting…' : 'Delete Account'}
        </Text>
      </Pressable>
    </View>
  );

  const thumbSize = (width - 32 - 8) / 3;

  if (isMobile) {
    return (
      <View style={mob.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={mob.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Cover banner ── */}
          <Pressable
            onPress={pickAndUploadCover}
            onContextMenu={handleCoverRightClick as unknown as () => void}
            style={mob.cover as object}
          >
            {profile?.cover_url ? (
              <Image source={{ uri: profile.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <LinearGradient
                colors={['#293C43', '#3d5a66']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              >
                <View style={mob.coverDots as object} />
              </LinearGradient>
            )}
            {coverUploading && (
              <View style={mob.coverOverlay}>
                <ActivityIndicator color="white" />
              </View>
            )}
            <View style={mob.editCoverPill}>
              <Ionicons name="camera-outline" size={13} color="white" />
              <Text style={mob.editCoverText}>{profile?.cover_url ? 'Edit cover' : 'Add cover'}</Text>
            </View>
          </Pressable>

          {/* ── Avatar overlap ── */}
          <View style={mob.avatarZone}>
            <Pressable
              onPress={pickAndUploadAvatar}
              onContextMenu={handleAvatarRightClick as unknown as () => void}
            >
              {profile?.avatar_url ? (
                <View style={mob.avatar}>
                  <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {avatarUploading && (
                    <View style={mob.avatarOverlay}>
                      <ActivityIndicator color="white" />
                    </View>
                  )}
                </View>
              ) : (
                <LinearGradient colors={[COLORS.orange, '#c04a10']} style={mob.avatar}>
                  {avatarUploading
                    ? <ActivityIndicator color="white" />
                    : <Text style={mob.avatarInitials}>{name.slice(0, 2).toUpperCase()}</Text>
                  }
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
            {editingName ? (
              <View style={mob.nameEditRow}>
                <TextInput
                  ref={nameInputRef}
                  style={mob.nameInput as object}
                  value={nameValue}
                  onChangeText={setNameValue}
                  returnKeyType="done"
                  onSubmitEditing={handleSaveName}
                  autoCapitalize="words"
                  maxLength={40}
                />
                <Pressable onPress={handleSaveName} disabled={savingName} style={mob.nameAction}>
                  {savingName
                    ? <ActivityIndicator size="small" color={COLORS.orange} />
                    : <Ionicons name="checkmark" size={20} color={COLORS.orange} />
                  }
                </Pressable>
                <Pressable onPress={() => { setEditingName(false); setNameValue(''); }} style={mob.nameAction}>
                  <Ionicons name="close" size={20} color={COLORS.grey} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startEditingName} style={mob.nameRow}>
                <Text style={mob.username}>{name}</Text>
                <Ionicons name="pencil-outline" size={14} color={COLORS.grey} style={mob.pencilIcon} />
              </Pressable>
            )}
            <Text style={mob.email}>{email}</Text>
            <View style={mob.statPill}>
              <Ionicons name="heart" size={14} color={COLORS.orange} />
              <Text style={mob.statPillText}>
                {loading ? '–' : favourites.length} saved heroes
              </Text>
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
              <View style={mob.center}>
                <ActivityIndicator color={COLORS.orange} />
              </View>
            ) : favourites.length === 0 ? (
              <View style={mob.emptyState}>
                <View style={mob.emptyIconWrap}>
                  <Ionicons name="heart-outline" size={32} color={COLORS.orange} />
                </View>
                <Text style={mob.emptyTitle}>Nothing saved yet</Text>
                <Text style={mob.emptyBody}>
                  Open any hero and tap the heart to build your collection
                </Text>
              </View>
            ) : (
              <View style={mob.grid}>
                {favourites.map((hero) => (
                  <Pressable
                    key={hero.id}
                    onPress={() => router.push(`/character/${hero.id}`)}
                    style={[mob.thumb, { width: thumbSize, height: thumbSize * 1.25 }]}
                  >
                    <WebHeroCard
                      id={hero.id}
                      name={hero.name}
                      imageUrl={hero.image_url}
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

              {isEmailUser && (
                <>
                  <View style={mob.divider} />
                  <Pressable
                    onPress={() => setShowChangePassword(true)}
                    style={({ hovered }: { hovered?: boolean }) =>
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

              <View style={mob.divider} />
              <Pressable
                onPress={handleSignOut}
                disabled={signingOut}
                style={({ hovered }: { hovered?: boolean }) =>
                  [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
                }
              >
                {signingOut
                  ? <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
                  : <View style={[mob.accountIconBadge, mob.accountIconBadgeRed]}>
                      <Ionicons name="log-out-outline" size={16} color={COLORS.red} />
                    </View>
                }
                <Text style={[mob.accountLabel, mob.accountLabelDanger]}>
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </Text>
              </Pressable>

              <View style={mob.divider} />
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
                style={({ hovered }: { hovered?: boolean }) =>
                  [mob.accountRow, hovered && (mob.accountRowHover as object)] as object
                }
              >
                {deletingAccount
                  ? <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
                  : <View style={[mob.accountIconBadge, mob.accountIconBadgeRed]}>
                      <Ionicons name="trash-outline" size={16} color={COLORS.red} />
                    </View>
                }
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
        </ScrollView>

        <ChangePasswordModal
          visible={showChangePassword}
          onClose={() => setShowChangePassword(false)}
          onSubmit={changePassword}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, styles.rootDesktop]}>
      {profilePanel}

      <View style={styles.rightPanel}>
        <Text style={styles.rightTitle}>Favourites</Text>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.orange} />
          </View>
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

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={changePassword}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  rootDesktop: { flexDirection: 'row' },

  // Mobile scroll
  mobileScroll: { paddingBottom: 80 },
  mobileContentSection: { padding: 16 },
  mobileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
    gap: 12,
  },

  // Sidebar panel (desktop: dark navy column; mobile: beige header block)
  panel: {
    width: 260,
    backgroundColor: COLORS.navy,
    padding: 24,
    alignItems: 'flex-start',
  },
  panelMobile: {
    width: undefined,
    backgroundColor: COLORS.navy,
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  avatarWrap: { marginBottom: 14, position: 'relative' },
  avatarWrapMobile: { marginBottom: 12 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarMobile: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.navy,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Flame-Regular',
    fontSize: 28,
    color: 'white',
  },
  avatarTextMobile: { fontSize: 32 },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.navy,
  },
  cameraBadgeMobile: { width: 24, height: 24, borderRadius: 12 },
  uploadError: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: '#f87171',
    marginBottom: 8,
    alignSelf: 'stretch',
    textAlign: 'center',
  },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nameRowMobile: { justifyContent: 'center' },
  username: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
  },
  usernameMobile: { fontSize: 22 },
  pencil: { marginTop: 2 },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'stretch',
  },
  nameEditRowMobile: { justifyContent: 'center' },
  nameInput: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.beige,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.orange,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  nameInputMobile: { fontSize: 20, color: COLORS.beige, textAlign: 'center' },
  nameBtn: { padding: 4 },

  email: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 11,
    color: 'rgba(245,235,220,0.5)',
    marginTop: 3,
  },
  emailMobile: { textAlign: 'center', marginTop: 4 },

  panelDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  panelDividerMobile: { marginVertical: 12 },

  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  statRowMobile: { justifyContent: 'center', gap: 8 },
  statLabel: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: 'rgba(245,235,220,0.4)',
  },
  statLabelMobile: { fontSize: 13 },
  statValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.beige,
  },
  statValueMobile: { fontSize: 13 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    paddingVertical: 8,
  },
  actionRowMobile: { paddingVertical: 13 },
  actionText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.55)',
  },
  actionTextMobile: { color: COLORS.beige },
  actionTextOrange: { color: COLORS.orange },
  actionTextRed: { color: 'rgba(181,48,43,0.85)' },

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

// ── Mobile-only styles (native parity) ───────────────────────────────────────
const mob = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: { paddingBottom: 80 },

  // Cover
  cover: {
    height: 160,
    overflow: 'hidden',
    cursor: 'pointer',
  } as object,
  coverDots: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage: 'radial-gradient(circle, rgba(231,115,51,0.22) 1.5px, transparent 1.5px)',
    backgroundSize: '14px 14px',
  } as object,
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
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
    ...StyleSheet.absoluteFillObject,
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
    marginBottom: 4,
    gap: 4,
  },
  nameInput: {
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    color: COLORS.navy,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.orange,
    paddingVertical: 2,
    paddingHorizontal: 4,
    minWidth: 120,
    outlineStyle: 'none',
  } as object,
  nameAction: { padding: 6 },
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
