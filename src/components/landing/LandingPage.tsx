import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = {
  bg: '#0b1820',
  surface: '#142130',
  card: '#1a2d3e',
  orange: '#E77333',
  yellow: '#F9B222',
  beige: '#f5ebdc',
  muted: '#7a93a3',
  border: '#253d50',
  green: '#63A936',
} as const;

const PAD_H = 40;
const PAD_H_MOBILE = 20;
const GAP = 16;

const MOSAIC = [
  { src: require('../../../assets/images/spiderman.jpg'), name: 'Spider-Man' },
  { src: require('../../../assets/images/batman.jpg'), name: 'Batman' },
  { src: require('../../../assets/images/ironman.jpg'), name: 'Iron Man' },
  { src: require('../../../assets/images/wonder-woman.jpg'), name: 'Wonder Woman' },
  { src: require('../../../assets/images/black-panther.jpg'), name: 'Black Panther' },
  { src: require('../../../assets/images/deadpool.jpg'), name: 'Deadpool' },
  { src: require('../../../assets/images/wolverine.jpg'), name: 'Wolverine' },
  { src: require('../../../assets/images/thor.jpg'), name: 'Thor' },
  { src: require('../../../assets/images/doctor-strange.jpg'), name: 'Doctor Strange' },
  { src: require('../../../assets/images/hulk.jpg'), name: 'Hulk' },
];

const SIDE_HEROES = [
  require('../../../assets/images/spiderman.jpg'),
  require('../../../assets/images/ironman.jpg'),
  require('../../../assets/images/deadpool.jpg'),
  require('../../../assets/images/wonder-woman.jpg'),
  require('../../../assets/images/thor.jpg'),
  require('../../../assets/images/wolverine.jpg'),
];

const FEATURES = [
  {
    icon: 'eye-outline' as const,
    title: 'Discover Heroes',
    desc: 'Browse curated collections by universe, team, or power set.',
  },
  {
    icon: 'search-outline' as const,
    title: 'Instant Search',
    desc: 'Find any of 500+ characters by name, power, or publisher.',
  },
  {
    icon: 'heart-outline' as const,
    title: 'Save Favourites',
    desc: 'Build your personal roster and revisit it any time.',
  },
  {
    icon: 'stats-chart-outline' as const,
    title: 'Power Stats',
    desc: 'Intelligence, strength, speed and more — full ratings for every hero.',
  },
  {
    icon: 'book-outline' as const,
    title: 'Origin Stories',
    desc: 'First issue, publisher history, and the real name behind every icon.',
  },
  {
    icon: 'grid-outline' as const,
    title: 'Universe Browser',
    desc: 'Explore Marvel, DC, Dark Horse and more by publisher, team, or era.',
  },
];

const MARQUEE =
  'Spider-Man  ·  Batman  ·  Iron Man  ·  Wonder Woman  ·  Black Panther  ·  Thor  ·  Deadpool  ·  Wolverine  ·  Doctor Strange  ·  Hulk  ·  Magneto  ·  Joker  ·  Loki  ·  Venom  ·  Storm  ·  Captain America  ·  ';
const MARQUEE_CHAR_W = 9.2;

