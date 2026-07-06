// app/support.web.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SURFACE } from '../src/constants/colors';
import { useScreenChrome } from '../src/hooks/useScreenChrome';
import { SectionShell } from '../src/components/profile/SectionShell';
import { openKofi } from '../src/lib/support/kofi';

const TIERS = [
  { emoji: '☕', label: 'Coffee', amount: '$3' },
  { emoji: '❤️', label: 'Fan', amount: '$10' },
  { emoji: '⭐', label: 'Champion', amount: '$25' },
];

export default function WebSupportScreen() {
  const router = useRouter();
  useScreenChrome({ top: SURFACE.ink, canvas: SURFACE.paper });

  return (
    <View style={styles.root}>
      <View style={styles.column}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.backBtn,
              hovered && (styles.backHover as object),
            ]}
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
                style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.tier,
                  hovered && (styles.tierHover as object),
                ]}
              >
                <Text style={styles.tierEmoji}>{t.emoji}</Text>
                <Text style={styles.tierLabel}>{t.label}</Text>
                <Text style={styles.tierAmount}>{t.amount}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>Amounts are suggestions — Ko-fi lets you choose.</Text>
          <Pressable
            onPress={openKofi}
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.primary,
              hovered && (styles.primaryHover as object),
            ]}
          >
            <Ionicons name="cafe" size={16} color="#fff" />
            <Text style={styles.primaryText}>Buy me a coffee</Text>
          </Pressable>
        </SectionShell>

        <Text style={styles.thanks}>Thank you — it genuinely means a lot. 🧡</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.beige },
  column: {
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 92,
    paddingBottom: 48,
  } as object,
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 18,
    marginLeft: -8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  } as object,
  backHover: { backgroundColor: 'rgba(41,60,67,0.06)' } as object,
  title: { fontFamily: 'Flame-Regular', fontSize: 32, lineHeight: 40, color: COLORS.navy },
  body: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, color: COLORS.grey },
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
    cursor: 'pointer',
  } as object,
  tierHover: { backgroundColor: '#fdece0', borderColor: COLORS.orange } as object,
  tierEmoji: { fontSize: 22 },
  tierLabel: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.navy },
  tierAmount: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, color: COLORS.grey, marginBottom: 16 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.orange,
    borderRadius: 12,
    paddingVertical: 13,
    cursor: 'pointer',
  } as object,
  primaryHover: { opacity: 0.92 } as object,
  primaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  thanks: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.navy,
    textAlign: 'center',
    marginTop: 8,
  },
});
