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
    error: uploadError,
    pickAndUploadAvatar,
    removeAvatar,
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
        <Pressable onPress={() => setShowChangePassword(true)} style={styles.actionRow}>
          <Ionicons name="lock-closed-outline" size={14} color="rgba(245,235,220,0.55)" />
          <Text style={styles.actionText}>Change Password</Text>
        </Pressable>
      )}

      <Pressable onPress={handleSignOut} disabled={signingOut} style={styles.actionRow}>
        <Ionicons name="log-out-outline" size={14} color={COLORS.orange} />
        <Text style={[styles.actionText, styles.actionTextOrange]}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>

      <Pressable onPress={handleDeleteAccount} disabled={deletingAccount} style={styles.actionRow}>
        <Ionicons name="trash-outline" size={14} color="rgba(181,48,43,0.8)" />
        <Text style={[styles.actionText, styles.actionTextRed]}>
          {deletingAccount ? 'Deleting…' : 'Delete Account'}
        </Text>
      </Pressable>
    </View>
  );

  if (isMobile) {
    return (
      <View style={styles.root}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.mobileScroll}
          keyboardShouldPersistTaps="handled"
        >
          {profilePanel}

          <View style={styles.mobileContentSection}>
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
              <View style={styles.mobileGrid as object}>
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
  mobileScroll: { paddingBottom: 40 },
  mobileContentSection: { padding: 16 },
  mobileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
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
