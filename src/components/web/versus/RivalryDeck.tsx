// src/components/web/versus/RivalryDeck.tsx — the "Greatest Rivalries" deck on
// the web Arena hub. Split-portrait collectible cards over a holographic sheen;
// tapping one opens that matchup in the arena. A 5-up grid on desktop, a
// horizontal swipe rail on mobile.
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { HeroImage } from '../../HeroImage';
import type { Rivalry } from '../../../lib/db/heroes';
import type { FighterArt } from '../../../lib/compareHandoff';

const railFadeMask = 'linear-gradient(to right, #000 92%, transparent 100%)';

function RivalryMini({ r, onPress }: { r: Rivalry; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${r.a.name} versus ${r.b.name}`}
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) =>
        [c.mini, hovered && (c.miniHover as object)] as object
      }
    >
      <View style={c.half}>
        <HeroImage
          id={r.a.id}
          name={r.a.name}
          imageUrl={r.a.image_url}
          portraitUrl={r.a.portrait_url}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={c.half}>
        <HeroImage
          id={r.b.id}
          name={r.b.name}
          imageUrl={r.b.image_url}
          portraitUrl={r.b.portrait_url}
          contentFit="cover"
          contentPosition="top"
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={[StyleSheet.absoluteFill, c.holo] as object} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, c.grad] as object} pointerEvents="none" />
      <View style={c.vs}>
        <Text style={c.vsText}>VS</Text>
      </View>
      <Text style={c.label} numberOfLines={1}>
        {r.a.name} · {r.b.name}
      </Text>
    </Pressable>
  );
}

export function RivalryDeck({
  rivalries,
  isDesktop,
  onOpen,
}: {
  rivalries: Rivalry[];
  isDesktop: boolean;
  onOpen: (a: FighterArt, b: FighterArt) => void;
}) {
  if (rivalries.length === 0) return null;

  return (
    <View>
      <View style={c.head}>
        <Text style={c.heading}>Greatest Rivalries</Text>
        <Text style={c.sub}>the grudge matches fans want to see</Text>
      </View>
      {isDesktop ? (
        <View style={c.grid as object}>
          {rivalries.map((r) => (
            <RivalryMini key={`${r.a.id}-${r.b.id}`} r={r} onPress={() => onOpen(r.a, r.b)} />
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={c.railFade as object}
          contentContainerStyle={c.rail}
        >
          {rivalries.map((r) => (
            <View key={`${r.a.id}-${r.b.id}`} style={c.railItem}>
              <RivalryMini r={r} onPress={() => onOpen(r.a, r.b)} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const c = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 14 },
  heading: { fontFamily: 'Flame-Regular', fontSize: 22, color: COLORS.beige },
  sub: { fontFamily: 'Nunito_400Regular', fontSize: 12.5, color: 'rgba(245,235,220,0.45)' },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
    gridAutoRows: '156px',
    gap: 14,
  } as object,
  railFade: { maskImage: railFadeMask, WebkitMaskImage: railFadeMask } as object,
  rail: { gap: 12, paddingRight: 16 },
  railItem: { width: 168, height: 156 },

  mini: {
    flex: 1,
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.deepNavy,
    cursor: 'pointer',
    transition: 'transform 150ms ease',
  } as object,
  miniHover: { transform: [{ translateY: -3 }] } as object,
  half: { flex: 1, height: '100%' },
  holo: {
    backgroundImage:
      'linear-gradient(135deg, rgba(231,115,51,0.10), transparent, rgba(21,161,171,0.10))',
    mixBlendMode: 'screen',
  } as object,
  grad: {
    backgroundImage: 'linear-gradient(180deg, transparent 55%, rgba(8,12,24,0.9))',
  } as object,
  vs: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 30,
    height: 30,
    borderRadius: 15,
    marginTop: -15,
    marginLeft: -15,
    backgroundColor: COLORS.deepNavy,
    borderWidth: 1.5,
    borderColor: COLORS.goldAccent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  } as object,
  vsText: { fontFamily: 'Flame-Regular', fontSize: 11, color: COLORS.goldAccent },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 9,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.beige,
  } as object,
});
