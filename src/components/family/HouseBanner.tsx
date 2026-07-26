// src/components/family/HouseBanner.tsx
// The house's ink band: crest, name, words, and the two facts that place it.
//
// Same ink→navy stage every other Mythique screen opens on, landing on the paper
// body over the shared seam hairline — but the crest is the house page's alone,
// and it's what makes the band read as a charter rather than another title bar.
import { View, Text, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SURFACE_GRADIENT, SEAM_COLOR, INK_TEXT, EYEBROW } from '../../constants/colors';
import { HouseCrest } from './HouseCrest';

/** The floating web nav is 64px tall; the band clears it. */
const WEB_NAV_CLEARANCE = 64;

export function HouseBanner({
  name,
  universe,
  words,
  seat,
  blurb,
  memberCount,
  tint,
  maxWidth = 1180,
}: {
  name: string;
  universe: string;
  words: string | null;
  seat: string | null;
  blurb: string | null;
  memberCount: number;
  tint: string;
  maxWidth?: number;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const paddingTop = Platform.OS === 'web' ? undefined : insets.top + 16;

  return (
    <View style={[styles.band, paddingTop !== undefined && { paddingTop }] as object}>
      <View style={[styles.inner, { maxWidth }] as object}>
        <View style={wide ? styles.rowWide : styles.rowNarrow}>
          <HouseCrest name={name} tint={tint} size={wide ? 116 : 84} />

          <View style={[styles.identity, wide && styles.identityWide] as object}>
            <Text style={styles.eyebrow}>{universe}</Text>
            <Text style={[styles.title, !wide && styles.titleNarrow] as object}>{name}</Text>
            {words ? <Text style={styles.words}>“{words}”</Text> : null}
            {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}

            <View style={styles.facts}>
              <Fact label={memberCount === 1 ? 'Member' : 'Members'} value={String(memberCount)} />
              {seat ? (
                <>
                  <View style={styles.factRule} />
                  <Fact label="Seat" value={seat} />
                </>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factValue}>{value}</Text>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    paddingBottom: 30,
    ...Platform.select({
      web: {
        backgroundImage: SURFACE_GRADIENT.stage,
        backgroundColor: COLORS.deepNavy,
        paddingTop: `calc(env(safe-area-inset-top) + ${WEB_NAV_CLEARANCE}px + 22px)`,
      } as object,
      default: {},
    }),
  } as object,
  inner: { width: '100%', alignSelf: 'center', paddingHorizontal: 20 },
  rowWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 26 },
  rowNarrow: { gap: 16 },
  // `flex: 1` only in the row layout — inside the stacked column its zero basis
  // would collapse the whole identity block.
  identity: { gap: 6, minWidth: 0 },
  identityWide: { flex: 1 },
  eyebrow: { ...EYEBROW, color: COLORS.goldAccent } as object,
  // Flame ink runs ~119% of its em box; unclamped display text needs the room.
  title: { fontFamily: 'Flame-Regular', fontSize: 46, lineHeight: 56, color: COLORS.beige },
  titleNarrow: { fontSize: 34, lineHeight: 42 },
  words: {
    fontFamily: 'Flame-Regular',
    fontSize: 18,
    lineHeight: 26,
    color: 'rgba(206,155,51,0.92)',
  },
  blurb: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 23,
    color: INK_TEXT.muted,
    maxWidth: 620,
    marginTop: 2,
  },
  facts: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 14, flexWrap: 'wrap' },
  fact: { gap: 1 },
  factValue: { fontFamily: 'Flame-Regular', fontSize: 20, lineHeight: 26, color: COLORS.beige },
  factLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: INK_TEXT.faint,
  },
  factRule: { width: 1, height: 30, backgroundColor: 'rgba(245,235,220,0.16)' },
});
