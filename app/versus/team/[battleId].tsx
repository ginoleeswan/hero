import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { ClashArena } from '../../../src/components/versus/ClashArena';

export default function TeamClashScreen() {
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { loading, sideA, sideB, result, tally, vote } = useTeamBattle(battleId);

  const onVote = async (teamId: string) => {
    if (!user) {
      router.push('/(auth)/login');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await vote(teamId);
  };

  if (loading || !sideA || !sideB || !result) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={COLORS.goldAccent} />
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
          tally={tally}
          onVote={onVote}
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
});
