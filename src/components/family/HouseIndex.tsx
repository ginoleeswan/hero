// src/components/family/HouseIndex.tsx
// Every house in the catalogue, as crests.
//
// Shared by the /house route's two platform files and by the universe page's
// row, so a house reads the same wherever you meet it. The crest carries the
// card: a grid of eight identical text tiles would be a list with extra steps,
// and the shield is the one thing that makes a house recognisable at a glance.
//
// The card is a HANGING BANNER, not a tile: a field washed with the house's own
// tint carrying the crest, divided by a hairline from the plinth that carries
// the name. That shape does two things a plain card could not. It makes twelve
// houses twelve different objects — Targaryen reads red, Tyrell green, Stark
// slate — instead of twelve identical boxes distinguished only by a 78pt shield.
// And it lets the plate be cut from whatever surface it lands on, which is what
// the white card got wrong: on the universe page's ink floor a white rectangle
// is the brightest thing on a screen whose subject is the character grid below
// it. Every colour here is `tint` blended into the host surface, so the same
// component sits down on ink and on parchment without either being a special
// case bolted on afterwards.
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../ui/Text';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, HOUSE_INK, INK_TEXT } from '../../constants/colors';
import { HouseCrest, mixHex, hexLuminance } from './HouseCrest';
import type { HouseSearchResult } from '../../lib/db/houses';

/** Which surface the card is sitting on — it is cut from that surface, not laid on it. */
export type HouseTone = 'paper' | 'ink';

/**
 * The plate colours, one step lifted off each host surface so the card is a
 * raised object rather than a hole punched in the page. `mixHex(tint, plate, a)`
 * is `(1-a)` parts house colour — the numbers are deliberately high, because the
 * shield is the saturated element and the plate is its mount.
 */
const INK_PLATE = mixHex(COLORS.deepNavy, COLORS.beige, 0.07);
const PAPER_PLATE = '#fdf9f4';

/**
 * Some sigil tints are already darker than the ink floor — Greyjoy's #1f2d3a is
 * within a hair of deepNavy — and a plate blended from one of those is an
 * invisible card, not a subtle one. Lift the working colour until it can carry
 * an edge, and leave every tint that already clears the floor untouched.
 */
function carryable(tint: string, tone: HouseTone): string {
  if (tone !== 'ink') return tint;
  const lum = hexLuminance(tint);
  const FLOOR = 0.055;
  if (lum >= FLOOR) return tint;
  return mixHex(tint, COLORS.beige, Math.min(0.42, (FLOOR - lum) * 4));
}

function plate(rawTint: string, tone: HouseTone) {
  const base = tone === 'ink' ? INK_PLATE : PAPER_PLATE;
  const ink = tone === 'ink';
  const tint = carryable(rawTint, tone);
  // A pale tint laid over ink at the same strength as a dark one doesn't read
  // paler — it reads *muddy*: Baratheon's gold at 26% over deep navy is olive,
  // which is a colour that house does not own. Back the wash off in proportion
  // to how light the tint is, and every field lands at the same weight.
  const soften = ink ? Math.min(0.12, hexLuminance(tint) * 0.5) : 0;
  const at = (inkAmount: number, paperAmount: number) =>
    mixHex(tint, base, ink ? inkAmount + soften : paperAmount);
  return {
    base,
    fieldTop: at(0.74, 0.9),
    fieldBottom: at(0.9, 0.97),
    border: at(0.62, 0.7),
    borderHover: at(0.4, 0.5),
    rule: at(0.56, 0.64),
  };
}

