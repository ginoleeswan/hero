// Dark command-center chrome. Renders the pinned top bar (brand + overall gauge +
// refresh), the domain switcher (left rail on desktop, bottom tab bar on mobile),
// and slots for the vitals ribbon, alerts, and the active domain content.
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { type ReactNode, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/colors';
import { TOPBAR_HEIGHT } from '../../web/TopBar';
import { DOMAINS, type DomainKey } from './format';
import { Gauge } from './charts';
import { type Alert } from './AlertStack';
import { NotificationBell } from './NotificationBell';

const CHROME_TOP = '#10242e'; // matches the retired Masthead gradient start

// The 4 fixed mobile tabs (most-used). Everything else lives in the "More" sheet.
const MOBILE_TABS: DomainKey[] = ['command', 'catalog', 'pipelines', 'traffic'];

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
          <Text style={styles.railBadgeText}>
            {badge > 999 ? `${Math.round(badge / 1000)}k` : badge}
          </Text>
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
  fill,
  ribbon,
  alerts = [],
  children,
}: {
  domain: DomainKey;
  onDomain: (k: DomainKey) => void;
  fill?: boolean;
  overall: number;
  pending: number;
  refreshing: boolean;
  onRefresh: () => void;
  narrow: boolean;
  ribbon?: ReactNode;
  alerts?: Alert[];
  children: ReactNode;
}) {
  const primary = DOMAINS.filter((d) => !d.placeholder);
  const future = DOMAINS.filter((d) => d.placeholder);
  // Mobile bottom bar caps at 5 slots: 4 fixed tabs + a "More" sheet for the rest.
  // (Desktop keeps the full rail above.)
  const mobilePrimary = MOBILE_TABS.map((k) => DOMAINS.find((d) => d.key === k)).filter(
    (d): d is (typeof DOMAINS)[number] => !!d,
  );
  const mobileOverflow = primary.filter((d) => !MOBILE_TABS.includes(d.key));
  const overflowActive = mobileOverflow.some((d) => d.key === domain);
  const [moreOpen, setMoreOpen] = useState(false);
  // Lock the shell to a real pixel viewport height (RN-web drops '100dvh'), so the
  // content area can divide that height instead of growing the page.
  const { height: winH } = useWindowDimensions();

  return (
    <View style={[styles.page, !narrow && { height: winH, overflow: 'hidden', minHeight: 0 }]}>
      {/* Top bar — full-bleed dark band fusing with the floating nav. DESKTOP ONLY:
          on mobile the band is gone (its gauge lives on Overview, the alerts bell
          moves to the global TopBar, and refresh is pull-to-refresh), so the screen
          gets that vertical space back. The body picks up the nav clearance below. */}
      {!narrow && (
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
              <NotificationBell alerts={alerts} />
              <Pressable onPress={onRefresh} hitSlop={8} style={styles.refresh}>
                {refreshing ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
                ) : (
                  <Ionicons name="refresh" size={15} color="rgba(255,255,255,0.85)" />
                )}
              </Pressable>
              <Gauge value={overall} size={46} />
            </View>
          </View>
        </LinearGradient>
      )}

      {/* Body: rail (desktop) + content */}
      <LinearGradient
        colors={[COLORS.deepNavy, '#081218']}
        style={[styles.bodyBg, !narrow && styles.minH0]}
      >
        <View style={[styles.body, narrow && styles.bodyNarrow, !narrow && styles.bodyFill]}>
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
                <RailItem
                  key={d.key}
                  def={d}
                  on={domain === d.key}
                  onPress={() => onDomain(d.key)}
                />
              ))}
              <View style={{ flex: 1 }} />
            </View>
          )}

          <View
            style={[
              styles.content,
              narrow && styles.contentNarrow,
              !narrow && (fill ? styles.noScroll : styles.scrollY),
            ]}
          >
            {ribbon}
            {children}
          </View>
        </View>
      </LinearGradient>

      {/* Mobile: tap-away scrim + "More" sheet (sits above the bottom bar) */}
      {narrow && moreOpen && (
        <Pressable style={styles.moreScrim} onPress={() => setMoreOpen(false)}>
          <Pressable style={styles.moreSheet} onPress={() => {}}>
            <Text style={styles.moreTitle}>More</Text>
            {mobileOverflow.map((d) => {
              const on = domain === d.key;
              return (
                <Pressable
                  key={d.key}
                  onPress={() => {
                    onDomain(d.key);
                    setMoreOpen(false);
                  }}
                  style={[styles.moreRow, on && styles.moreRowOn]}
                >
                  <Ionicons name={d.icon} size={20} color={on ? COLORS.orange : '#fff'} />
                  <Text style={[styles.moreRowText, on && styles.moreRowTextOn]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      )}

      {/* Mobile bottom tab bar — 4 fixed tabs + More */}
      {narrow && (
        <View style={styles.btab}>
          {mobilePrimary.map((d) => {
            const on = domain === d.key;
            const badge = d.badge === 'pending' ? pending : undefined;
            return (
              <Pressable
                key={d.key}
                onPress={() => {
                  setMoreOpen(false);
                  onDomain(d.key);
                }}
                style={styles.btabItem}
              >
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
          {/* More — highlighted when the sheet is open or an overflow domain is active.
              Shows the active overflow domain's name so the bar reflects location. */}
          {(() => {
            const lit = moreOpen || overflowActive;
            const activeDef = overflowActive ? DOMAINS.find((d) => d.key === domain) : undefined;
            return (
              <Pressable onPress={() => setMoreOpen((v) => !v)} style={styles.btabItem}>
                <View style={[styles.btabIconWrap, lit && styles.btabIconWrapOn]}>
                  <Ionicons
                    name={activeDef?.icon ?? 'ellipsis-horizontal'}
                    size={22}
                    color={lit ? COLORS.orange : '#fff'}
                  />
                </View>
                <Text style={[styles.btabLabel, lit && styles.btabLabelOn]}>
                  {activeDef?.label ?? 'More'}
                </Text>
              </Pressable>
            );
          })()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.deepNavy, minHeight: '100%' as unknown as number },
  // Desktop: lock the whole shell to the viewport so the header + rail stay fixed
  // and only the content area scrolls — the "app, not webpage" feel. (Mobile keeps
  // natural page scroll.)
  pageLock: { height: '100dvh' as unknown as number, minHeight: 0, overflow: 'hidden' },
  minH0: { minHeight: 0 },
  // Work tabs: the content region scrolls inside itself. Dashboard (fill) tabs:
  // no scroll — the bento divides the height and any list scrolls within a panel.
  scrollY: { minHeight: 0, overflow: 'scroll' },
  noScroll: { minHeight: 0, overflow: 'hidden' },
  top: {
    width: '100%',
    paddingTop: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 4px)` as unknown as number,
    paddingBottom: 8,
    // Header (and its notification dropdown) must stack above the body below it.
    zIndex: 100,
  },
  topInner: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  brandCol: { gap: 1 },
  kicker: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 2.2, color: COLORS.orange },
  brand: { fontFamily: 'Flame-Regular', fontSize: 19, color: '#fff', lineHeight: 23 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 100 },
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
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 14,
    padding: 16,
    alignItems: 'flex-start',
  },
  // Desktop: body fills the locked viewport height and stretches the rail +
  // content so the content's fill bento can divide that height (no page scroll).
  bodyFill: { flex: 1, minHeight: 0, alignItems: 'stretch' },
  // Mobile has no command band, so the body itself clears the floating TopBar.
  bodyNarrow: {
    flexDirection: 'column',
    paddingHorizontal: 12,
    paddingTop: `calc(${TOPBAR_HEIGHT}px + env(safe-area-inset-top) + 10px)` as unknown as number,
    gap: 12,
  },
  rail: {
    width: 84,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    paddingVertical: 10,
    gap: 4,
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  railItem: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 9,
    marginHorizontal: 8,
    borderRadius: 11,
  },
  railItemOn: { backgroundColor: COLORS.orange },
  railItemDim: { opacity: 0.4 },
  railLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  railLabelOn: { color: '#fff' },
  railDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 6,
    marginHorizontal: 14,
  },
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
    paddingBottom: `calc(env(safe-area-inset-bottom) + 84px)` as unknown as number,
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

  // "More" overflow sheet (mobile)
  moreScrim: {
    position: 'fixed',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 60,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  } as object,
  moreSheet: {
    marginHorizontal: 10,
    // Clear the fixed bottom bar (icon + label + safe-area).
    marginBottom: `calc(env(safe-area-inset-bottom) + 76px)` as unknown as number,
    backgroundColor: CHROME_TOP,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 8,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  moreTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 11,
  },
  moreRowOn: { backgroundColor: COLORS.orange + '22' },
  moreRowText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff' },
  moreRowTextOn: { color: COLORS.orange },
});
