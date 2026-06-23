import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { FighterAnchor } from '../compare/FighterAnchor';
import { COLORS } from '../../constants/colors';
import { MAX_SIDE, type PickedHero } from '../../lib/battleBuilderState';

interface Props {
  /** Seat caption beneath the captain, e.g. "Side A". */
  label: string;
  tint: string;
  roster: PickedHero[];
  synergy: number;
  publisher: 'marvel' | 'dc' | null;
  active: boolean;
  /** Mirror captain + slot portraits so a right-side rail faces the centre. */
  flip?: boolean;
  captainW?: number;
  captainH?: number;
  slot?: number;
  onActivate: () => void;
  onRemove: (id: string) => void;
  /** When set, shows a dice control that fills this side from the pool. */
  onRandom?: () => void;
}

/** One side of the draft, as a vertical rail: the captain in a big FighterAnchor
 *  on top, the squad as a stacked column of up-to-5 slots beneath, then synergy,
 *  publisher and an optional dice. Tap the rail to make the side active; tap a
 *  filled slot (or the anchor's clear) to remove a hero. */
export function RailSide({
  label,
  tint,
  roster,
  synergy,
  publisher,
  active,
  flip = false,
  captainW = 128,
  captainH = 160,
  slot = 38,
  onActivate,
  onRemove,
  onRandom,
}: Props) {
  const captain = roster[0] ?? null;
  return (
    <View style={[styles.rail, active ? { borderColor: COLORS.goldAccent } : styles.railIdle]}>
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
        w={captainW}
        h={captainH}
        onPress={onActivate}
        onClear={captain ? () => onRemove(captain.id) : undefined}
      />

      <View style={styles.slots}>
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

      {onRandom ? (
        <Pressable onPress={onRandom} style={styles.dice}>
          <Text style={styles.diceText}>🎲 Random</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  railIdle: { borderColor: 'transparent' },
  slots: { gap: 6, alignItems: 'center' },
  slot: { borderRadius: 8, overflow: 'hidden', backgroundColor: '#1b2a30', borderWidth: 1 },
  mirror: { transform: [{ scaleX: -1 }] },
  empty: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: 'rgba(255,255,255,0.4)' },
  rm: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: 'rgba(11,24,32,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rmx: { fontFamily: 'Nunito_700Bold', fontSize: 10, color: '#fff', lineHeight: 12 },
  meta: { alignItems: 'center', gap: 3, minHeight: 14 },
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
  dice: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  diceText: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: 'rgba(245,235,220,0.85)' },
});
