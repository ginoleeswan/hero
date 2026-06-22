import { View, ScrollView, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../src/constants/colors';
import { useDraftBattle } from '../../../src/hooks/useDraftBattle';
import { ClashArena } from '../../../src/components/versus/ClashArena';
import { parseIds } from '../../../src/lib/parseIds';

export default function DraftClashScreen() {
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const insets = useSafeAreaInsets();
  const aIds = parseIds(params.a);
  const bIds = parseIds(params.b);
  const { loading, sideA, sideB, result } = useDraftBattle(aIds, bIds);

  if (loading) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={COLORS.goldAccent} />
      </View>
    );
  }

  if (!sideA || !sideB || !result) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.empty}>We couldn&apos;t build that battle.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ClashArena
          sideA={sideA}
          sideB={sideB}
          result={result}
          tally={null}
          onVote={() => {}}
          votable={false}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: 'rgba(245,235,220,0.7)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
