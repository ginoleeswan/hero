// Header notification bell — command-center alerts (rate-limit, failures) live
// here instead of taking real estate as banners. Badge shows the count; tap to
// see them. Shared by the desktop command band and the mobile global TopBar.
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '../../ui/Text';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { type Alert } from './AlertStack';

export function NotificationBell({
  alerts,
  variant = 'band',
}: {
  alerts: Alert[];
  // 'band' = the desktop command band's pill button; 'nav' = a transparent
  // header-icon button matching the global TopBar's other icons (44², hover bg).
  variant?: 'band' | 'nav';
}) {
  const [open, setOpen] = useState(false);
  const count = alerts.length;
  const nav = variant === 'nav';
  return (
    <View style={styles.bellWrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        hitSlop={8}
        style={
          nav
            ? ({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                [styles.navBtn, hovered && styles.navBtnHover] as object
            : styles.bellBtn
        }
      >
        <Ionicons
          name={count > 0 ? 'notifications' : 'notifications-outline'}
          size={nav ? 22 : 18}
          color={nav ? 'rgba(245,235,220,0.7)' : 'rgba(255,255,255,0.85)'}
        />
        {count > 0 ? (
          <View style={[styles.bellBadge, nav && styles.bellBadgeNav]}>
            <Text style={styles.bellBadgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        ) : null}
      </Pressable>
      {open ? (
        <View style={styles.bellMenu}>
          <Text style={styles.bellTitle}>Notifications</Text>
          {count === 0 ? (
            <Text style={styles.bellEmpty}>All clear — nothing to report.</Text>
          ) : (
            alerts.map((a, i) => (
              <View key={i} style={styles.bellItem}>
                <Ionicons
                  name={a.tone === 'red' ? 'alert-circle' : 'warning'}
                  size={16}
                  color={a.tone === 'red' ? COLORS.red : COLORS.yellow}
                />
                <Text style={styles.bellItemText}>{a.text}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bellWrap: { position: 'relative' },
  bellBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // 'nav' variant: matches the TopBar's other header icons (44², transparent,
  // hover background) so the bell is consistent in size and spacing.
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  } as object,
  navBtnHover: { backgroundColor: 'rgba(255,255,255,0.08)' } as object,
  bellBadgeNav: { top: 7, right: 7 },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    paddingHorizontal: 4,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 9.5, color: '#fff' },
  bellMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 320,
    maxWidth: '90vw' as unknown as number,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    zIndex: 1000,
    elevation: 24,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  bellTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: COLORS.grey,
  },
  bellEmpty: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 13,
    color: COLORS.grey,
    paddingVertical: 4,
  },
  bellItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 5 },
  bellItemText: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.black,
    lineHeight: 18,
  },
});
