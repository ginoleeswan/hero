import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getPowerIcon, POWER_CATEGORY_META } from '../../constants/powerIcons';
import type { PowerExplainer } from '../../lib/db/heroFacts';

interface Props {
  explainers: PowerExplainer[];
}

// "Decoded" — the power explainers folded into the Abilities section. Each card
// pairs the power's own icon + category accent (so it visually ties back to the
// ability chips above) with a one-line plain-language explanation of why that
// power matters for this hero.
export function PowersDecoded({ explainers }: Props) {
  if (explainers.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Decoded</Text>
      <View style={styles.list}>
        {explainers.map((e) => {
          const def = getPowerIcon(e.power);
          const color = POWER_CATEGORY_META[def.category].color;
          return (
            <View key={e.power} style={styles.card}>
              <View style={[styles.accent, { backgroundColor: color }]} />
              <View style={styles.cardBody}>
                <View style={styles.head}>
                  <MaterialCommunityIcons
                    name={def.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={15}
                    color={color}
                  />
                  <Text style={[styles.name, { color }]}>{e.power}</Text>
                </View>
                <Text style={styles.text}>{e.text}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 22, gap: 12 },
  eyebrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(41,60,67,0.4)',
  },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(41,60,67,0.04)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  accent: { width: 4 },
  cardBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: 13.5,
    letterSpacing: 0.3,
  },
  text: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14.5,
    lineHeight: 21,
    color: COLORS.navy,
  },
});
