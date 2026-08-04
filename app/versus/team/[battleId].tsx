import { View, ScrollView, StyleSheet, Pressable, Text } from 'react-native';
import { useLocalSearchParams, useRouter, usePathname, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../../src/constants/colors';
import { useTeamBattle } from '../../../src/hooks/useTeamBattle';
import { useAuth } from '../../../src/hooks/useAuth';
import { ClashArena } from '../../../src/components/versus/ClashArena';
import { ClashSkeleton } from '../../../src/components/versus/ClashSkeleton';
import { NotFoundView } from '../../../src/components/NotFoundView';
import { loginHref } from '../../../src/lib/loginRedirect';

export default function TeamClashScreen() {
  const { battleId } = useLocalSearchParams<{ battleId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { loading, failed, sideA, sideB, result, tally, vote } = useTeamBattle(battleId);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/versus'));

  const onVote = async (teamId: string) => {
    if (!user) {
      router.push(loginHref(pathname));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await vote(teamId);
  };

  // A bad/expired battle id or a fetch failure must not skeleton forever —
  // deep links land here with no header, so this is the only way out.
  if (failed || (!loading && (!sideA || !sideB || !result))) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <NotFoundView
          stamp="NO CONTEST"
          icon="people"
          headline="Battle not found"
          subline="This team battle doesn't exist or couldn't be loaded."
          actions={[
            { label: 'Back to the Arena', primary: true, onPress: goBack },
            { label: 'Build a battle', onPress: () => router.replace('/compare/pick') },
          ]}
        />
      </View>
    );
  }

  if (loading || !sideA || !sideB || !result) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <ClashSkeleton topInset={insets.top} bottomInset={insets.bottom} />
        <BackPill onPress={goBack} top={insets.top + 10} />
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
          topInset={insets.top + 44}
          bottomInset={insets.bottom}
        />
      </ScrollView>
      {/* Escape hatch — the stack header is hidden, so without this a
          deep-linked battle has no visible way out. Mirrors draft.tsx. */}
      <BackPill onPress={goBack} top={insets.top + 10} />
    </View>
  );
}

function BackPill({ onPress, top }: { onPress: () => void; top: number }) {
  return (
    <Pressable onPress={onPress} style={[styles.backPill, { top }]} accessibilityRole="button">
      <Ionicons name="arrow-back" size={14} color="rgba(245,235,220,0.85)" />
      <Text style={styles.backPillText}>Arena</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.deepNavy },
  content: { flexGrow: 1 },
  backPill: {
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
  backPillText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    color: 'rgba(245,235,220,0.85)',
  },
});
