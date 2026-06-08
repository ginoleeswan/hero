// src/components/search/ScopeBar.tsx — Apple-style publisher scope segments.
// Lives on the dark search canvas, pinned below the native search header.
import { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import type { PublisherFilter } from '../../lib/db/heroes';

const SCOPES: PublisherFilter[] = ['All', 'Marvel', 'DC', 'Other'];

export const ScopeBar = memo(function ScopeBar({
  value,
  onChange,
}: {
  value: PublisherFilter;
  onChange: (v: PublisherFilter) => void;
}) {
  return (
    <View style={styles.row}>
      {SCOPES.map((scope) => {
        const active = scope === value;
        return (
          <Pressable
            key={scope}
            testID={`scope-${scope}`}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(scope);
            }}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{scope}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  seg: {
    paddingHorizontal: 15,
    height: 32,
    justifyContent: 'center',
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(245,235,220,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,235,220,0.14)',
  },
  segActive: { backgroundColor: COLORS.beige, borderColor: COLORS.beige },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: 'rgba(245,235,220,0.62)' },
  labelActive: { color: COLORS.navy },
});
