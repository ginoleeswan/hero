import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../../constants/colors';
import { MAX_SIDE, type PickedHero } from '../../lib/battleBuilderState';

interface Props {
  label: string;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  publisher: 'marvel' | 'dc' | null;
  active: boolean;
  /** Side B mirrors the cards + fans outward to the right. */
  flip?: boolean;
  /** Width of the featured (front) card; fan cards derive from it. */
  featuredW?: number;
  /** Horizontal offset per fanned card (defaults to ~0.42×featuredW). */
  step?: number;
  onActivate: () => void;
  onRemove: (id: string) => void;
  onRandom: () => void;
  onClear: () => void;
}

/** One side as a fanned hand of cards: the lead pick big in front, the rest
 *  fanned out (offset + tilted) so every face peeks and is tappable, faded ghost
 *  cards hinting "add more". Active side is spotlit; inactive recedes. */
export function HeroDeck({
  label,
  tint,
  roster,
  synergy,
  publisher,
  active,
  flip = false,
  featuredW = 150,
  step: stepProp,
  onActivate,
  onRemove,
  onRandom,
  onClear,
}: Props) {
  const featuredH = Math.round(featuredW * 1.34);
  const fanW = Math.round(featuredW * 0.82);
  const fanH = Math.round(fanW * 1.34);
  const step = stepProp ?? Math.round(featuredW * 0.42); // horizontal offset per fanned card
  const angle = 6; // deg of tilt per fanned card
  const dir = flip ? 1 : -1; // fan outward (left for A, right for B)

  const featured = roster[0] ?? null;
  const rest = roster.slice(1); // fanned behind the lead
  const ghostCount = Math.min(2, MAX_SIDE - roster.length);

  // Lay the fan + ghosts out from the lead's outer edge.
  const fanCount = rest.length + ghostCount;
  const fanSpread = fanCount * step;
  const stageW = featuredW + fanSpread;
  const stageH = featuredH + 14;

  const cardUri = (h: PickedHero) => h.portrait_url ?? h.image_url ?? undefined;

  return (
    <View style={[styles.deck, active ? null : styles.dim]}>
      <View style={styles.tagSlot}>
        {active ? (
          <View style={[styles.tag, { backgroundColor: tint }]}>
            <Text style={styles.tagText}>▶ Now Picking</Text>
          </View>
        ) : null}
      </View>

      <Pressable onPress={onActivate} style={[styles.stage, { width: stageW, height: stageH }]}>
        {/* Ghost cards (furthest back, faded) */}
        {Array.from({ length: ghostCount }).map((_, gi) => {
          const k = rest.length + gi + 1; // index from the lead
          return (
            <View
              key={`ghost-${gi}`}
              style={[
                styles.card,
                styles.ghost,
                {
                  width: fanW,
                  height: fanH,
                  [flip ? 'left' : 'right']: 0,
                  transform: [{ translateX: dir * k * step }, { rotate: `${dir * k * angle}deg` }],
                  zIndex: 1,
                },
              ]}
            >
              <Text style={styles.ghostPlus}>+</Text>
            </View>
          );
        })}

        {/* Fanned squad (behind the lead, each tappable to remove) */}
        {rest
          .map((hero, ri) => {
            const k = rest.length - ri; // outermost = highest index
            const uri = cardUri(hero);
            return (
              <Pressable
                key={hero.id}
                onPress={() => onRemove(hero.id)}
                style={[
                  styles.card,
                  {
                    width: fanW,
                    height: fanH,
                    borderColor: tint,
                    [flip ? 'left' : 'right']: 0,
                    transform: [
                      { translateX: dir * k * step },
                      { rotate: `${dir * k * angle}deg` },
                    ],
                    zIndex: 10 + ri,
                  },
                ]}
              >
                {uri ? (
                  <Image
                    source={{ uri }}
                    style={[StyleSheet.absoluteFill, flip ? styles.mirror : null]}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
                )}
                <View style={styles.rm}>
                  <Text style={styles.rmx}>×</Text>
                </View>
              </Pressable>
            );
          })
          .reverse()}

        {/* Featured lead card, front */}
        <View
          style={[
            styles.featured,
            {
              width: featuredW,
              height: featuredH,
              borderColor: tint,
              [flip ? 'left' : 'right']: 0,
            },
            active ? ({ boxShadow: `0 0 34px 1px ${tint}80` } as object) : null,
          ]}
        >
          {featured ? (
            <>
              <Image
                source={{ uri: cardUri(featured) }}
                style={[StyleSheet.absoluteFill, flip ? styles.mirror : null]}
                contentFit="cover"
              />
              <Pressable onPress={() => onRemove(featured.id)} style={styles.rm} hitSlop={6}>
                <Text style={styles.rmx}>×</Text>
              </Pressable>
              <View style={[styles.nameTag, { backgroundColor: tint }]}>
                <Text style={styles.name} numberOfLines={1}>
                  {featured.name}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyQ}>?</Text>
              <Text style={styles.emptyHint}>Your Pick</Text>
            </View>
          )}
        </View>
      </Pressable>

      <View style={styles.meta}>
        {publisher ? (
          <Text style={styles.pub}>{publisher === 'dc' ? 'all-DC' : 'all-Marvel'}</Text>
        ) : null}
        {roster.length >= 2 ? (
          <Text style={[styles.syn, { color: tint }]}>SYN +{synergy}%</Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onRandom} style={styles.act} hitSlop={6}>
          <Text style={styles.actText}>🎲 Random</Text>
        </Pressable>
        {roster.length > 0 ? (
          <Pressable onPress={onClear} style={styles.act} hitSlop={6}>
            <Text style={styles.actText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  deck: { alignItems: 'center', gap: 10 },
  dim: { opacity: 0.5, transform: [{ scale: 0.96 }] },
  tagSlot: { height: 22, justifyContent: 'center' },
  tag: { paddingHorizontal: 11, paddingVertical: 3, borderRadius: 11 },
  tagText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#fff',
    textTransform: 'uppercase',
  },

  stage: { position: 'relative', justifyContent: 'center' },
  card: {
    position: 'absolute',
    top: 7,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#16242b',
  },
  ghost: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(22,36,43,0.5)',
    opacity: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostPlus: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: 'rgba(255,255,255,0.4)' },
  featured: {
    position: 'absolute',
    top: 0,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    backgroundColor: '#16242b',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  mirror: { transform: [{ scaleX: -1 }] },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  emptyQ: { fontFamily: 'Flame-Regular', fontSize: 44, color: 'rgba(255,255,255,0.22)' },
  emptyHint: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
  },
  nameTag: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  name: { fontFamily: 'Flame-Regular', fontSize: 15, color: '#fff', textAlign: 'center' },
  rm: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(11,24,32,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  rmx: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: '#fff', lineHeight: 14 },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 14 },
  pub: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 9,
    color: COLORS.goldAccent,
    borderWidth: 1,
    borderColor: 'rgba(206,155,51,0.5)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  syn: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.3 },

  actions: { flexDirection: 'row', gap: 8 },
  act: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  actText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.85)' },
});
