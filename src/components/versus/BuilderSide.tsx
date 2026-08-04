import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { FighterAnchor } from '../compare/FighterAnchor';
import { COLORS } from '../../constants/colors';
import { MAX_SIDE, type PickedHero } from '../../lib/battleBuilderState';

interface Props {
  /** Seat caption beneath the anchor, e.g. "Side A". */
  label: string;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  publisher: 'marvel' | 'dc' | null;
  active: boolean;
  /** Mirror the captain portrait so a right-side anchor faces the centre. */
  flip?: boolean;
  anchorW?: number;
  anchorH?: number;
  slot?: number;
  onActivate: () => void;
  onRemove: (id: string) => void;
}

/** One side of the Battle Builder, on the original picker's matchup stage: the
 *  captain in a big FighterAnchor, a lean strip of up-to-5 squad slots beneath,
 *  and the live synergy % + publisher badge. Tap the anchor to make the side
 *  active; tap a filled slot (or the anchor's clear) to remove a hero. */
export function BuilderSide({
  label,
  tint,
  roster,
  synergy,
  publisher,
  active,
  flip = false,
  anchorW = 128,
  anchorH = 160,
  slot = 32,
  onActivate,
  onRemove,
}: Props) {
  const captain = roster[0] ?? null;
  return (
    <View style={styles.side}>
      <FighterAnchor
        fighter={
          captain
            ? {
                id: captain.id,
                name: captain.name,
                image_url: captain.image_url,
                portrait_url: captain.portrait_url,
              }
            : null
        }
        seatLabel={label}
        active={active}
        flip={flip}
        w={anchorW}
        h={anchorH}
        onPress={onActivate}
        onClear={captain ? () => onRemove(captain.id) : undefined}
      />

      <View style={styles.strip}>
        {Array.from({ length: MAX_SIDE }).map((_, i) => {
          const hero = roster[i];
          const sz = { width: slot, height: slot };
          if (!hero) {
            return (
              <View key={i} style={[styles.empty, sz]}>
                <Text style={styles.plus}>+</Text>
              </View>
            );
          }
          const uri = hero.portrait_url ?? hero.image_url ?? undefined;
          return (
            <Pressable
              key={hero.id}
              onPress={() => onRemove(hero.id)}
              style={[styles.slot, sz, { borderColor: tint }]}
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
        })}
      </View>

      <View style={styles.meta}>
        {publisher ? (
          <Text style={styles.pub}>{publisher === 'dc' ? 'all-DC' : 'all-Marvel'}</Text>
        ) : null}
        {roster.length >= 2 ? (
          <Text style={[styles.syn, { color: tint }]}>SYNERGY +{synergy}%</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  side: { alignItems: 'center', gap: 10 },
  strip: { flexDirection: 'row', gap: 5, justifyContent: 'center' },
  slot: { borderRadius: 7, overflow: 'hidden', backgroundColor: '#1b2a30', borderWidth: 1 },
  mirror: { transform: [{ scaleX: -1 }] },
  empty: {
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  rm: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(11,24,32,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rmx: { fontFamily: 'Nunito_700Bold', fontSize: 9, color: '#fff', lineHeight: 11 },
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
});
