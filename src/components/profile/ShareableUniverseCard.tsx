// src/components/profile/ShareableUniverseCard.tsx — the "My Universe" poster the
// app draws for sharing. Like ShareableMatchupCard, this is a normal styled view
// (avatar, name, top favourites, taste, badges, wordmark) rendered at a fixed
// 1080×1080 so it snapshots to a PNG (react-native-view-shot on native; the
// .web sibling redraws it via canvas because RN-web snapshots render blank).
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SHARE_CARD } from '../../constants/colors';
import { MythiqueMark } from '../ui/MythiqueMark';
import { CardTexture } from '../ui/CardTexture';

const BG_COLORS = SHARE_CARD.bg.map((s) => s.color) as [string, string, string];
const BG_LOCATIONS = SHARE_CARD.bg.map((s) => s.at) as [number, number, number];

export const UNIVERSE_CARD_SIZE = 1080;

export interface UniverseHero {
  name: string;
  uri: string | null;
}

export interface ShareableUniverseCardProps {
  displayName: string;
  avatarUri: string | null;
  /** e.g. "Hero-leaning · Marvel", may be empty. */
  insight: string;
  chips: string[];
  /** Up to 3 top favourites shown as portrait tiles. */
  topHeroes: UniverseHero[];
  savedCount: number;
  badgesEarned: number;
}

function HeroTile({ hero }: { hero: UniverseHero }) {
  return (
    <View style={s.tile}>
      {hero.uri ? (
        <Image
          source={{ uri: hero.uri }}
          contentFit="cover"
          contentPosition="top"
          style={s.tileImg}
        />
      ) : (
        <View style={[s.tileImg, s.tileFallback]}>
          <Text style={s.tileInitial}>{hero.name.charAt(0)}</Text>
        </View>
      )}
      <View style={s.tileScrim} />
      <Text style={s.tileName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {hero.name}
      </Text>
    </View>
  );
}

export function ShareableUniverseCard({
  displayName,
  avatarUri,
  insight,
  chips,
  topHeroes,
  savedCount,
  badgesEarned,
}: ShareableUniverseCardProps) {
  return (
    <View style={s.root}>
      <LinearGradient colors={BG_COLORS} locations={BG_LOCATIONS} style={StyleSheet.absoluteFill} />
      <CardTexture size={UNIVERSE_CARD_SIZE} glow={SHARE_CARD.accent} />
      <View style={s.header}>
        <MythiqueMark height={50} color={SHARE_CARD.accent} />
        <Text style={s.wordmark}>mythique</Text>
        <Text style={s.eyebrow}>MY UNIVERSE</Text>
      </View>

      <View style={s.identity}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} contentFit="cover" style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitials}>{displayName.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={s.identityText}>
          <Text style={s.name} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {displayName}
          </Text>
          <Text style={s.stats}>
            {savedCount} saved · {badgesEarned} badges
          </Text>
        </View>
      </View>

      {topHeroes.length > 0 && (
        <View style={s.tiles}>
          {topHeroes.slice(0, 3).map((h, i) => (
            <HeroTile key={`${h.name}-${i}`} hero={h} />
          ))}
        </View>
      )}

      <View style={s.footer}>
        {!!insight && <Text style={s.insight}>{insight}</Text>}
        {chips.length > 0 && (
          <View style={s.chipRow}>
            {chips.slice(0, 6).map((c, i) => (
              <View key={`${c}-${i}`} style={s.chip}>
                <Text style={s.chipText}>{c}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={s.cta}>Discover yours · mythique</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    width: UNIVERSE_CARD_SIZE,
    height: UNIVERSE_CARD_SIZE,
    backgroundColor: SHARE_CARD.ink,
    paddingHorizontal: 64,
    paddingTop: 64,
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
    letterSpacing: 10,
    color: SHARE_CARD.accent,
  },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 5,
    borderColor: SHARE_CARD.accent,
  } as object,
  avatarFallback: {
    backgroundColor: '#1b2a30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontFamily: 'Flame-Regular', fontSize: 64, color: COLORS.beige },
  identityText: { flex: 1, gap: 8 },
  name: { fontFamily: 'Flame-Regular', fontSize: 64, color: COLORS.beige },
  stats: { fontFamily: 'Nunito_700Bold', fontSize: 30, color: 'rgba(245,235,220,0.6)' },

  tiles: { flexDirection: 'row', gap: 24 },
  tile: {
    flex: 1,
    height: 400,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#1b2a30',
    justifyContent: 'flex-end',
  },
  tileImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' } as object,
  tileFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#243842' },
  tileInitial: { fontFamily: 'Flame-Regular', fontSize: 140, color: 'rgba(245,235,220,0.5)' },
  tileScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
    backgroundImage: 'linear-gradient(to top, rgba(10,16,20,0.92) 0%, transparent 100%)',
  } as object,
  tileName: {
    fontFamily: 'Flame-Regular',
    fontSize: 34,
    color: COLORS.beige,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingBottom: 24,
    textShadow: '0 4px 16px rgba(0,0,0,0.8)',
  } as object,

  footer: { gap: 24 },
  insight: {
    fontFamily: 'Flame-Regular',
    fontSize: 40,
    color: COLORS.beige,
    textAlign: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  chip: {
    backgroundColor: 'rgba(245,235,220,0.12)',
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 14,
  },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 26, color: COLORS.beige },
  cta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 24,
    letterSpacing: 3,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: 'rgba(245,235,220,0.4)',
    marginTop: 8,
  },
});
