// src/components/versus/MakeAFight.tsx — the second act of the Arena hub.
//
// One-v-one and team battle are two of the biggest things this app does, and
// they used to be a pair of buttons wedged between the showdown and a card of
// chips — a primary capability treated as a footnote. They are now an act of
// their own, directly under today's fight: you have just voted on someone
// else's bout, and the next thing offered is making your own.
//
// It reads as an invitation rather than a control because it LOOKS LIKE THE
// THING IT MAKES — two empty slots canted at the angle the showdown cards use,
// with the same VS medallion between them. One toggle swaps those slots for two
// squads, which says without a word that the two features are siblings: the
// same act at different scale.
//
// Everything that starts a fight lives here, ordered by how much say you want:
// build it yourself, take one that is ready, or let the app choose. Splitting
// those across the screen (a build button up top, a rivalries rail three
// sections down, a surprise button between them) scattered one intent across
// three places.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, INK_TEXT } from '../../constants/colors';
import { RADIUS } from '../../design';
import { RivalriesRail } from './RivalriesRail';
import type { FighterArt } from '../../lib/compareHandoff';
import type { Rivalry } from '../../lib/db/heroes';

const H_PAD = 16;

export function MakeAFight({
  onBuild,
  onDraft,
  onSurprise,
  canSurprise,
  rivalries,
  onOpenRivalry,
}: {
  onBuild: () => void;
  onDraft: () => void;
  onSurprise: () => void;
  canSurprise: boolean;
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
        <View style={[styles.inset, styles.slots]}>
          <Squad label="Your side" onPress={onDraft} />
          <View style={styles.medallion}>
            <Text style={styles.medallionText}>VS</Text>
          </View>
          <Squad label="Their side" onPress={onDraft} />
        </View>
      ) : (
        <View style={[styles.inset, styles.slots]}>
          <Slot cant={-3.2} onPress={onBuild} />
          <View style={styles.medallion}>
            <Text style={styles.medallionText}>VS</Text>
          </View>
          <Slot cant={3.2} onPress={onBuild} />
        </View>
      )}

      <Pressable
        onPress={onSurprise}
        disabled={!canSurprise}
        accessibilityRole="button"
        accessibilityLabel="Surprise me with a random iconic clash"
        style={({ pressed }) => [
          styles.inset,
          styles.surprise,
          pressed && styles.dim,
          !canSurprise && styles.off,
        ]}
      >
        <Ionicons name="shuffle" size={15} color={COLORS.goldAccent} />
        <Text style={styles.surpriseText}>Surprise me — a random iconic clash</Text>
      </Pressable>

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

function Slot({ cant, onPress }: { cant: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Choose a fighter"
      style={({ pressed }) => [
        styles.slot,
        { transform: [{ rotate: `${cant}deg` }] },
        pressed && styles.slotPressed,
      ]}
    >
      <Text style={styles.plus}>+</Text>
      <Text style={styles.slotLabel}>Choose</Text>
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
      <Text style={styles.slotLabel}>{label} · pick 5</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 40 },
  // Everything except the rail is inset; the rail brings its own inset and
  // must reach the physical screen edge (see CLAUDE.md's rail rule).
  inset: { paddingHorizontal: H_PAD },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: 16 },
  title: { fontFamily: 'Flame-Bold', fontSize: 23, lineHeight: 32, color: COLORS.beige },
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
    width: '40%',
    aspectRatio: 3 / 4,
    borderRadius: RADIUS.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,235,220,0.26)',
    backgroundColor: 'rgba(41,60,67,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  slotPressed: { borderColor: COLORS.orange, backgroundColor: 'rgba(231,115,51,0.1)' },
  plus: {
    fontFamily: 'Flame-Bold',
    fontSize: 23,
    lineHeight: 32,
    color: INK_TEXT.faint,
  },
  slotLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  squad: {
    width: '40%',
    borderRadius: RADIUS.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245,235,220,0.26)',
    backgroundColor: 'rgba(41,60,67,0.28)',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
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
    fontFamily: 'Flame-Bold',
    fontSize: 12,
    lineHeight: 16,
    color: INK_TEXT.faint,
  },

  surprise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 13,
  },
  surpriseText: { fontFamily: 'FlameSans-Regular', fontSize: 14, color: COLORS.goldAccent },
  dim: { opacity: 0.6 },
  off: { opacity: 0.35 },

  ready: { marginTop: 8, paddingTop: 16 },
  readyHead: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,235,220,0.14)',
    paddingTop: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  readyLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  readyCount: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
});
