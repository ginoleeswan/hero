import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import type { HeroNarrative } from '../../lib/db/heroFacts';

interface Props {
  narrative: HeroNarrative | null;
}

export function NarrativeSection({ narrative }: Props) {
  if (!narrative || narrative.isEmpty) return null;
  const { didYouKnow, powerExplainers, eraSummary, tags } = narrative;
  return (
    <View style={styles.container}>
      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((t) => (
            <View key={t.slug} style={styles.tagChip}>
              <Text style={styles.tagText}>{t.label}</Text>
            </View>
          ))}
        </View>
      )}
      {didYouKnow.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.heading}>Did you know</Text>
          {didYouKnow.map((fact, i) => (
            <Text key={i} style={styles.factText}>
              • {fact}
            </Text>
          ))}
        </View>
      )}
      {powerExplainers.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.heading}>Powers explained</Text>
          {powerExplainers.map((p) => (
            <View key={p.power} style={styles.explainer}>
              <Text style={styles.explainerName}>{p.power}</Text>
              <Text style={styles.explainerText}>{p.text}</Text>
            </View>
          ))}
        </View>
      )}
      {eraSummary && (
        <View style={styles.block}>
          <Text style={styles.heading}>Era</Text>
          <Text style={styles.eraText}>{eraSummary}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 24 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    backgroundColor: 'rgba(41,60,67,0.08)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  block: { gap: 10 },
  heading: { fontFamily: 'Flame-Regular', fontSize: 20, color: COLORS.navy },
  factText: { fontFamily: 'FlameSans-Regular', fontSize: 16, lineHeight: 24, color: COLORS.navy },
  explainer: { gap: 2 },
  explainerName: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.navy },
  explainerText: { fontFamily: 'FlameSans-Regular', fontSize: 16, lineHeight: 24, color: COLORS.navy },
  eraText: { fontFamily: 'FlameSans-Regular', fontSize: 16, lineHeight: 24, color: COLORS.navy },
});
