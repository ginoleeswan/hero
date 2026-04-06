import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getHeroById, heroRowToCharacterData } from '../../../src/lib/db/heroes';
import { fetchHeroStats, generateVerdict } from '../../../src/lib/api';
import { heroImageSource } from '../../../src/constants/heroImages';
import { compareStats } from '../../../src/lib/compare';
import type { StatResult } from '../../../src/lib/compare';
import type { HeroStats } from '../../../src/types';
import { COLORS } from '../../../src/constants/colors';

async function loadHeroStats(id: string): Promise<HeroStats> {
  const row = await getHeroById(id);
  if (row?.enriched_at) return heroRowToCharacterData(row).stats;
  return fetchHeroStats(id);
}

function StatBattleRow({ stat, isDesktop }: { stat: StatResult; isDesktop: boolean }) {
  const aWins = stat.winner === 'A';
  const bWins = stat.winner === 'B';
  const winColor = stat.color;
  const dimColor = 'rgba(245,235,220,0.12)';

  return (
    <View style={wb.row}>
      <View style={wb.side}>
        <Text style={[wb.val, aWins && wb.valWin]}>{stat.valueA}</Text>
        <View style={wb.track}>
          <View
            style={[wb.barLeft, { width: `${stat.valueA}%`, backgroundColor: aWins ? winColor : dimColor }] as object}
          />
        </View>
      </View>

      <Text style={[wb.label, isDesktop && (wb.labelDesktop as object)] as object}>{stat.label}</Text>

      <View style={[wb.side, wb.sideRight]}>
        <View style={wb.track}>
          <View
            style={[wb.barRight, { width: `${stat.valueB}%`, backgroundColor: bWins ? winColor : dimColor }] as object}
          />
        </View>
        <Text style={[wb.val, bWins && wb.valWin]}>{stat.valueB}</Text>
      </View>
    </View>
  );
}

