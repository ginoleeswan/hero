// src/components/versus/MakeAFight.tsx — the second act of the Arena hub.
//
// One-v-one and team battle are two of the biggest things this app does. They
// are an act of their own, directly under today's fight: you have just voted on
// someone else's bout, and the next thing offered is making your own.
//
// IT ARRIVES WITH A FIGHT ALREADY IN IT. The first version drew two empty
// dashed slots reading "+ CHOOSE" — a screen and a half of placeholder asking
// to be furnished before it would do anything. Handsome, and completely inert:
// the most prominent thing in the act was the absence of content.
//
// Now the slots come loaded with a real clash from the iconic pool. That turns
// three separate controls into one object you can act on three ways —
//
//   Fight    take the clash as dealt (one tap, and it is a real arena)
//   Shuffle  deal another (this is what "Surprise me" wanted to be: the old
//            button teleported you into a random arena sight unseen; here the
//            surprise happens ON the card, and you decide)
//   Tap a fighter to replace just that side in the builder
//
// — ordered by how much say you want, which is the same order the act always
// meant to offer. The toggle swaps the pair for two squads, saying without a
// word that one-v-one and team battle are siblings: the same act at scale.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { SECTION, SUBHEAD } from '../../constants/arenaType';
import { RADIUS } from '../../design';
import { HeroImage } from '../HeroImage';
import { RivalriesRail } from './RivalriesRail';
import type { FighterArt } from '../../lib/compareHandoff';
import type { Rivalry } from '../../lib/db/heroes';

const H_PAD = 16;
// The EMPTY squad placeholders are short — nothing to see, so nothing to give
// room to. The dealt fighters are PORTRAIT, because that is the shape hero art
// is drawn in: `cover` + a top anchor inside a landscape box crops a portrait
// to a wide band across the top of the figure, which on most of the catalogue
// lands between the hairline and the chin. Every other fighter card in the app
// (the showdown's HoloCard, the rivalry rail's split portraits) is portrait for
// the same reason; these were the exception.
const SQUAD_H = 132;
const SLOT_RATIO = 4 / 5;

