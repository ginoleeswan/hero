import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getPowerIcon } from '../../constants/powerIcons';
import type { PowerExplainer } from '../../lib/db/heroFacts';

const MAX_SIGNATURE = 4;

/**
 * The powers that headline the Abilities section. A tile without a story is a
 * dead box — only explainer-backed powers qualify, in the hero's power order,
 * capped at one balanced row of four. No explainers → no tier.
 */
export function pickSignaturePowers(
  powers: string[] | null | undefined,
  explainers: PowerExplainer[],
): { name: string; blurb: string }[] {
  if (!powers || powers.length === 0) return [];
  const blurbByPower = new Map(explainers.map((e) => [e.power.toLowerCase(), e.text]));
  return powers
    .filter((p) => blurbByPower.has(p.toLowerCase()))
    .slice(0, MAX_SIGNATURE)
    .map((name) => ({ name, blurb: blurbByPower.get(name.toLowerCase())! }));
}

// Headline tiles for the signature tier — tinted icon badge, name, decoded
// blurb. One even row; every tile carries a blurb so the row reads deliberate.
export function SignaturePowerTiles({
  powers,
  explainers,
  accent,
}: {
  powers: string[] | null | undefined;
  explainers: PowerExplainer[];
  accent: string;
}) {
  const signature = pickSignaturePowers(powers, explainers);
  if (signature.length === 0) return null;
  return (
    <View style={styles.row}>
      {signature.map((p) => (
        <View key={p.name} style={[styles.tile] as object}>
          <View style={styles.tileHead}>
            <View style={[styles.iconBadge, { backgroundColor: accent + '1a' }] as object}>
              <MaterialCommunityIcons
                name={getPowerIcon(p.name).icon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={15}
                color={accent}
              />
            </View>
            <Text style={styles.tileName} numberOfLines={1}>
              {p.name}
            </Text>
          </View>
          <Text style={styles.tileBlurb} numberOfLines={3}>
            {p.blurb}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Flat on the sheet: an accent icon badge + title + blurb, no box chrome —
  // matches the page's flattened bio/power sections (mobile cohesion).
  tile: {
    paddingVertical: 10,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: { fontFamily: 'Nunito_800ExtraBold', fontSize: 13, color: COLORS.navy, flexShrink: 1 },
  tileBlurb: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(41,60,67,0.72)',
  },
});
