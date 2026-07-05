import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { useProfile } from '../src/hooks/useProfile';
import { ChangePasswordModal } from '../src/components/ui/ChangePasswordModal';
import { providerMeta } from '../src/lib/profile/provider';
import { COLORS, SURFACE } from '../src/constants/colors';
import { Toast, useToast } from '../src/components/ui/Toast';
import { useScreenChrome } from '../src/hooks/useScreenChrome';

const KO_FI_URL = 'https://ko-fi.com/glstudio';

export default function WebSettingsScreen() {
  const router = useRouter();
  // Ink chrome over a beige canvas, matching the rest of the web shell.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });
  const { user, signOut, changePassword, deleteAccount } = useAuth();
  const { profile } = useProfile(user?.id);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { toast, showToast } = useToast();

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

  const handleChangePassword = async (current: string, next: string) => {
    const result = await changePassword(current, next);
    if (!result.error) showToast('Password updated');
    return result;
  };

  const email = user?.email ?? '';
  const provider = user?.app_metadata?.provider ?? 'email';
  const isEmailUser = provider === 'email' || !user?.app_metadata?.provider;

  // All hooks above run unconditionally; guests are bounced back to Explore.
  if (!user) {
    router.replace('/explore');
    return null;
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
            [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
          }
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.accountCard}>
          <View style={styles.accountRow as object}>
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
              <View style={styles.accountRow as object}>
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
              <Pressable
                onPress={() => setShowChangePassword(true)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [styles.accountRow, hovered && (styles.accountRowHover as object)] as object
                }
              >
                <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                  <Ionicons name="lock-closed-outline" size={16} color={COLORS.navy} />
                </View>
                <Text style={styles.accountLabel}>Change Password</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
              </Pressable>
            </>
          )}

          {profile?.is_admin && (
            <>
              <View style={styles.divider} />
              <Pressable
                onPress={() => router.push('/admin/health')}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [styles.accountRow, hovered && (styles.accountRowHover as object)] as object
                }
              >
                <View style={[styles.accountIconBadge, styles.accountIconBadgeNavy]}>
                  <Ionicons name="stats-chart-outline" size={16} color={COLORS.navy} />
                </View>
                <Text style={styles.accountLabel}>Catalog Health</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
              </Pressable>
            </>
          )}

          <View style={styles.divider} />
          <Pressable
            onPress={() => Linking.openURL(KO_FI_URL)}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.accountRow, hovered && (styles.accountRowHover as object)] as object
            }
          >
            <View style={[styles.accountIconBadge, styles.accountIconBadgeOrange]}>
              <Ionicons name="heart-outline" size={16} color={COLORS.orange} />
            </View>
            <Text style={styles.accountLabel}>Support this project</Text>
            <Text style={styles.accountValue}>Ko-fi</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />
          </Pressable>

          <View style={styles.divider} />
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.accountRow, hovered && (styles.accountRowHover as object)] as object
            }
          >
            {signingOut ? (
              <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
            ) : (
              <View style={[styles.accountIconBadge, styles.accountIconBadgeRed]}>
                <Ionicons name="log-out-outline" size={16} color={COLORS.red} />
              </View>
            )}
            <Text style={[styles.accountLabel, styles.accountLabelDanger]}>
              {signingOut ? 'Signing out…' : 'Sign Out'}
            </Text>
          </Pressable>

          <View style={styles.divider} />
          <Pressable
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
              [styles.accountRow, hovered && (styles.accountRowHover as object)] as object
            }
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color={COLORS.red} style={{ marginRight: 10 }} />
            ) : (
              <View style={[styles.accountIconBadge, styles.accountIconBadgeRed]}>
                <Ionicons name="trash-outline" size={16} color={COLORS.red} />
              </View>
            )}
            <Text style={[styles.accountLabel, styles.accountLabelDanger]}>
              {deletingAccount ? 'Deleting account…' : 'Delete Account'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics, or
          any other publisher.
        </Text>
      </View>

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        onSubmit={handleChangePassword}
      />
      <Toast message={toast.message} visible={toast.visible} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  backBtnHover: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
  headerTitle: {
    flex: 1,
    fontFamily: 'Flame-Regular',
    fontSize: 22,
    lineHeight: 27,
    color: COLORS.navy,
    textAlign: 'center',
  },
  headerSpacer: { width: 36 },

  content: {
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingBottom: 40,
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
    maxWidth: 200,
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
});
