// src/components/compare/ShareableMatchupCard.tsx — the VS "poster" the app draws
// for sharing. This is NOT an AI image: it's a normal styled view (portraits,
// names, winner, crowd split, verdict, wordmark) rendered at a fixed 1080×1080 so
// it can be snapshotted to a PNG (react-native-view-shot on native, html-to-image
// on web). Kept visually self-contained and dimension-locked so the captured
// image looks identical regardless of the device that produced it.
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHARE_CARD, INK_TEXT } from '../../constants/colors';
import { MythiqueMark } from '../ui/MythiqueMark';
import { SITE_DOMAIN } from '../../lib/share';
import { CardTexture } from '../ui/CardTexture';

const BG_COLORS = SHARE_CARD.bg.map((s) => s.color) as [string, string, string];
const BG_LOCATIONS = SHARE_CARD.bg.map((s) => s.at) as [number, number, number];

export const SHARE_CARD_SIZE = 1080;

export interface ShareableMatchupCardProps {
  nameA: string;
  nameB: string;
  imageA: { uri: string } | null;
  imageB: { uri: string } | null;
  winner: 'A' | 'B' | 'tie';
  verdict: string | null;
  pctA: number;
  pctB: number;
  /** e.g. "1,204 fans voted" or "Superman leads 4–2 on stats". */
  caption: string;
}

function Side({
  name,
  image,
  state,
  align,
}: {
  name: string;
  image: { uri: string } | null;
  state: 'win' | 'loss' | 'tie';
  align: 'left' | 'right';
}) {
  return (
    <View style={[s.side, state === 'win' && s.sideWin]}>
      {image?.uri ? (
        <Image
          source={image}
          contentFit="cover"
          contentPosition="top"
          style={[s.portrait, align === 'right' && s.mirror, state === 'loss' && s.dim]}
        />
      ) : (
        <View style={[s.portrait, s.portraitFallback]}>
          <Text style={s.fallbackInitial}>{name.charAt(0)}</Text>
        </View>
      )}
      <View style={s.portraitScrim} />
      {state === 'win' && (
        <View style={s.crown}>
          <Text style={s.crownText}>WINNER</Text>
        </View>
      )}
      <Text
        style={[s.name, state === 'loss' && s.nameDim]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {name}
      </Text>
    </View>
  );
}

export function ShareableMatchupCard({
  nameA,
  nameB,
  imageA,
  imageB,
  winner,
  verdict,
  pctA,
  pctB,
  caption,
}: ShareableMatchupCardProps) {
  const stateA = winner === 'tie' ? 'tie' : winner === 'A' ? 'win' : 'loss';
  const stateB = winner === 'tie' ? 'tie' : winner === 'B' ? 'win' : 'loss';

  return (
    <View style={s.root}>
      <LinearGradient colors={BG_COLORS} locations={BG_LOCATIONS} style={StyleSheet.absoluteFill} />
      <CardTexture size={SHARE_CARD_SIZE} glow={SHARE_CARD.accent} />
      <View style={s.header}>
        <MythiqueMark height={50} color={SHARE_CARD.accent} />
        <Text style={s.wordmark}>mythique</Text>
        <Text style={s.eyebrow}>WHO WOULD WIN?</Text>
      </View>

      <View style={s.stage}>
        <Side name={nameA} image={imageA} state={stateA} align="left" />
        <View style={s.vsBadge}>
          <Text style={s.vsText}>VS</Text>
        </View>
        <Side name={nameB} image={imageB} state={stateB} align="right" />
      </View>

      <View style={s.footer}>
        <View style={s.barTrack}>
          <View style={[s.barFillA, { flex: Math.max(pctA, 1) }]} />
          <View style={[s.barFillB, { flex: Math.max(pctB, 1) }]} />
        </View>
        <View style={s.barLabels}>
          <Text style={[s.pct, { color: COLORS.orange }]}>{pctA}%</Text>
          <Text style={s.caption}>{caption}</Text>
          <Text style={[s.pct, { color: COLORS.blue }]}>{pctB}%</Text>
        </View>
        {verdict ? (
          <Text style={s.verdict} numberOfLines={2}>
            {`“${verdict}”`}
          </Text>
        ) : null}
        <Text style={s.cta}>{`Settle the debate · ${SITE_DOMAIN}`}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    width: SHARE_CARD_SIZE,
    height: SHARE_CARD_SIZE,
    backgroundColor: SHARE_CARD.ink,
    paddingHorizontal: 56,
    paddingTop: 56,
    paddingBottom: 56,
    justifyContent: 'space-between',
  },
  header: { alignItems: 'center', gap: 14 },
  wordmark: {
    fontFamily: SHARE_CARD.wordmarkFamilyRN,
    fontSize: 56,
    letterSpacing: -1,
    color: COLORS.beige,
  },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 26,
    letterSpacing: 8,
    color: SHARE_CARD.accent,
  },

  stage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  side: {
    flex: 1,
    height: 560,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    justifyContent: 'flex-end',
  },
  sideWin: {
    boxShadow: '0 0 0 6px rgba(206,155,51,0.95), 0 0 120px rgba(206,155,51,0.45)',
  } as object,
  portrait: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as object,
  mirror: { transform: [{ scaleX: -1 }] },
  dim: { opacity: 0.55 } as object,
  portraitFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#243842' },
  fallbackInitial: { fontFamily: 'Flame-Regular', fontSize: 200, color: INK_TEXT.faint },
  portraitScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 280,
    backgroundImage: 'linear-gradient(to top, rgba(10,16,20,0.92) 0%, transparent 100%)',
  } as object,
  crown: {
    position: 'absolute',
    top: 28,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(14,20,24,0.78)',
    borderWidth: 2,
    borderColor: COLORS.goldAccent,
  },
  crownText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 22,
    letterSpacing: 4,
    color: COLORS.goldAccent,
  },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 50,
    color: COLORS.beige,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
    textShadow: '0 4px 20px rgba(0,0,0,0.8)',
  } as object,
  nameDim: { color: 'rgba(245,235,220,0.6)' },
  vsBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginHorizontal: -34,
    zIndex: 2,
    backgroundColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: SHARE_CARD.ink,
  },
  vsText: { fontFamily: 'Flame-Regular', fontSize: 46, color: '#fff' },

  footer: { gap: 22, marginTop: 40 },
  barTrack: {
    flexDirection: 'row',
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: 'rgba(245,235,220,0.12)',
  },
  barFillA: { backgroundColor: COLORS.orange },
  barFillB: { backgroundColor: COLORS.blue },
  barLabels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pct: { fontFamily: 'Flame-Regular', fontSize: 40 },
  caption: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 22,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(245,235,220,0.6)',
  },
  verdict: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 30,
    fontStyle: 'italic',
    lineHeight: 42,
    textAlign: 'center',
    color: 'rgba(245,235,220,0.85)',
  },
  cta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 22,
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: INK_TEXT.faint,
  },
});