export default function WebCompareScreen() {
  const { hero, opponent } = useLocalSearchParams<{ hero: string; opponent: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [statsA, setStatsA] = useState<HeroStats | null>(null);
  const [statsB, setStatsB] = useState<HeroStats | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(t); }, []);

  useEffect(() => {
    if (!hero || !opponent) {
      setError('Invalid hero IDs.');
      return;
    }
    Promise.all([loadHeroStats(hero), loadHeroStats(opponent)])
      .then(([a, b]) => {
        setStatsA(a);
        setStatsB(b);
        const result = compareStats(a.name, a.powerstats, b.name, b.powerstats);
        const psA = Object.fromEntries(Object.entries(a.powerstats).map(([k, v]) => [k, parseInt(v, 10) || 0]));
        const psB = Object.fromEntries(Object.entries(b.powerstats).map(([k, v]) => [k, parseInt(v, 10) || 0]));
        generateVerdict({ heroA: a.name, heroB: b.name, winsA: result.winsA, winsB: result.winsB, statsA: psA, statsB: psB }).then(setVerdict);
      })
      .catch(() => setError('Could not load hero data.'));
  }, [hero, opponent]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (!statsA || !statsB) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  const result = compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats);
  const imageA = heroImageSource(hero, statsA.image.url);
  const imageB = heroImageSource(opponent, statsB.image.url);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = { title: `${statsA.name} vs ${statsB.name}`, url };
    try {
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user cancelled or API unavailable — silent
    }
  };

  const portraitHeight = isDesktop ? 520 : 260;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.contentOuter}>

      {/* Sub-header */}
      <View style={styles.subHeader as object}>
        <View style={styles.subHeaderInner}>
          <Pressable
            onPress={() => router.back()}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.backBtn, hovered && (styles.backBtnHover as object)] as object
            }
          >
            <Ionicons name="arrow-back" size={15} color={COLORS.beige} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.subTitle}>
            {statsA.name} <Text style={styles.vs}>vs</Text> {statsB.name}
          </Text>

          <Pressable
            onPress={handleShare}
            style={({ hovered }: { hovered?: boolean }) =>
              [styles.shareBtn, hovered && (styles.shareBtnHover as object)] as object
            }
          >
            <Ionicons name="share-outline" size={15} color={COLORS.beige} />
            <Text style={styles.shareText}>{copied ? 'Copied!' : 'Share'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {isDesktop ? (
          /* Desktop: side-by-side portrait panels + center stat column */
          <View style={styles.desktopLayout as object}>
            {/* Hero A portrait */}
            <View style={[styles.portraitWrap, { height: portraitHeight }, { opacity: mounted ? 1 : 0, transform: [{ translateX: mounted ? 0 : -60 }], transition: 'opacity 0.45s ease-out, transform 0.45s cubic-bezier(0.22,1,0.36,1)' } as object]}>
              <Image
                source={imageA}
                contentFit="cover"
                contentPosition="top"
                style={styles.portraitImage as object}
              />
              <View style={styles.portraitOverlay as object} />
              <View style={styles.portraitLabel}>
                {statsA.biography.publisher ? (
                  <Text style={styles.publisher}>{statsA.biography.publisher}</Text>
                ) : null}
                <Text style={styles.heroNameLarge as object}>{statsA.name}</Text>
                <Text style={styles.winsLabel}>{result.winsA} stat{result.winsA !== 1 ? 's' : ''}</Text>
              </View>
            </View>

            {/* Center: verdict + stat battle */}
            <View style={styles.centerCol}>
              <View style={styles.verdictCard}>
                {verdict ? (
                  <Text style={styles.verdictText}>{verdict}</Text>
                ) : (
                  <View style={{ gap: 6 }}>
                    <View style={[styles.shimmer, { width: '85%' }] as object} />
                    <View style={[styles.shimmer, { width: '55%', alignSelf: 'center' }] as object} />
                  </View>
                )}
              </View>
              <View style={styles.battleRows}>
                {result.stats.map((stat) => (
                  <StatBattleRow key={stat.key} stat={stat} isDesktop={isDesktop} />
                ))}
              </View>
              <Pressable
                onPress={() => router.push(`/compare/${hero}/pick?name=${encodeURIComponent(statsA.name)}`)}
                style={({ hovered }: { hovered?: boolean }) =>
                  [styles.compareAnotherBtn, hovered && (styles.compareAnotherHover as object)] as object
                }
              >
                <Text style={styles.compareAnotherText}>Compare someone else →</Text>
              </Pressable>
            </View>

            {/* Hero B portrait */}
            <View style={[styles.portraitWrap, { height: portraitHeight }, { opacity: mounted ? 1 : 0, transform: [{ translateX: mounted ? 0 : 60 }], transition: 'opacity 0.45s ease-out, transform 0.45s cubic-bezier(0.22,1,0.36,1)' } as object]}>
              <Image
                source={imageB}
                contentFit="cover"
                contentPosition="top"
                style={[styles.portraitImage as object, { transform: [{ scaleX: -1 }] }]}
              />
              <View style={styles.portraitOverlay as object} />
              <View style={[styles.portraitLabel, styles.portraitLabelRight]}>
                {statsB.biography.publisher ? (
                  <Text style={styles.publisher}>{statsB.biography.publisher}</Text>
                ) : null}
                <Text style={[styles.heroNameLarge, styles.textRight] as object}>{statsB.name}</Text>
                <Text style={[styles.winsLabel, styles.textRight]}>{result.winsB} stat{result.winsB !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
        ) : (
          /* Mobile: stacked */
          <View>
            <View style={styles.mobilePortraits}>
              <View style={[styles.mobilePortraitWrap, { height: portraitHeight }]}>
                <Image source={imageA} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
                <View style={styles.portraitOverlay as object} />
                <Text style={styles.mobilePortraitName}>{statsA.name}</Text>
                <Text style={styles.mobileWinsLabel}>{result.winsA} stat{result.winsA !== 1 ? 's' : ''}</Text>
              </View>
              <View style={[styles.mobilePortraitWrap, { height: portraitHeight }]}>
                <Image source={imageB} contentFit="cover" contentPosition="top" style={[StyleSheet.absoluteFill, { transform: [{ scaleX: -1 }] }]} />
                <View style={styles.portraitOverlay as object} />
                <Text style={[styles.mobilePortraitName, styles.textRight]}>{statsB.name}</Text>
                <Text style={[styles.mobileWinsLabel, styles.textRight]}>{result.winsB} stat{result.winsB !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={styles.verdictCard}>
              <Text style={styles.verdictText}>{result.verdict}</Text>
            </View>
            <View style={styles.battleRows}>
              {result.stats.map((stat) => (
                <StatBattleRow key={stat.key} stat={stat} isDesktop={false} />
              ))}
            </View>
            <Pressable
              onPress={() => router.push(`/compare/${hero}/pick?name=${encodeURIComponent(statsA.name)}`)}
              style={({ hovered }: { hovered?: boolean }) =>
                [styles.compareAnotherBtn, styles.compareAnotherBtnMobile, hovered && (styles.compareAnotherHover as object)] as object
              }
            >
              <Text style={styles.compareAnotherText}>Compare someone else →</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.beige },
  contentOuter: { paddingBottom: 80 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },

  subHeader: {
    position: 'sticky',
    zIndex: 50,
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,235,220,0.08)',
    paddingVertical: 12,
  } as object,
  subHeaderInner: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    cursor: 'pointer',
  } as object,
  backBtnHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  backText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(245,235,220,0.65)' },
  subTitle: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  vs: { color: COLORS.orange },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    cursor: 'pointer',
  } as object,
  shareBtnHover: { backgroundColor: 'rgba(245,235,220,0.08)' } as object,
  shareText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(245,235,220,0.65)' },

  body: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  desktopLayout: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  } as object,

  portraitWrap: {
    flex: 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
  },
  portraitImage: {
    width: '100%',
    height: '100%',
  } as object,
  portraitOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundImage:
      'linear-gradient(to top, rgba(29,45,51,0.95) 0%, rgba(29,45,51,0.3) 50%, transparent 100%)',
  } as object,
  portraitLabel: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  portraitLabelRight: { alignItems: 'flex-end' },
  publisher: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.orange,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  heroNameLarge: {
    fontFamily: 'Flame-Regular',
    fontSize: 32,
    color: COLORS.beige,
    lineHeight: 34,
    marginBottom: 6,
    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
  } as object,
  winsLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: 'rgba(245,235,220,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  centerCol: { flex: 2, gap: 16, minWidth: 220 },
  verdictCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    padding: 20,
    marginBottom: 4,
  },
  shimmer: {
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(245,235,220,0.1)',
    animation: 'pulse 1.4s ease-in-out infinite',
  } as object,
  verdictText: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 24,
  },
  battleRows: { gap: 8 },
  compareAnotherBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(41,60,67,0.2)',
    alignItems: 'center',
    cursor: 'pointer',
    marginTop: 4,
  } as object,
  compareAnotherBtnMobile: {
    marginTop: 16,
    marginBottom: 8,
  },
  compareAnotherHover: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
  compareAnotherText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: COLORS.navy,
    opacity: 0.5,
    letterSpacing: 0.3,
  },

  mobilePortraits: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  mobilePortraitWrap: { flex: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.navy },
  mobilePortraitName: {
    position: 'absolute',
    bottom: 24,
    left: 10,
    right: 6,
    fontFamily: 'Flame-Regular',
    fontSize: 16,
    color: COLORS.beige,
    lineHeight: 19,
  },
  mobileWinsLabel: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 6,
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: 'rgba(245,235,220,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textRight: { textAlign: 'right' },
});

const wb = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideRight: { flexDirection: 'row-reverse' },
  val: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(41,60,67,0.3)',
    width: 24,
    textAlign: 'center',
    flexShrink: 0,
  },
  valWin: { color: COLORS.navy },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barLeft: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0,
    borderRadius: 4,
  },
  barRight: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    borderRadius: 4,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    width: 68,
    textAlign: 'center',
    flexShrink: 0,
  },
  labelDesktop: { width: 90, fontSize: 10 } as object,
});
