import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { useProfile } from '../src/hooks/useProfile';
import { ChangePasswordModal } from '../src/components/ui/ChangePasswordModal';
import { providerMeta } from '../src/lib/profile/provider';
import { COLORS } from '../src/constants/colors';
import { Toast, useToast } from '../src/components/ui/Toast';
import { SectionShell } from '../src/components/profile/SectionShell';

const KO_FI_URL = 'https://ko-fi.com/glstudio';

type RowTone = 'navy' | 'orange' | 'danger';

/** One settings row — icon badge + label, with an optional value or chevron. */
function SettingRow({
  icon,
  label,
  value,
  tone = 'navy',
  onPress,
  chevron,
  busy,
  busyLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  tone?: RowTone;
  onPress?: () => void;
  chevron?: boolean;
  busy?: boolean;
  busyLabel?: string;
}) {
  const iconColor =
    tone === 'orange' ? COLORS.orange : tone === 'danger' ? COLORS.red : COLORS.navy;
  const badgeStyle =
    tone === 'orange'
      ? styles.badgeOrange
      : tone === 'danger'
        ? styles.badgeDanger
        : styles.badgeNavy;

  const inner = (
    <>
      {busy ? (
        <ActivityIndicator size="small" color={iconColor} style={styles.rowIndicator} />
      ) : (
        <View style={[styles.badge, badgeStyle]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
      )}
      <Text style={[styles.label, tone === 'danger' && styles.labelDanger]}>
        {busy && busyLabel ? busyLabel : label}
      </Text>
      {value != null && (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      {chevron && <Ionicons name="chevron-forward" size={16} color="rgba(41,60,67,0.3)" />}
    </>
  );

  if (!onPress) return <View style={styles.row}>{inner}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {inner}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, signOut, changePassword, deleteAccount } = useAuth();
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

  // All hooks above run unconditionally. useAuth resolves the session async and
  // starts as { user: null, loading: true }; wait for it to settle before
  // deciding, or a signed-in user gets bounced to Explore on the first render.
  if (authLoading) return null;
  // <Redirect> defers the navigation dispatch internally, so it's safe to
  // render (unlike calling router.replace during render).
  if (!user) return <Redirect href="/explore" />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.rowPressed]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
          </Pressable>
          <Text style={styles.title}>Settings</Text>
        </View>

        <SectionShell title="Account">
          <SettingRow icon="mail-outline" label="Email" value={email} />
          {!isEmailUser && (
            <SettingRow
              icon={providerMeta(provider).icon}
              label="Signed in with"
              value={providerMeta(provider).label}
            />
          )}
          {isEmailUser && (
            <SettingRow
              icon="lock-closed-outline"
              label="Change password"
              onPress={() => setShowChangePassword(true)}
              chevron
            />
          )}
        </SectionShell>

        {profile?.is_admin && (
          <SectionShell title="Admin">
            <SettingRow
              icon="stats-chart-outline"
              label="Catalog Health"
              onPress={() => router.push('/admin/health')}
              chevron
            />
          </SectionShell>
        )}

        <SectionShell title="Support">
          <Text style={styles.supportBlurb}>
            Mythique is a free, unofficial fan project. If you enjoy it, a coffee keeps it going.
          </Text>
          <SettingRow
            icon="heart-outline"
            label="Support this project"
            value="Ko-fi"
            tone="orange"
            onPress={() => Linking.openURL(KO_FI_URL)}
            chevron
          />
        </SectionShell>

        <SectionShell title="Account actions">
          <SettingRow
            icon="log-out-outline"
            label="Sign out"
            tone="danger"
            onPress={handleSignOut}
            busy={signingOut}
            busyLabel="Signing out…"
          />
          <View style={styles.rowDivider} />
          <SettingRow
            icon="trash-outline"
            label="Delete account"
            tone="danger"
            onPress={handleDeleteAccount}
            busy={deletingAccount}
            busyLabel="Deleting account…"
          />
        </SectionShell>

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
      <Toast message={toast.message} visible={toast.visible} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    marginLeft: -8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 30,
    lineHeight: 37, // ≥ 1.22× fontSize for Flame descenders
    color: COLORS.navy,
  },

  supportBlurb: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.grey,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: 'rgba(231,115,51,0.08)' },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ede5d8',
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeNavy: { backgroundColor: '#e8f0f2' },
  badgeOrange: { backgroundColor: '#fff5ee' },
  badgeDanger: { backgroundColor: '#fde8e8' },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.navy,
    flex: 1,
  },
  labelDanger: { color: COLORS.red },
  value: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    maxWidth: 200,
  },
  rowIndicator: { width: 34 },

  disclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: 'rgba(29,45,51,0.4)',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
  },
});
