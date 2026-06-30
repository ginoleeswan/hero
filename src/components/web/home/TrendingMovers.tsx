import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../../HeroImage';
import { COLORS } from '../../../constants/colors';
import type { WikiTrendingHero } from '../../../lib/db/trending';

function MoverRow({
  h,
  i,
  max,
  nameW,
  onPress,
}: {
  h: WikiTrendingHero;
  i: number;
  max: number;
  nameW: number;
  onPress: () => void;
}) {
  const lead = i === 0;
  const pct = (h.spikePct / max) * 100;
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [s.row, hovered && (s.rowHover as object)] as object
      }
    >
      <Text style={[s.rank, lead && (s.rankLead as object)] as object}>{i + 1}</Text>
      <View style={[s.face, lead && (s.faceLead as object)] as object}>
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
      </View>
      <Text style={[s.name, { width: nameW }] as object} numberOfLines={1}>
        {h.name}
      </Text>
      <View style={s.lane as object}>
        <View style={[s.fill, { width: `${pct}%` }, lead && (s.fillLead as object)] as object} />
      </View>
      <View style={s.spike}>
        <Ionicons name="caret-up" size={11} color={COLORS.orange} />
        <Text style={s.spikeText as object}>{h.spikePct}%</Text>
      </View>
    </Pressable>
  );
}

export function TrendingMovers({
  heroes,
  onHeroPress,
  inline = false,
}: {
  heroes: WikiTrendingHero[];
  onHeroPress: (id: string) => void;
  /** Render without the standalone glass panel — for inside a padded row layout. */
  inline?: boolean;
}) {
  const { width } = useWindowDimensions();
  const pad = width < 640 ? 16 : 32;
  const nameW = inline ? 120 : width < 760 ? 92 : 150;

  if (heroes.length === 0) return null;
  const list = heroes.slice(0, inline ? 8 : width >= 760 ? 7 : 5);
  const max = Math.max(...list.map((h) => h.spikePct), 1);

  const rows = list.map((h, i) => (
    <MoverRow key={h.id} h={h} i={i} max={max} nameW={nameW} onPress={() => onHeroPress(h.id)} />
  ));

  if (inline) {
    return (
      <View style={s.inlineWrap as object}>
        <View style={s.head}>
          <Text style={s.kicker as object}>This Week · On the Rise</Text>
          <Text style={s.title as object}>Biggest Movers</Text>
        </View>
        <View>{rows}</View>
      </View>
    );
  }

  return (
    <View style={[s.section, { marginHorizontal: pad, padding: width < 640 ? 18 : 26 }] as object}>
      <View style={s.head}>
        <Text style={s.kicker as object}>This Week · On the Rise</Text>
        <Text style={s.title as object}>Biggest Movers</Text>
      </View>
      <View>{rows}</View>
    </View>
  );
}

const FACE = 40;

const s = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
  },
  // No panel when inline — sits directly in the padded row
  inlineWrap: {
    paddingTop: 2,
  } as object,

  head: { marginBottom: 14 },
  kicker: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: COLORS.orange,
    marginBottom: 2,
  } as object,
  title: {
    fontFamily: 'Flame-Regular',
    fontSize: 26,
    color: COLORS.beige,
    lineHeight: 28,
  } as object,

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  } as object,
  rowHover: { opacity: 0.78 } as object,
  rank: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    color: 'rgba(245,235,220,0.25)',
    width: 18,
    textAlign: 'center',
  } as object,
  rankLead: {
    color: 'rgba(245,235,220,0.55)',
  } as object,
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    overflow: 'hidden',
    backgroundColor: COLORS.navy,
    borderWidth: 2,
    borderColor: 'rgba(231,115,51,0.4)',
    flexShrink: 0,
  },
  faceLead: {
    borderColor: COLORS.orange,
    boxShadow: '0 0 14px rgba(231,115,51,0.45)',
  } as object,
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 14,
    color: COLORS.beige,
    lineHeight: 16,
    flexShrink: 0,
  } as object,
  lane: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(245,235,220,0.07)',
    overflow: 'hidden',
  } as object,
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundImage: 'linear-gradient(to right, rgba(231,115,51,0.35), rgba(231,115,51,0.9))',
  } as object,
  fillLead: {
    backgroundImage: `linear-gradient(to right, rgba(231,115,51,0.5), ${COLORS.orange})`,
    boxShadow: '0 0 10px rgba(231,115,51,0.5)',
  } as object,
  spike: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    width: 58,
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  spikeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.orange,
  } as object,
});