export function HouseCard({
  house,
  width,
  tone = 'paper',
}: {
  house: HouseSearchResult;
  width?: number;
  tone?: HouseTone;
}) {
  const router = useRouter();
  const ink = tone === 'ink';
  const tint = house.sigil_tint ?? COLORS.orange;
  const c = plate(tint, tone);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${house.name} family tree`}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/house/${house.slug}` as Parameters<typeof router.push>[0]);
      }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) =>
        [
          styles.card,
          { backgroundColor: c.base, borderColor: hovered ? c.borderHover : c.border },
          // flexBasis as well as width: a bare `width` loses to the stylesheet's
          // own flexBasis, so wrapping would be decided by a number the caller
          // never passed — and a caller computing how many cards fit a row
          // would compute it from the wrong one.
          width ? { width, flexBasis: width } : null,
          hovered && (styles.cardHover as object),
          pressed && styles.pressed,
        ] as object
      }
    >
      {/* The field. A wash rather than a colour block: at ~26% tint the house
          reads as a tone across the whole card, and the shield stays the only
          fully saturated thing on it. */}
      <LinearGradient
        colors={[c.fieldTop, c.fieldBottom]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.field}
      >
        <HouseCrest name={house.name} tint={tint} size={72} outline={ink ? 'light' : 'dark'} />
      </LinearGradient>

      {/* The division — heraldry's own line, and the thing that makes the card
          a banner over a plinth instead of one flat panel. */}
      <View style={[styles.rule, { backgroundColor: c.rule }] as object} />

      <View style={styles.meta}>
        <Text style={[styles.name, ink && (styles.nameInk as object)] as object} numberOfLines={2}>
          {house.name}
        </Text>
        {/* The motto if the house has one, its seat if it doesn't. A card with
            the line missing sits a whole line lower than its neighbours, which
            reads as missing data rather than as a house that simply has no
            words — and the seat is the other fact that places a dynasty. Quoted
            only when it is something someone actually says. */}
        {house.words || house.seat ? (
          <Text
            style={
              [styles.words, ink && (house.words ? styles.wordsInk : styles.seatInk)] as object
            }
            numberOfLines={1}
          >
            {house.words ? `“${house.words}”` : house.seat}
          </Text>
        ) : null}
        <Text style={[styles.count, ink && (styles.countInk as object)] as object}>
          {house.memberCount} {house.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>
    </Pressable>
  );
}

export function HouseGrid({ houses, tone }: { houses: HouseSearchResult[]; tone?: HouseTone }) {
  if (houses.length === 0) return null;
  return (
    <View style={styles.grid}>
      {houses.map((h) => (
        <HouseCard key={h.slug} house={h} tone={tone} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  pressed: { opacity: 0.6 },
  card: {
    flexGrow: 1,
    flexBasis: 190,
    maxWidth: 260,
    borderRadius: 20,
    borderWidth: 1,
    // The field runs to the plate's edge, so the corners have to clip it.
    overflow: 'hidden',
    transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease',
    cursor: 'pointer',
  } as object,
  cardHover: { transform: [{ translateY: -3 }] } as object,
  // A wrapped row stretches every card to its tallest member (a two-line name,
  // a house with no motto). The slack goes to the FIELD so the name/motto/count
  // strip stays a constant-height plinth across the row and the crests stay
  // centred in whatever field they get.
  field: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 18,
  },
  rule: { height: 1, width: '100%' },
  meta: { alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 14 },
  name: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    lineHeight: 23,
    color: COLORS.black,
    textAlign: 'center',
  },
  nameInk: { color: COLORS.beige },
  // Clamped Flame needs lineHeight ≥ 1.22× its size or the quotes and the
  // descenders in "Honour" get cut by the clamp's overflow box.
  words: {
    fontFamily: 'Flame-Regular',
    fontSize: 13,
    lineHeight: 18,
    color: HOUSE_INK,
    textAlign: 'center',
  },
  // Gold on ink, matching the motto in the house page's own banner. A seat is a
  // fact rather than a voice, so it takes the muted ink instead of the gold.
  wordsInk: { color: 'rgba(206,155,51,0.92)' },
  seatInk: { color: INK_TEXT.muted },
  count: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    // Full HOUSE_INK, not a faded one: at 10px this is small text, and the
    // token is already tuned to clear 4.5:1 on the module's parchment.
    color: HOUSE_INK,
    marginTop: 5,
  },
  countInk: { color: INK_TEXT.faint },
});
