// Full-width "Load more" row shared by every paginated list (run history,
// review queue, hero search). Beige button, chevron that swaps to a spinner.
import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../../constants/colors';

export function LoadMore({
  onPress,
  loading = false,
  label,
}: {
  onPress: () => void;
  loading?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[styles.row, loading && styles.dim]}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.navy} />
      ) : (
        <Ionicons name="chevron-down" size={14} color={COLORS.navy} />
      )}
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: '#efe6d6',
  },
  text: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  dim: { opacity: 0.4 },
});
