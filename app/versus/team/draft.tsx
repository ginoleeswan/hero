import { View, ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../src/constants/colors';
import { useDraftBattle } from '../../../src/hooks/useDraftBattle';
import { ClashArena } from '../../../src/components/versus/ClashArena';
import { ClashSkeleton } from '../../../src/components/versus/ClashSkeleton';
import { parseIds } from '../../../src/lib/parseIds';

export default function DraftClashScreen() {
  const params = useLocalSearchParams<{ a?: string; b?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const aIds = parseIds(params.a);
  const bIds = parseIds(params.b);
  const { loading, sideA, sideB, result } = useDraftBattle(aIds, bIds);

  if (loading) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <ClashSkeleton topInset={insets.top + 44} bottomInset={insets.bottom} />
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
          topInset={insets.top + 44}
          bottomInset={insets.bottom}
        />
      </ScrollView>
      {/* Escape hatch back into the builder — a drafted clash is never a dead end. */}
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/compare/pick'))}
        style={[styles.editPill, { top: insets.top + 10 }]}
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={14} color="rgba(245,235,220,0.85)" />
        <Text style={styles.editPillText}>Edit teams</Text>
      </Pressable>
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
  editPill: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(245,235,220,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.14)',
  },
  editPillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.85)',
  },
});
