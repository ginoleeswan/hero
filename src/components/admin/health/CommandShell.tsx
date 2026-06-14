// Dark command-center chrome. Renders the pinned top bar (brand + overall gauge +
// refresh), the domain switcher (left rail on desktop, bottom tab bar on mobile),
// and slots for the vitals ribbon, alerts, and the active domain content.
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { TOPBAR_HEIGHT } from '../../web/TopBar';
import { DOMAINS, type DomainKey } from './format';
import { Gauge } from './charts';

const CHROME_TOP = '#10242e'; // matches the retired Masthead gradient start

function RailItem({
  def,
  on,
  badge,
  onPress,
}: {
  def: (typeof DOMAINS)[number];
  on: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.railItem, on && styles.railItemOn, def.placeholder && styles.railItemDim]}
      accessibilityLabel={def.label}
    >
      <Ionicons name={def.icon} size={20} color={on ? '#fff' : 'rgba(255,255,255,0.6)'} />
      {badge != null && badge > 0 && (
        <View style={styles.railBadge}>
          <Text style={styles.railBadgeText}>{badge > 999 ? `${Math.round(badge / 1000)}k` : badge}</Text>
        </View>
      )}
      <Text style={[styles.railLabel, on && styles.railLabelOn]}>{def.label}</Text>
    </Pressable>
  );
}

export function CommandShell({
  domain,
  onDomain,
  overall,
  pending,
  refreshing,
  onRefresh,
  narrow,
  ribbon,
  alerts,
  children,
}: {
  domain: DomainKey;
  onDomain: (k: DomainKey) => void;
  overall: number;
  pending: number;
  refreshing: boolean;
  onRefresh: () => void;
  narrow: boolean;
  ribbon?: ReactNode;
  alerts?: ReactNode;
  children: ReactNode;
}) {
  const primary = DOMAINS.filter((d) => !d.placeholder);
  const future = DOMAINS.filter((d) => d.placeholder);

  return (
    <View style={styles.page}>
      {/* Top bar — full-bleed dark band fusing with the floating nav */}
      <LinearGradient
        colors={[CHROME_TOP, COLORS.deepNavy]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.top}
      >
        <View style={styles.topInner}>
          <View style={styles.brandCol}>
            <Text style={styles.kicker}>MYTHIQUE · COMMAND CENTER</Text>
            <Text style={styles.brand}>{DOMAINS.find((d) => d.key === domain)?.label}</Text>
          </View>
          <View style={styles.topRight}>
            <Pressable onPress={onRefresh} hitSlop={8} style={styles.refresh}>
              {refreshing ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
              ) : (
                <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.85)" />
              )}
            </Pressable>
            <Gauge value={overall} size={narrow ? 56 : 64} />
          </View>
        </View>
      </LinearGradient>

      {/* Body: rail (desktop) + content */}
      <LinearGradient colors={[COLORS.deepNavy, '#081218']} style={styles.bodyBg}>
        <View style={[styles.body, narrow && styles.bodyNarrow]}>
          {!narrow && (
            <View style={styles.rail}>
              {primary.map((d) => (
                <RailItem
                  key={d.key}
                  def={d}
                  on={domain === d.key}
                  badge={d.badge === 'pending' ? pending : undefined}
                  onPress={() => onDomain(d.key)}
                />
              ))}
              <View style={styles.railDivider} />
              {future.map((d) => (
                <RailItem key={d.key} def={d} on={domain === d.key} onPress={() => onDomain(d.key)} />
              ))}
              <View style={{ flex: 1 }} />
            </View>
          )}

          <View style={[styles.content, narrow && styles.contentNarrow]}>
            {ribbon}
            {alerts}
            {children}
          </View>
        </View>
      </LinearGradient>

      {/* Mobile bottom tab bar */}
      {narrow && (
        <View style={styles.btab}>
          {primary.map((d) => {
            const on = domain === d.key;
            const badge = d.badge === 'pending' ? pending : undefined;
            return (
              <Pressable key={d.key} onPress={() => onDomain(d.key)} style={styles.btabItem}>
                <View style={[styles.btabIconWrap, on && styles.btabIconWrapOn]}>
                  <Ionicons name={d.icon} size={22} color={on ? COLORS.orange : '#fff'} />
                  {badge != null && badge > 0 && (
                    <View style={styles.btabBadge}>
                      <Text style={styles.btabBadgeText}>
                        {badge > 999 ? `${Math.round(badge / 1000)}k` : badge}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.btabLabel, on && styles.btabLabelOn]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.deepNavy, minHeight: '100%' as unknown as number },
  top: {
    width: '100%',
    paddingTop: (`calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 12px)` as unknown) as number,
    paddingBottom: 12,
  },
  topInner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brandCol: { gap: 2 },
  kicker: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 2.4, color: COLORS.orange },
  brand: { fontFamily: 'Flame-Regular', fontSize: 26, color: '#fff', lineHeight: 29 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refresh: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bodyBg: { flex: 1, width: '100%' },
  body: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    alignItems: 'flex-start',
  },
  bodyNarrow: { flexDirection: 'column', paddingHorizontal: 12, paddingTop: 12, gap: 12 },
  rail: {
    width: 84,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    paddingVertical: 10,
    gap: 4,
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  railItem: { alignItems: 'center', gap: 3, paddingVertical: 9, marginHorizontal: 8, borderRadius: 11 },
  railItemOn: { backgroundColor: COLORS.orange },
  railItemDim: { opacity: 0.4 },
  railLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  railLabelOn: { color: '#fff' },
  railDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 6, marginHorizontal: 14 },
  railBadge: {
    position: 'absolute',
    top: 4,
    right: 16,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 5,
    minWidth: 16,
    alignItems: 'center',
  },
  railBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff' },
  content: { flex: 1, gap: 12, minWidth: 0 },
  contentNarrow: {
    width: '100%',
    paddingBottom: (`calc(env(safe-area-inset-bottom) + 84px)` as unknown) as number,
  },

  // Mobile bottom tab bar (fixed)
  btab: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    flexDirection: 'row',
    backgroundColor: CHROME_TOP,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 9,
    paddingBottom: `calc(env(safe-area-inset-bottom) + 9px)`,
    transform: 'translateZ(0)',
  } as object,
  btabItem: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  btabIconWrap: { paddingHorizontal: 16, paddingVertical: 3, borderRadius: 999 },
  btabIconWrapOn: { backgroundColor: COLORS.orange + '22' },
  btabLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  btabLabelOn: { color: COLORS.orange },
  btabBadge: {
    position: 'absolute',
    top: -5,
    right: 6,
    backgroundColor: COLORS.orange,
    borderRadius: 999,
    paddingHorizontal: 5,
    minWidth: 16,
    alignItems: 'center',
  },
  btabBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff' },
});