export function MakeAFight({
  pair,
  onFight,
  onShuffle,
  onChoose,
  onDraft,
  rivalries,
  onOpenRivalry,
}: {
  /** The clash currently dealt into the slots — null while the pool loads. */
  pair: [FighterArt, FighterArt] | null;
  onFight: () => void;
  onShuffle: () => void;
  /** Replace one side: opens the builder rather than cycling blindly. */
  onChoose: (side: 'a' | 'b') => void;
  onDraft: () => void;
  rivalries: Rivalry[];
  onOpenRivalry: (a: FighterArt, b: FighterArt) => void;
}) {
  const [team, setTeam] = useState(false);

  const swap = (next: boolean) => {
    if (next === team) return;
    Haptics.selectionAsync();
    setTeam(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.inset, styles.head]}>
        <Text style={styles.title}>Make a fight</Text>
        <View style={styles.rule} />
      </View>

      <View style={[styles.inset, styles.modes]} accessibilityRole="tablist">
        {[
          { on: !team, label: 'One v one', press: () => swap(false) },
          { on: team, label: 'Team battle', press: () => swap(true) },
        ].map((m) => (
          <Pressable
            key={m.label}
            onPress={m.press}
            accessibilityRole="tab"
            accessibilityState={{ selected: m.on }}
            style={[styles.mode, m.on && styles.modeOn]}
          >
            <Text style={[styles.modeText, m.on && styles.modeTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {team ? (
        <>
          <View style={[styles.inset, styles.slots]}>
            <Squad label="Your side" onPress={onDraft} />
            <View style={styles.medallion}>
              <Text style={styles.medallionText}>VS</Text>
            </View>
            <Squad label="Their side" onPress={onDraft} />
          </View>
          <View style={styles.inset}>
            <Primary label="Draft the squads" icon="people" onPress={onDraft} />
          </View>
        </>
      ) : (
        <>
          <View style={[styles.inset, styles.slots]}>
            <Fighter fighter={pair?.[0]} cant={-3.2} onPress={() => onChoose('a')} />
            <View style={styles.medallion}>
              <Text style={styles.medallionText}>VS</Text>
            </View>
            <Fighter fighter={pair?.[1]} cant={3.2} onPress={() => onChoose('b')} />
          </View>

          <View style={[styles.inset, styles.actions]}>
            <Primary label="Fight" icon="flash" onPress={onFight} disabled={!pair} flex />
            <Pressable
              onPress={onShuffle}
              disabled={!pair}
              accessibilityRole="button"
              accessibilityLabel="Deal a different clash"
              style={({ pressed }) => [styles.shuffle, pressed && styles.dim, !pair && styles.off]}
            >
              <Ionicons name="shuffle" size={19} color={COLORS.goldAccent} />
            </Pressable>
          </View>
          <Text style={[styles.inset, styles.hint]}>
            Tap a fighter to swap that side · shuffle to deal another
          </Text>
        </>
      )}

      {rivalries.length > 0 ? (
        <View style={styles.ready}>
          <View style={[styles.inset, styles.readyHead]}>
            <Text style={styles.readyLabel}>{"Or take one that's ready"}</Text>
            <Text style={styles.readyCount}>
              {rivalries.length} {rivalries.length === 1 ? 'rivalry' : 'rivalries'}
            </Text>
          </View>
          {/* The rail escapes this padded block so cards run to the physical
              screen edge — see the horizontal-rail rule in CLAUDE.md. */}
          <RivalriesRail rivalries={rivalries} onOpen={onOpenRivalry} headless />
        </View>
      ) : null}
    </View>
  );
}

/** One side of the dealt clash: the fighter's art, their name, and a quiet
 *  "swap" affordance so the card reads as changeable rather than fixed. */
function Fighter({
  fighter,
  cant,
  onPress,
}: {
  fighter: FighterArt | undefined;
  cant: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fighter?.name ? `Swap ${fighter.name}` : 'Choose a fighter'}
      style={({ pressed }) => [
        styles.slot,
        { transform: [{ rotate: `${cant}deg` }] },
        !fighter && styles.slotEmpty,
        pressed && styles.slotPressed,
      ]}
    >
      {fighter ? (
        <>
          <HeroImage
            id={fighter.id}
            name={fighter.name ?? ''}
            imageUrl={fighter.image_url}
            portraitUrl={fighter.portrait_url}
            contentFit="cover"
            contentPosition="top"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', 'rgba(8,12,24,0.94)']}
            locations={[0.42, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.swapPip}>
            <Ionicons name="repeat" size={12} color={COLORS.beige} />
          </View>
          <Text style={styles.fighterName} numberOfLines={1}>
            {fighter.name}
          </Text>
        </>
      ) : (
        <Text style={styles.slotLabel}>Choose</Text>
      )}
    </Pressable>
  );
}

function Squad({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, pick five`}
      style={({ pressed }) => [styles.squad, pressed && styles.slotPressed]}
    >
      <View style={styles.pips}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={styles.pip} />
        ))}
      </View>
      {/* Two lines, deliberately. "YOUR SIDE · PICK 5" as one uppercase
          letterspaced string does not fit a 40%-wide box — it wrapped and hung
          the "5" outside the border. */}
      <Text style={styles.slotLabel}>{label}</Text>
      <Text style={styles.squadPick}>Pick 5</Text>
    </Pressable>
  );
}

function Primary({
  label,
  icon,
  onPress,
  disabled,
  flex,
}: {
  label: string;
  icon: 'flash' | 'people';
  onPress: () => void;
  disabled?: boolean;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.primary,
        flex && styles.primaryFlex,
        pressed && styles.dim,
        disabled && styles.off,
      ]}
    >
      <Ionicons name={icon} size={16} color={COLORS.deepNavy} />
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28 },
  // Everything except the rail is inset; the rail brings its own inset and
  // must reach the physical screen edge (see CLAUDE.md's rail rule).
  inset: { paddingHorizontal: H_PAD },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 16 },
  title: { ...SECTION, color: COLORS.beige },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(245,235,220,0.14)' },

  modes: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(41,60,67,0.5)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.14)',
    marginBottom: 20,
  },
  mode: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.pill, alignItems: 'center' },
  modeOn: { backgroundColor: COLORS.beige },
  modeText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: INK_TEXT.muted },
  modeTextOn: { color: COLORS.deepNavy },

  slots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  slot: {
    width: '42%',
    aspectRatio: SLOT_RATIO,
    borderRadius: RADIUS.xl,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.2)',
    backgroundColor: COLORS.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(245,235,220,0.26)',
    backgroundColor: 'rgba(41,60,67,0.28)',
  },
  slotPressed: { borderColor: COLORS.orange },
  fighterName: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 9,
    textAlign: 'center',
    fontFamily: 'Flame-Regular',
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.beige,
  },
  swapPip: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,24,32,0.72)',
  },
  slotLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  squad: {
    width: '42%',
    height: SQUAD_H,
    borderRadius: RADIUS.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,235,220,0.26)',
    backgroundColor: 'rgba(41,60,67,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  squadPick: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: INK_TEXT.faint },
  pips: { flexDirection: 'row', gap: 5 },
  pip: {
    width: 14,
    height: 14,
    borderRadius: RADIUS.xs,
    backgroundColor: 'rgba(245,235,220,0.14)',
  },
  medallion: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.xxl,
    marginHorizontal: -14,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.deepNavy,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.2)',
  },
  medallionText: {
    fontFamily: 'Flame-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: INK_TEXT.faint,
  },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.beige,
  },
  primaryFlex: { flex: 1 },
  primaryText: { fontFamily: 'Nunito_800ExtraBold', fontSize: 15, color: COLORS.deepNavy },
  shuffle: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.22)',
    backgroundColor: 'rgba(41,60,67,0.5)',
  },
  hint: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: INK_TEXT.faint,
  },
  dim: { opacity: 0.6 },
  off: { opacity: 0.35 },

  ready: { marginTop: 26 },
  readyHead: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,235,220,0.14)',
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  // One subhead spec across the tab — see SUBHEAD in constants/arenaType.
  readyLabel: { ...SUBHEAD, color: INK_TEXT.muted },
  readyCount: { ...SUBHEAD, color: INK_TEXT.faint },
});