export default function LandingPage() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const marqueeAnim = useRef(new Animated.Value(0)).current;
  const marqueeW = MARQUEE.length * MARQUEE_CHAR_W;

  useEffect(() => {
    Animated.loop(
      Animated.timing(marqueeAnim, {
        toValue: -marqueeW,
        duration: 28000,
        useNativeDriver: true,
      }),
    ).start();
  }, [marqueeW]);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const pad = isMobile ? PAD_H_MOBILE : PAD_H;
  const featureCols = isMobile ? 1 : isTablet ? 2 : 3;
  const mosaicCols = isMobile ? 3 : isTablet ? 4 : 5;

  const featureW = (width - pad * 2 - GAP * (featureCols - 1)) / featureCols;
  const mosaicW = (width - pad * 2 - GAP * (mosaicCols - 1)) / mosaicCols;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── NAV ─────────────────────────────────────────── */}
      <View style={[s.nav, { paddingHorizontal: pad }]}>
        <Image
          source={require('../../../assets/hero-wordmark.svg')}
          style={s.navWordmark}
          contentFit="contain"
        />
        <Pressable
          style={s.navCta}
          onPress={() => router.push('/(auth)/login')}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text style={s.navCtaText}>Sign In</Text>
        </Pressable>
      </View>

      {/* ── HERO ─────────────────────────────────────────── */}
      <View style={s.heroSection}>
        {/* Orbs */}
        <View
          style={[s.orb, { left: '5%', top: '20%', backgroundColor: 'rgba(231,115,51,0.15)' }]}
        />
        <View
          style={[s.orb, { right: '5%', top: '30%', backgroundColor: 'rgba(21,161,171,0.12)' }]}
        />

        {/* Side hero portraits — desktop only */}
        {!isMobile && (
          <>
            <View style={[s.sideCol, { left: pad }]}>
              {SIDE_HEROES.slice(0, 3).map((src, i) => (
                <View
                  key={i}
                  style={[s.sideCard, { transform: [{ rotate: `${i % 2 === 0 ? -6 : 5}deg` }] }]}
                >
                  <Image
                    source={src}
                    style={s.sideCardImg}
                    contentFit="cover"
                    contentPosition="top"
                  />
                </View>
              ))}
            </View>
            <View style={[s.sideCol, { right: pad }]}>
              {SIDE_HEROES.slice(3).map((src, i) => (
                <View
                  key={i}
                  style={[s.sideCard, { transform: [{ rotate: `${i % 2 === 0 ? 6 : -5}deg` }] }]}
                >
                  <Image
                    source={src}
                    style={s.sideCardImg}
                    contentFit="cover"
                    contentPosition="top"
                  />
                </View>
              ))}
            </View>
          </>
        )}

        {/* Centre content */}
        <View style={s.heroContent}>
          <View style={s.heroBadge}>
            <Ionicons name="star" size={12} color={C.yellow} />
            <Text style={s.heroBadgeText}>500+ Heroes &amp; Villains</Text>
          </View>

          <Image
            source={require('../../../assets/hero-wordmark.svg')}
            style={[s.heroWordmark, { width: Math.min(500, width * 0.75) }]}
            contentFit="contain"
          />

          <Text style={[s.heroTagline, isMobile && s.heroTaglineSm]}>
            The Universe's Greatest Heroes
          </Text>
          <Text style={[s.heroSub, isMobile && s.heroSubSm]}>
            Discover the powers, origins, and stories of 500+ characters from Marvel, DC, and
            beyond.
          </Text>

          <View style={[s.ctaRow, isMobile && s.ctaRowMobile]}>
            <Pressable
              style={s.btnPrimary}
              accessibilityRole="button"
              accessibilityLabel="Download on the App Store"
            >
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={s.btnPrimaryText}>App Store</Text>
            </Pressable>
            <Pressable
              style={s.btnSecondary}
              onPress={() => router.push('/(auth)/signup')}
              accessibilityRole="button"
              accessibilityLabel="Try on web"
            >
              <Text style={s.btnSecondaryText}>Try on Web</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── STATS ────────────────────────────────────────── */}
      <View style={[s.statsBar, isMobile && s.statsBarMobile]}>
        {[
          { num: '500+', label: 'Heroes & Villains' },
          { num: 'Marvel & DC', label: 'Universes' },
          { num: 'Free', label: 'To Download' },
          { num: 'iOS & Android', label: 'Platforms' },
        ].map((item, i) => (
          <View key={i} style={[s.statItem, i > 0 && !isMobile && s.statBorder]}>
            <Text style={s.statNum}>{item.num}</Text>
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* ── MARQUEE ──────────────────────────────────────── */}
      <View style={s.marqueeWrap} accessibilityElementsHidden>
        <Animated.Text
          style={[s.marqueeText, { transform: [{ translateX: marqueeAnim }] }]}
          numberOfLines={1}
        >
          {MARQUEE}
          {MARQUEE}
        </Animated.Text>
      </View>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <View style={[s.section, { paddingHorizontal: pad }]}>
        <Text style={s.eyebrow}>What's inside</Text>
        <Text style={[s.heading, isMobile && s.headingSm]}>
          Everything you need to{'\n'}know your heroes
        </Text>
        <Text style={s.sectionSub}>
          From first appearances to power stats — the most complete superhero companion on the
          planet.
        </Text>
        <View style={s.grid}>
          {FEATURES.map((f, i) => (
            <View key={i} style={[s.featureCard, { width: featureW }]}>
              <View style={s.featureIcon}>
                <Ionicons name={f.icon} size={22} color={C.orange} />
              </View>
              <Text style={s.featureTitle}>{f.title}</Text>
              <Text style={s.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── SCREENSHOTS ──────────────────────────────────── */}
      <View style={[s.section, s.sectionSurface, { paddingHorizontal: pad }]}>
        <Text style={s.eyebrow}>The app</Text>
        <Text style={[s.heading, isMobile && s.headingSm]}>Designed for{'\n'}true fans</Text>
        <View style={[s.screenshotsRow, isMobile && { flexDirection: 'column', gap: 32 }]}>
          <View style={s.phonesWrap}>
            <View style={s.phoneMain}>
              <Image
                source={require('../../../assets/images/screenshots/home.PNG')}
                style={s.phoneImg}
                contentFit="cover"
              />
            </View>
            {!isMobile && (
              <View style={[s.phoneSecond, { opacity: 0.8 }]}>
                <Image
                  source={require('../../../assets/images/screenshots/search.PNG')}
                  style={s.phoneImg}
                  contentFit="cover"
                />
              </View>
            )}
          </View>
          <View style={s.screenshotsText}>
            {[
              'Curated hero carousels updated regularly',
              'Detailed character info from trusted sources',
              'Beautiful squircle card artwork',
              'Works offline — your heroes, always available',
            ].map((item, i) => (
              <View key={i} style={s.checkRow}>
                <View style={s.checkCircle}>
                  <Ionicons name="checkmark" size={12} color={C.green} />
                </View>
                <Text style={s.checkText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── MOSAIC ───────────────────────────────────────── */}
      <View style={[s.section, { paddingHorizontal: pad }]}>
        <Text style={s.eyebrow}>The roster</Text>
        <Text style={[s.heading, isMobile && s.headingSm]}>From every universe</Text>
        <Text style={s.sectionSub}>
          Marvel. DC. Dark Horse. If they wear a cape (or don't), we've got them covered.
        </Text>
        <View style={s.grid}>
          {MOSAIC.slice(0, mosaicCols * 2).map((hero, i) => (
            <View key={i} style={[s.mosaicCard, { width: mosaicW, height: mosaicW * 1.5 }]}>
              <Image
                source={hero.src}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="top"
                accessibilityLabel={hero.name}
              />
              <View style={s.mosaicOverlay} />
              <Text style={s.mosaicName}>{hero.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── FINAL CTA ────────────────────────────────────── */}
      <View style={[s.section, s.sectionSurface, s.ctaSection, { paddingHorizontal: pad }]}>
        <Text style={s.eyebrow}>Download now</Text>
        <Text style={[s.ctaHeading, isMobile && s.ctaHeadingSm]}>Your heroes await.</Text>
        <Text style={s.ctaSub}>
          Free to download. No ads. Just the greatest heroes ever created — right in your pocket.
        </Text>
        <View style={[s.ctaRow, isMobile && s.ctaRowMobile]}>
          <Pressable
            style={s.storeBadge}
            accessibilityRole="button"
            accessibilityLabel="Download on the App Store"
          >
            <Ionicons name="logo-apple" size={28} color={C.beige} />
            <View>
              <Text style={s.badgeSmall}>Download on the</Text>
              <Text style={s.badgeLarge}>App Store</Text>
            </View>
          </Pressable>
          <Pressable
            style={s.storeBadge}
            accessibilityRole="button"
            accessibilityLabel="Get it on Google Play"
          >
            <Ionicons name="logo-google-playstore" size={28} color={C.beige} />
            <View>
              <Text style={s.badgeSmall}>Get it on</Text>
              <Text style={s.badgeLarge}>Google Play</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <View style={[s.footer, { paddingHorizontal: pad }]}>
        <Image
          source={require('../../../assets/hero-wordmark.svg')}
          style={s.footerWordmark}
          contentFit="contain"
        />
        <Text style={s.footerText}>© 2025 Hero App. All rights reserved.</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flexGrow: 1 },

  // Nav
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    backgroundColor: C.bg,
    zIndex: 10,
  },
  navWordmark: { width: 120, height: 28 },
  navCta: {
    backgroundColor: C.orange,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
  },
  navCtaText: { color: '#fff', fontFamily: 'Righteous_400Regular', fontSize: 14 },

  // Hero section
  heroSection: {
    minHeight: 680,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  sideCol: {
    position: 'absolute',
    top: 60,
    gap: 14,
    alignItems: 'center',
  },
  sideCard: {
    width: 110,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  sideCardImg: { width: '100%', height: '100%' },

  heroContent: { alignItems: 'center', zIndex: 2, paddingHorizontal: 24 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,178,34,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,178,34,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 28,
  },
  heroBadgeText: { color: C.yellow, fontSize: 12, fontWeight: '600', letterSpacing: 1 },
  heroWordmark: { height: 130, marginBottom: 20 },
  heroTagline: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 22,
    color: C.muted,
    marginBottom: 12,
  },
  heroTaglineSm: { fontSize: 17 },
  heroSub: {
    fontSize: 17,
    color: C.muted,
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 460,
    marginBottom: 36,
  },
  heroSubSm: { fontSize: 15 },

  ctaRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center' },
  ctaRowMobile: { flexDirection: 'column', alignItems: 'center' },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.orange,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 100,
  },
  btnPrimaryText: { color: '#fff', fontFamily: 'Righteous_400Regular', fontSize: 16 },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 100,
  },
  btnSecondaryText: { color: C.beige, fontFamily: 'Righteous_400Regular', fontSize: 16 },

  // Stats
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingVertical: 24,
  },
  statsBarMobile: { flexWrap: 'wrap', gap: 20, paddingHorizontal: 20 },
  statItem: { alignItems: 'center', paddingHorizontal: 40 },
  statBorder: { borderLeftWidth: 1, borderColor: C.border },
  statNum: { fontFamily: 'Righteous_400Regular', fontSize: 28, color: C.yellow },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 4 },

  // Marquee
  marqueeWrap: {
    overflow: 'hidden',
    backgroundColor: C.orange,
    paddingVertical: 14,
  },
  marqueeText: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 14,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
  },

  // Sections
  section: {
    paddingVertical: 88,
    backgroundColor: C.bg,
  },
  sectionSurface: { backgroundColor: C.surface },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: C.orange,
    marginBottom: 14,
  },
  heading: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 40,
    color: C.beige,
    lineHeight: 48,
    marginBottom: 16,
  },
  headingSm: { fontSize: 28, lineHeight: 36 },
  sectionSub: { fontSize: 16, color: C.muted, lineHeight: 26, maxWidth: 520, marginBottom: 52 },

  // Feature grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  featureCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 28,
  },
  featureIcon: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(231,115,51,0.12)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  featureTitle: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 17,
    color: C.beige,
    marginBottom: 10,
  },
  featureDesc: { fontSize: 14, color: C.muted, lineHeight: 22 },

  // Screenshots
  screenshotsRow: { flexDirection: 'row', gap: 48, alignItems: 'center', marginTop: 8 },
  phonesWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: -20 },
  phoneMain: {
    width: 210,
    height: 420,
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 48,
    transform: [{ rotate: '-3deg' }],
    zIndex: 2,
  },
  phoneSecond: {
    width: 180,
    height: 360,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.08)',
    transform: [{ rotate: '5deg' }, { translateX: -20 }],
  },
  phoneImg: { width: '100%', height: '100%' },
  screenshotsText: { flex: 1, gap: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(99,169,54,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkText: { flex: 1, fontSize: 15, color: C.beige, lineHeight: 24 },

  // Mosaic
  mosaicCard: { borderRadius: 14, overflow: 'hidden' },
  mosaicOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,24,32,0.35)',
  },
  mosaicName: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Righteous_400Regular',
    fontSize: 12,
    color: C.beige,
    letterSpacing: 0.5,
  },

  // Final CTA
  ctaSection: { alignItems: 'center', textAlign: 'center' },
  ctaHeading: {
    fontFamily: 'Righteous_400Regular',
    fontSize: 56,
    color: C.orange,
    lineHeight: 64,
    marginBottom: 16,
    textAlign: 'center',
  },
  ctaHeadingSm: { fontSize: 36, lineHeight: 44 },
  ctaSub: {
    fontSize: 17,
    color: C.muted,
    lineHeight: 28,
    textAlign: 'center',
    maxWidth: 480,
    marginBottom: 36,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 160,
  },
  badgeSmall: { fontSize: 10, color: C.muted, letterSpacing: 0.5 },
  badgeLarge: { fontFamily: 'Righteous_400Regular', fontSize: 16, color: C.beige },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 32,
    borderTopWidth: 1,
    borderColor: C.border,
    flexWrap: 'wrap',
    gap: 12,
  },
  footerWordmark: { width: 100, height: 22, opacity: 0.6 },
  footerText: { fontSize: 13, color: C.muted },
});
