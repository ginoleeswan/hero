// Small shared UI atoms for the catalog-health dashboard.
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

/** Pill chip with an explicit bg/fg (status, source, comicvine-state, …). */
export function Chip({
  bg,
  fg,
  text,
  spinner,
  capitalize,
}: {
  bg: string;
  fg: string;
  text: string;
  spinner?: boolean;
  capitalize?: boolean;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {spinner && <ActivityIndicator size="small" color={fg} style={{ transform: [{ scale: 0.7 }] }} />}
      <Text style={[styles.chipText, capitalize && styles.chipCapitalize, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  chipCapitalize: { textTransform: 'capitalize' },
});
