// app/support.tsx
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Text } from '../src/components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, PAPER_TEXT } from '../src/constants/colors';
import { SectionShell } from '../src/components/profile/SectionShell';
import { openKofi } from '../src/lib/support/kofi';

const TIERS = [
  { icon: 'cafe' as const, label: 'Coffee', amount: '$3' },
  { icon: 'heart' as const, label: 'Fan', amount: '$10' },
  { icon: 'star' as const, label: 'Champion', amount: '$25' },
];

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.column, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
          </Pressable>
          <Text style={styles.title}>Support Mythique</Text>
        </View>

        <SectionShell title="Why support?">
          <Text style={styles.body}>
            Mythique is a free, unofficial fan encyclopedia built by one person. No ads, no paywall
            — just heroes. If it’s brought you a bit of joy, a coffee keeps it alive.
          </Text>
        </SectionShell>

        <SectionShell title="Ways to help">
          <View style={styles.tierRow}>
            {TIERS.map((t) => (
              <Pressable
                key={t.label}
                onPress={openKofi}
                style={({ pressed }) => [styles.tier, pressed && styles.tierPressed]}
              >
                <Ionicons name={t.icon} size={20} color={COLORS.orange} style={styles.tierIcon} />
                <Text style={styles.tierLabel}>{t.label}</Text>
                <Text style={styles.tierAmount}>{t.amount}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>Amounts are suggestions — Ko-fi lets you choose.</Text>
          <Pressable
            onPress={openKofi}
            style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          >
            <Ionicons name="cafe" size={16} color="#fff" />
            <Text style={styles.primaryText}>Buy me a coffee</Text>
          </Pressable>
        </SectionShell>

        <Text style={styles.thanks}>Thank you — it genuinely means a lot.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  column: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    marginLeft: -8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { backgroundColor: 'rgba(41,60,67,0.06)' },
  title: { fontFamily: 'Flame-Regular', fontSize: 30, lineHeight: 37, color: COLORS.navy },
  body: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, color: PAPER_TEXT.faint },
  tierRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tier: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fbf3ea',
    borderWidth: 1,
    borderColor: '#f0e2d0',
  },
  tierPressed: { backgroundColor: '#fdece0', borderColor: COLORS.orange },
  tierIcon: { marginBottom: 2 },
  tierLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  tierAmount: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: PAPER_TEXT.faint },
  note: {
    fontFamily: 'Nunito_400Regular',
    fontSize: 12,
    color: PAPER_TEXT.faint,
    marginBottom: 16,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 13,
  },
  primaryPressed: { opacity: 0.92 },
  primaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  thanks: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    textAlign: 'center',
    marginTop: 8,
  },
});
