import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getHeroById, heroRowToCharacterData } from '../../../src/lib/db/heroes';
import { fetchHeroStats } from '../../../src/lib/api';
import { heroImageSource } from '../../../src/constants/heroImages';
import { compareStats } from '../../../src/lib/compare';
import type { StatResult } from '../../../src/lib/compare';
import type { HeroStats } from '../../../src/types';
import { COLORS } from '../../../src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PORTRAIT_HEIGHT = Math.round(SCREEN_WIDTH * 0.72);

async function loadHeroStats(id: string): Promise<HeroStats> {
  const row = await getHeroById(id);
  if (row) return heroRowToCharacterData(row).stats;
  return fetchHeroStats(id);
}

function StatBattleRow({ stat }: { stat: StatResult }) {
  const aWins = stat.winner === 'A';
  const bWins = stat.winner === 'B';
  const winColor = stat.color;
  const dimColor = 'rgba(41,60,67,0.18)';

  return (
    <View style={battle.row}>
      {/* Left value + bar */}
      <View style={battle.side}>
        <Text style={[battle.val, aWins && battle.valWin]}>{stat.valueA}</Text>
        <View style={battle.track}>
          <View
            style={[
              battle.barLeft,
              { width: `${stat.valueA}%` as unknown as number, backgroundColor: aWins ? winColor : dimColor },
            ]}
          />
        </View>
      </View>

      {/* Stat label in center */}
      <Text style={battle.label}>{stat.label}</Text>

      {/* Right bar + value */}
      <View style={[battle.side, battle.sideRight]}>
        <View style={battle.track}>
          <View
            style={[
              battle.barRight,
              { width: `${stat.valueB}%` as unknown as number, backgroundColor: bWins ? winColor : dimColor },
            ]}
          />
        </View>
        <Text style={[battle.val, bWins && battle.valWin]}>{stat.valueB}</Text>
      </View>
    </View>
  );
}

export default function NativeCompareScreen() {
  const { id1, id2 } = useLocalSearchParams<{ id1: string; id2: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [statsA, setStatsA] = useState<HeroStats | null>(null);
  const [statsB, setStatsB] = useState<HeroStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadHeroStats(id1), loadHeroStats(id2)])
      .then(([a, b]) => { setStatsA(a); setStatsB(b); })
      .catch(() => setError('Could not load hero data.'));
  }, [id1, id2]);

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.retryBtn}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!statsA || !statsB) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.orange} size="large" />
      </View>
    );
  }

  const result = compareStats(statsA.name, statsA.powerstats, statsB.name, statsB.powerstats);
  const imageA = heroImageSource(id1, statsA.image.url);
  const imageB = heroImageSource(id2, statsB.image.url);

  const handleShare = () => {
    Share.share({
      message: `${statsA.name} vs ${statsB.name} — ${result.verdict}. Check it out on Hero app!`,
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Back + Share header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.beige} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>vs</Text>
        <TouchableOpacity onPress={handleShare} activeOpacity={0.7} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={20} color={COLORS.beige} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Portrait cards — side by side, full width */}
        <View style={styles.portraits}>
          <View style={styles.portraitWrap}>
            <Image source={imageA} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
            <View style={styles.portraitOverlay} />
            <Text style={styles.portraitName} numberOfLines={2}>{statsA.name}</Text>
          </View>
          <View style={styles.portraitWrap}>
            <Image source={imageB} contentFit="cover" contentPosition="top" style={StyleSheet.absoluteFill} />
            <View style={styles.portraitOverlay} />
            <Text style={[styles.portraitName, styles.portraitNameRight]} numberOfLines={2}>{statsB.name}</Text>
          </View>
        </View>

        {/* Verdict */}
        <View style={styles.verdictWrap}>
          <Text style={styles.verdict}>{result.verdict}</Text>
        </View>

        {/* Stat battle */}
        <View style={styles.battleWrap}>
          {result.stats.map((stat) => (
            <StatBattleRow key={stat.key} stat={stat} />
          ))}
        </View>

        {/* Compare another */}
        <TouchableOpacity
          onPress={() => router.push(`/compare/${id1}/pick?name=${encodeURIComponent(statsA.name)}`)}
          activeOpacity={0.8}
          style={styles.compareAnotherBtn}
        >
          <Text style={styles.compareAnotherText}>Compare {statsA.name} with someone else →</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { fontFamily: 'Nunito_400Regular', fontSize: 15, color: COLORS.navy },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.orange },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: { padding: 6 },
  topBarTitle: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  portraits: { flexDirection: 'row', height: PORTRAIT_HEIGHT },
  portraitWrap: { flex: 1, overflow: 'hidden' },
  portraitOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(29,45,51,0.28)',
  },
  portraitName: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 6,
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: COLORS.beige,
    lineHeight: 21,
  },
  portraitNameRight: { left: 6, right: 12, textAlign: 'right' },
  verdictWrap: {
    backgroundColor: COLORS.navy,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  verdict: {
    fontFamily: 'Flame-Regular',
    fontSize: 20,
    color: COLORS.beige,
    textAlign: 'center',
    lineHeight: 26,
  },
  battleWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  compareAnotherBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 32,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },
  compareAnotherText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(245,235,220,0.65)',
    letterSpacing: 0.3,
  },
  scrollContent: { paddingBottom: 0 },
});

const battle = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sideRight: { flexDirection: 'row-reverse' },
  val: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: 'rgba(41,60,67,0.35)',
    width: 26,
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
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  barRight: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  label: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    color: COLORS.grey,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    width: 80,
    textAlign: 'center',
    flexShrink: 0,
  },
});
