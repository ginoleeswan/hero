// The dashboard's standard "nothing here yet" line. One style for the ~10
// hand-rolled grey placeholder texts scattered across the panels.
import { Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../../constants/colors';

export function EmptyState({ text }: { text: string }) {
  return <Text style={styles.text}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: { fontFamily: 'Nunito_400Regular', fontSize: 13.5, color: COLORS.grey, marginTop: 8 },
});
