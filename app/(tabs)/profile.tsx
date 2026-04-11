import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
  TextInput,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SquircleMask } from '../../src/components/ui/SquircleMask';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { useProfile } from '../../src/hooks/useProfile';
import { ChangePasswordModal } from '../../src/components/ui/ChangePasswordModal';
import { getUserFavouriteHeroes, type FavouriteHero } from '../../src/lib/db/favourites';
import { heroImageSource } from '../../src/constants/heroImages';
import { COLORS } from '../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = (SCREEN_WIDTH - 32 - 8) / 3;

const HERO_LOGO_PATH =
  'M771.83 359.726C790.233 359.157 809.038 360.561 827.217 363.687C860.194 368.791 880.58 384.832 899.577 411.588C952.323 485.882 910.478 588.451 840.684 635.156C777.716 677.292 684.759 672.267 615.599 648.433C606.232 645.205 596.363 641.14 587.513 636.51C560.951 620.256 539.813 614.985 508.598 616.581C476.925 618.201 457.215 629.785 428.71 641.463C378.199 662.157 312.618 674.016 258.384 663.281C223.369 657.798 188.002 641.874 162.23 617.635C99.3027 558.45 73.5282 462.814 138.958 393.848C166.265 365.064 197.584 361.227 235.229 360.28C291.337 358.869 345.958 367.328 400.078 381.829C413.535 385.43 426.897 389.376 440.151 393.665C470.511 403.519 493.246 412.119 526.372 410.492C544.544 409.599 556.786 403.601 573.782 397.773C584.487 394.125 595.271 390.711 606.126 387.535C659.036 371.973 716.754 361.015 771.83 359.726ZM379.43 580.576C404.316 570.739 422.585 557.516 434.848 532.384C439.037 523.799 439.936 512.178 436.403 503.212C428.365 482.815 393.689 466.137 374.256 457.991C346.125 446.198 312.018 435.868 281.435 435.007C275.287 434.834 268.989 434.216 262.784 434.713C226.343 436.857 209.334 467.83 211.588 501.699C213.173 525.52 224.795 548.661 242.631 564.609C267.287 585.96 306.277 591.723 337.967 589.297C352.112 588.232 366.054 585.299 379.43 580.576ZM669.618 585.812C703.165 593.579 746.514 591.622 776.102 573.056C796.619 559.96 811.158 539.317 816.578 515.588C826.183 473.57 805.637 434.865 760.026 435.926C754.894 436.045 749.642 435.782 744.496 436.282C698.168 440.71 646.68 454.898 608.343 482.267C576.199 505.214 594.861 542.717 619.664 562.508C634.433 574.519 651.324 581.316 669.618 585.812Z';

function username(email: string) {
  return email.split('@')[0] ?? email;
}

function FavouriteThumb({ hero, onPress }: { hero: FavouriteHero; onPress: () => void }) {
  const src = heroImageSource(hero.id, hero.image_url, hero.portrait_url);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.thumb}>
      <SquircleMask style={StyleSheet.absoluteFill} cornerRadius={26}>
        <Image source={src} contentFit="cover" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          locations={[0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </SquircleMask>
      <Text style={styles.thumbName} numberOfLines={1}>
        {hero.name}
      </Text>
    </TouchableOpacity>
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
      .catch(() => setFavourites([]))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
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
      ]
    );
  };

  const handleAvatarLongPress = () => {
    if (!profile?.avatar_url) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Remove Photo'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) removeAvatar(); }
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
        (idx) => { if (idx === 1) removeCover(); }
      );
    } else {
      Alert.alert('Cover Photo', 'Remove your cover photo?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove Cover', style: 'destructive', onPress: removeCover },
      ]);
    }
  };

  const startEditingName = () => {
    const current = profile?.display_name ?? username(email);
    setNameValue(current);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed) { setEditingName(false); return; }
    setSavingName(true);
    await updateDisplayName(trimmed);
    setSavingName(false);
    setEditingName(false);
  };

  const handleCancelName = () => {
    setEditingName(false);
    setNameValue('');
  };

  const email = user?.email ?? '';
  const name = profile?.display_name ?? username(email);
  const isEmailUser = user?.app_metadata?.provider === 'email' || !user?.app_metadata?.provider;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
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
            <Image source={{ uri: profile.cover_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={['#293C43', '#3d5a66']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            >
              <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
                <Defs>
                  <Pattern id="dots" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
                    <Circle cx="7" cy="7" r="1.5" fill="rgba(231,115,51,0.22)" />
                  </Pattern>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#dots)" />
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
          <View style={[styles.editCoverPill, { bottom: 52 }]}>
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
                <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
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
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                ref={nameInputRef}
                style={styles.nameInput}
                value={nameValue}
                onChangeText={setNameValue}
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                autoCapitalize="words"
                maxLength={40}
                placeholderTextColor="rgba(41,60,67,0.3)"
              />
              <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={styles.nameAction} activeOpacity={0.7}>
                {savingName
                  ? <ActivityIndicator size="small" color={COLORS.orange} />
                  : <Ionicons name="checkmark" size={20} color={COLORS.orange} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancelName} style={styles.nameAction} activeOpacity={0.7}>
                <Ionicons name="close" size={20} color={COLORS.grey} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={startEditingName} activeOpacity={0.7} style={styles.nameRow}>
              <Text style={styles.username}>{name}</Text>
              <Ionicons name="pencil-outline" size={14} color={COLORS.grey} style={styles.pencilIcon} />
            </TouchableOpacity>
          )}
          <Text style={styles.email}>{email}</Text>
          <View style={styles.statPill}>
            <Ionicons name="heart" size={14} color={COLORS.orange} />
            <Text style={styles.statPillText}>
              {loading ? '–' : favourites.length} saved heroes
            </Text>
          </View>
        </View>

        <View style={styles.hairline} />

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
              <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                <Ionicons name="mail-outline" size={16} color={COLORS.navy} />
              </View>
              <Text style={styles.accountLabel}>Email</Text>
              <Text style={styles.accountValue} numberOfLines={1}>
                {email}
              </Text>
            </View>

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
          Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics, or any other publisher.
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.beige,
  },
  scroll: {
    paddingBottom: 40,
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
    ...StyleSheet.absoluteFillObject,
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
    maxWidth: SCREEN_WIDTH * 0.55,
  },
  nameAction: {
    padding: 6,
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
