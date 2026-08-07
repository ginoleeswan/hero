// src/components/family/HouseBanner.tsx
// The house's ink band: crest, name, words, and the two facts that place it.
//
// Same ink→navy stage every other Mythique screen opens on, landing on the paper
// body over the shared seam hairline — but the crest is the house page's alone,
// and it's what makes the band read as a charter rather than another title bar.
import { View, Text, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SURFACE_GRADIENT, SEAM_COLOR, INK_TEXT, EYEBROW } from '../../constants/colors';
import { HouseCrest } from './HouseCrest';

/** The floating web nav is 64px tall; the band clears it. */
const WEB_NAV_CLEARANCE = 64;

/**
 * Native clearance below the safe-area inset. The stack header on this screen
 * is transparent with a floating minimal back chevron (~44pt starting at the
 * inset), so anything closer than this puts the crest and eyebrow underneath
 * the button — which is exactly how the band used to render. Shared with
 * HouseSkeleton's placeholder band so the settle doesn't jump.
 */
export const BANNER_NATIVE_CLEARANCE = 60;

export function HouseBanner({
  name,
  universe,
  words,
  seat,
  blurb,
  memberCount,
  crowned = 0,
  span = null,
  tint,
  maxWidth = 1180,
}: {
  name: string;
  universe: string;
  words: string | null;
  seat: string | null;
  blurb: string | null;
  memberCount: number;
  /** How many members wore a crown. Omitted from the band when none did. */
  crowned?: number;
  /** Outer bounds of every date the house carries: "1–305 AC". */
  span?: string | null;
  tint: string;
  maxWidth?: number;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const paddingTop = Platform.OS === 'web' ? undefined : insets.top + BANNER_NATIVE_CLEARANCE;

  return (
    <View style={[styles.band, paddingTop !== undefined && { paddingTop }] as object}>
      <View style={[styles.inner, { maxWidth }] as object}>
        {/* A phone reads the identity once and then scrolls past it on every
            visit, so the narrow band is a masthead rather than a poster: the
            crest sits beside the name instead of above it, and the four stacked
            stats collapse to one muted line. Roughly 190px back, which is the
            difference between the chart being below the fold and on it. */}
        {wide ? (
          <View style={styles.rowWide}>
            <HouseCrest name={name} tint={tint} size={116} />
            <View style={[styles.identity, styles.identityWide] as object}>
              <Text style={styles.eyebrow}>{universe}</Text>
              <Text style={styles.title}>{name}</Text>
              {words ? <Text style={styles.words}>“{words}”</Text> : null}
              {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}

              {/* Each drops out silently where the catalogue has nothing. */}
              <View style={styles.facts}>
                <Fact
                  label={memberCount === 1 ? 'Member' : 'Members'}
                  value={String(memberCount)}
                />
                {crowned > 0 ? (
                  <>
                    <View style={styles.factRule} />
                    <Fact label="Crowned" value={String(crowned)} icon="crown-outline" />
                  </>
                ) : null}
                {span ? (
                  <>
                    <View style={styles.factRule} />
                    <Fact label="Recorded" value={span} />
                  </>
                ) : null}
                {seat ? (
                  <>
                    <View style={styles.factRule} />
                    <Fact label="Seat" value={seat} />
                  </>
                ) : null}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.narrow}>
            <View style={styles.narrowHead}>
              <HouseCrest name={name} tint={tint} size={54} />
              <View style={styles.narrowTitle}>
                <Text style={styles.eyebrow}>{universe}</Text>
                <Text style={styles.titleNarrow}>{name}</Text>
              </View>
            </View>
            {words ? <Text style={styles.words}>“{words}”</Text> : null}
            {blurb ? <Text style={styles.blurb}>{blurb}</Text> : null}
            <View style={styles.factLine}>
              <Text style={styles.factLineText}>
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </Text>
              {crowned > 0 ? (
                <>
                  <Text style={styles.factDot}>·</Text>
                  <MaterialCommunityIcons
                    name="crown-outline"
                    size={13}
                    color={COLORS.goldAccent}
                  />
                  <Text style={styles.factLineText}>{crowned} crowned</Text>
                </>
              ) : null}
              {span ? (
                <>
                  <Text style={styles.factDot}>·</Text>
                  <Text style={styles.factLineText}>{span}</Text>
                </>
              ) : null}
              {seat ? (
                <>
                  <Text style={styles.factDot}>·</Text>
                  <Text style={styles.factLineText}>{seat}</Text>
                </>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function Fact({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}) {
  return (
    <View style={styles.fact}>
      <View style={styles.factValueRow}>
        {icon ? <MaterialCommunityIcons name={icon} size={17} color={COLORS.goldAccent} /> : null}
        <Text style={styles.factValue}>{value}</Text>
      </View>
      <Text style={styles.factLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1,
    borderBottomColor: SEAM_COLOR,
    paddingBottom: 22,
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
  narrow: { gap: 8 },
  narrowHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  narrowTitle: { flexShrink: 1, minWidth: 0, gap: 2 },
  // `flex: 1` only in the row layout — inside the stacked column its zero basis
  // would collapse the whole identity block.
  identity: { gap: 6, minWidth: 0 },
  identityWide: { flex: 1 },
  eyebrow: { ...EYEBROW, color: COLORS.goldAccent } as object,
  // Flame ink runs ~119% of its em box; unclamped display text needs the room.
  title: { fontFamily: 'Flame-Regular', fontSize: 46, lineHeight: 56, color: COLORS.beige },
  titleNarrow: { fontFamily: 'Flame-Regular', fontSize: 29, lineHeight: 36, color: COLORS.beige },
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
  // One muted line instead of four value-over-label stacks: same facts, a
  // third of the height, and it wraps to two lines at worst.
  factLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  factLineText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: INK_TEXT.muted },
  factDot: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: INK_TEXT.faint },
  fact: { gap: 1 },
  factValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
