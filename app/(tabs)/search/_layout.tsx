// app/(tabs)/search/_layout.tsx — native Stack for the Search tab. The "Search"
// title is the header's left accessory (headerLeft) — a header item, not a
// toolbar button, so it renders without the iOS 26 glass button capsule.
import { Stack } from 'expo-router';
import { Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../src/constants/colors';

export default function SearchLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerLeft: () => <Text style={styles.title}>Search</Text>,
      }}
    />
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: 'Flame-Bold', fontSize: 22, color: COLORS.beige, marginLeft: 4 },
});
