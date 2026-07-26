// src/components/home/TrendingMovers.tsx
// "Biggest Movers" as a momentum race: each surging hero rides an orange energy
// lane whose length tracks their week-over-week spike — longer lane = bigger
// mover, read at a glance. Boxed in lighter-navy glass for variation against the
// bare rails in the dark "Right Now" band. Native sibling of the web module.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { HeroImage } from '../HeroImage';
import { HeroAvatar } from '../HeroAvatar';
import { COLORS } from '../../constants/colors';
import type { WikiTrendingHero } from '../../lib/db/trending';

export function TrendingMovers({
  heroes,
  onHeroPress,
}: {
  heroes: WikiTrendingHero[];
  onHeroPress: (id: string) => void;
}) {
  if (heroes.length === 0) return null;
  const list = heroes.slice(0, 5);
  const max = Math.max(...list.map((h) => h.spikePct), 1);

  return (
    <View style={s.section}>
      <View style={s.head}>
        <Text style={s.kicker}>This Week · On the Rise</Text>
        <Text style={s.title}>Biggest Movers</Text>
      </View>

      {list.map((h, i) => {
        const lead = i === 0;
        const pct = (h.spikePct / max) * 100;
        return (
          <Pressable
            key={h.id}
            onPress={() => onHeroPress(h.id)}
            style={({ pressed }) => [s.row, pressed && s.rowPressed]}
          >
            <Text style={s.rank}>{i + 1}</Text>
            <View style={[s.face, lead && s.faceLead, h.avatar_url && s.faceBare]}>
              {/* A head needs no disc behind it; the crop does, to read as a
                  face at all. */}
              {h.avatar_url ? (
                <HeroAvatar id={h.id} name={h.name} avatarUrl={h.avatar_url} size={FACE} bare />
              ) : (
                <HeroImage
                  id={h.id}
                  name={h.name}
                  imageUrl={h.image_url}
                  portraitUrl={h.portrait_url}
                  grid
                  contentFit="cover"
                  contentPosition={{ top: 0, left: '50%' }}
                  style={StyleSheet.absoluteFill as object}
                  recyclingKey={h.id}
                />
              )}
            </View>
            <Text style={s.name} numberOfLines={1}>
              {h.name}
            </Text>
            {/* The race lane — fill length encodes the spike against the week's
                top mover; brighter at the leading edge reads as energy/speed. */}
            <View style={s.lane}>
              <LinearGradient
                colors={['rgba(231,115,51,0.4)', COLORS.orange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.fill, { width: `${pct}%` }]}
              />
            </View>
            <View style={s.spike}>
              <Ionicons name="caret-up" size={11} color={COLORS.orange} />
              <Text style={s.spikeText}>{h.spikePct}%</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const FACE = 34;

const s = StyleSheet.create({
  // Lighter-navy glass panel (matches the pods) so the band alternates contained
  // panels with the bare full-width rails around it.
  section: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  head: { marginBottom: 14 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 2,
  },
  title: { fontFamily: 'Flame-Regular', fontSize: 24, color: COLORS.beige, lineHeight: 28 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rowPressed: { opacity: 0.6 },
  rank: {
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    lineHeight: 18,
    color: 'rgba(245,235,220,0.35)',
    width: 14,
    textAlign: 'center',
  },
  // Fill dropped — a head needs no plate — but the ring stays: it carries
  // rank. HeroAvatar renders a sized image, so the slot must centre it.
  faceBare: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  } as object,
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: 'rgba(231,115,51,0.45)',
  },
  faceLead: { borderColor: COLORS.orange },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    lineHeight: 17,
    color: COLORS.beige,
    width: 76,
  },
  lane: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(245,235,220,0.07)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { height: 12, borderRadius: 6 },
  spike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 46,
    justifyContent: 'flex-end',
  },
  spikeText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.orange },
});
