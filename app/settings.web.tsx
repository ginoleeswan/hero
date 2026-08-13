import { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native';
import { Text } from '../src/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '../src/lib/push';
import { useProfile } from '../src/hooks/useProfile';
import { useCachedAdminFlag } from '../src/hooks/useCachedAdminFlag';
import { ChangePasswordModal } from '../src/components/ui/ChangePasswordModal';
import { providerMeta } from '../src/lib/profile/provider';
import { openKofi } from '../src/lib/support/kofi';
import { COLORS, SURFACE, PAPER_TEXT } from '../src/constants/colors';
import { Toast, useToast } from '../src/components/ui/Toast';
import { useScreenChrome } from '../src/hooks/useScreenChrome';
import { StageHeader } from '../src/components/StageHeader';
import { SectionShell } from '../src/components/profile/SectionShell';
import { PageEndCap } from '../src/components/web/PageEndCap';
import { Attribution } from '../src/components/legal/Attribution';

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
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        styles.rowPressable,
        hovered && styles.rowHover,
      ]}
    >
      {inner}
    </Pressable>
  );
}

/**
 * Daily-matchup push toggle. Renders nothing until support/state is known, and
 * nothing at all where Web Push isn't available (no SW/PushManager, or no VAPID
 * key configured) — so it silently absents itself on unsupported browsers.
 */
function NotificationsSection({ userId }: { userId: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getPushState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (state === null || state === 'unsupported') return null;

  const denied = state === 'denied';
  const on = state === 'subscribed';

  const toggle = async () => {
    setBusy(true);
    const res = on ? await unsubscribeFromPush() : await subscribeToPush(userId);
    // Re-read the true state (covers a denied prompt or a browser-side change).
    setState(res.error ? await getPushState() : on ? 'unsubscribed' : 'subscribed');
    setBusy(false);
  };

  return (
    <SectionShell title="Notifications">
      <View style={styles.row}>
        <View style={[styles.badge, styles.badgeNavy]}>
          <Ionicons name="notifications-outline" size={16} color={COLORS.navy} />
        </View>
        <View style={styles.notifText}>
          <Text style={styles.label}>Daily matchup alert</Text>
          <Text style={styles.notifSub}>
            {denied ? 'Blocked in your browser settings' : "Today's debate, once a day"}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.navy} style={styles.rowIndicator} />
        ) : (
          <Switch
            value={on}
            onValueChange={toggle}
            disabled={denied}
            trackColor={{ true: COLORS.orange, false: '#d9d2c4' }}
            accessibilityLabel="Daily matchup notifications"
          />
        )}
      </View>
    </SectionShell>
  );
}

export default function WebSettingsScreen() {
  const router = useRouter();
  // Ink chrome over a beige canvas, matching the rest of the web shell.
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.ink });
  const { user, loading: authLoading, signOut, changePassword, deleteAccount } = useAuth();
  const { profile } = useProfile(user?.id);
  // Last-known admin state so the Admin section doesn't pop in after the
  // profile query resolves (see useCachedAdminFlag for why this is safe).
  const isAdmin = useCachedAdminFlag(profile);
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
    <View style={styles.root}>
      <StageHeader title="Settings" onBack={() => router.back()} maxWidth={640} />
      <View style={styles.column}>
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

        <NotificationsSection userId={user.id} />

        {isAdmin && (
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
          {profile?.is_supporter ? (
            <SettingRow
              icon="star"
              label="You’re a supporter — thank you"
              value={
                profile.supporter_since
                  ? `since ${new Date(profile.supporter_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`
                  : undefined
              }
              tone="orange"
            />
          ) : (
            <Text style={styles.supportBlurb}>
              Mythique is a free, unofficial fan project. If you enjoy it, a coffee keeps it going.
            </Text>
          )}
          <SettingRow
            icon="information-circle-outline"
            label="About supporting"
            onPress={() => router.push('/support')}
            chevron
          />
          <SettingRow
            icon="heart-outline"
            label="Support this project"
            value="Ko-fi"
            tone="orange"
            onPress={openKofi}
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

        {/* Same Legal section as native — the policy and terms were reachable
            only from the signup form on both platforms. */}
        <SectionShell title="Legal">
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy policy"
            onPress={() => router.push('/privacy')}
            chevron
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms of use"
            onPress={() => router.push('/terms')}
            chevron
          />
        </SectionShell>

        <Text style={styles.disclaimer}>
          Unofficial fan app. Not affiliated with or endorsed by Marvel Entertainment, DC Comics, or
          any other publisher.
        </Text>
        {/* Licence obligation, not a courtesy — see components/legal/Attribution. */}
        <Attribution />
      </View>

      {/* Close the paper sheet onto the ink floor (constant-ink chrome). */}
      <PageEndCap />

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
  root: { minHeight: '100lvh', backgroundColor: COLORS.beige } as object,
  column: {
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 48,
  } as object,

  supportBlurb: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: PAPER_TEXT.faint,
    marginBottom: 8,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 12,
  } as object,
  rowPressable: { cursor: 'pointer' } as object,
  rowHover: { backgroundColor: 'rgba(231,115,51,0.06)' } as object,
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
    fontSize: 14,
    color: COLORS.navy,
    flex: 1,
  },
  labelDanger: { color: COLORS.red },
  value: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: PAPER_TEXT.faint,
    maxWidth: 240,
  },
  rowIndicator: { width: 34, marginRight: 0 },
  notifText: { flex: 1, gap: 1 },
  notifSub: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: PAPER_TEXT.faint },

  disclaimer: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: PAPER_TEXT.faint,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
  },
});
