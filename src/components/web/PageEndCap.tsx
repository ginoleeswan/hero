import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { HeroLogo } from './HeroLogo';

/**
 * Compact ink end-cap that closes a beige content page onto the app's ink
 * floor. Web-only.
 *
 * Why it exists: in an iOS Safari tab one document canvas colour tints BOTH
 * the status-bar zone and the bottom toolbar, so pages keep `canvas: ink` for
 * a stable dark top — which means a page that ends on raw beige shows a hard
 * beige→navy cut at the very bottom. Instead of fighting the canvas per
 * scroll-state (which flickers — the tint is re-sampled on toolbar
 * collapse/reveal), the page *closes on ink by design*: the beige sheet gets a
 * rounded bottom edge (mirroring its rounded top entrance) and lands on this
 * short brand band, so the toolbar always frosts over ink and the page end
 * reads intentional in every scroll state. Explore does the same with its full
 * HomeFooter; this is the slim version for detail pages.
 */
export function PageEndCap({
  /**
   * The rounded beige foot that closes the paper sheet into the ink band.
   * Disable when the content directly above is ALREADY ink (e.g. the issue
   * page's "more in this series" band) — the cap then continues the dark
   * surface seamlessly instead of inserting a stray beige lip.
   */
  sheetFoot = true,
}: {
  sheetFoot?: boolean;
} = {}) {
  const router = useRouter();
  // Web-only: the ink close exists for the iOS Safari toolbar zone. Native
  // screens (shared routes like title/issue import this too) have no document
  // canvas and use their own safe-area treatments.
  if (Platform.OS !== 'web') return null;
  const go = (path: string) => router.push(path as Parameters<typeof router.push>[0]);

  const LINKS: { label: string; path: string }[] = [
    { label: 'Explore', path: '/explore' },
    { label: 'Arena', path: '/versus' },
    { label: 'Support', path: '/support' },
    { label: 'Privacy', path: '/privacy' },
  ];

  return (
    <View style={s.cap as object}>
      {/* The paper sheet's foot: beige rounding INTO the ink floor, mirroring
          the sheet's rounded-corner entrance over the hero stage up top. */}
      {sheetFoot ? <View style={s.sheetFoot as object} /> : <View style={s.darkGap as object} />}
      <View style={s.inner}>
        <HeroLogo iconSize={20} fontSize={16} color={COLORS.beige} gap={7} />
        <View style={s.links}>
          {LINKS.map((l, i) => (
            <View key={l.label} style={s.linkItem}>
              {i > 0 ? <Text style={s.dot as object}>·</Text> : null}
              <Pressable
                onPress={() => go(l.path)}
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
                  [s.linkWrap, hovered && (s.linkWrapHover as object)] as object
                }
              >
                <Text style={s.link as object}>{l.label}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Text style={s.meta as object}>© 2026 Mythique</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  cap: {
    backgroundColor: COLORS.deepNavy,
    // If the page is shorter than the viewport, auto-margin pushes the cap to
    // the document's bottom edge so the ink always owns the toolbar zone.
    marginTop: 'auto',
    // Clear the iOS home indicator / collapsed toolbar so the brand line is
    // never buried under the frosted glass. env() → 0 elsewhere.
    paddingBottom: 'calc(30px + env(safe-area-inset-bottom))',
  } as object,
  sheetFoot: {
    height: 28,
    backgroundColor: COLORS.beige,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginBottom: 30,
  } as object,
  // Breathing room standing in for the sheet foot when the page already ends
  // on an ink section (sheetFoot=false) — keeps the brand line's rhythm.
  darkGap: { height: 30 } as object,
  inner: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  } as object,
  linkItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { color: INK_TEXT.faint, fontSize: 13 } as object,
  linkWrap: { transition: 'opacity 150ms ease' } as object,
  linkWrapHover: { opacity: 0.8 } as object,
  link: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.66)',
    cursor: 'pointer',
  } as object,
  meta: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 11,
    color: INK_TEXT.faint,
  } as object,
});
