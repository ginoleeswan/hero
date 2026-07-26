import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { INK_TEXT } from '../../constants/colors';

/**
 * Send this universe somewhere else.
 *
 * The scene is the best-looking thing in the app and, until now, the only way
 * to show anyone was a screenshot: there was no share affordance, and the URL
 * didn't even follow you as you travelled. Pairing this with the address bar
 * fix is what turns a universe into something that can be posted.
 *
 * The link resolves to an OG card rendered server-side (see api/og.tsx,
 * type=universe), so what unfurls in a message or a timeline is the poster of
 * the character's world rather than a generic site preview.
 */
export function ShareUniverseButton({
  heroId,
  name,
  compact = false,
}: {
  heroId: string;
  name: string;
  /** Icon only — on a phone the word costs the page title its last 55px. */
  compact?: boolean;
}) {
  const [done, setDone] = useState(false);
  if (!heroId) return null;

  const share = async () => {
    // `location.href` rather than a rebuilt path: travelling updates the params
    // in place, so the address bar is already the canonical link to what's on
    // screen, including any future query state.
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = name ? `${name}'s universe` : 'Universe';
    try {
      // The native sheet is far better than a toast where it exists (all of
      // mobile Safari and Android), and it's the only route to Messages,
      // WhatsApp and the rest.
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      // A cancelled share sheet rejects, which is not an error worth reporting.
    }
  };

  return (
    <Pressable
      onPress={share}
      style={styles.button}
      accessibilityLabel={`Share ${name}'s universe`}
    >
      <View style={styles.inner}>
        <Ionicons
          name={done ? 'checkmark' : 'share-outline'}
          size={15}
          color={done ? INK_TEXT.primary : INK_TEXT.muted}
        />
        <Text style={[styles.label, done && styles.labelDone] as object}>
          {done ? 'Link copied' : 'Share'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,235,220,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  buttonCompact: {
    width: 34,
    height: 34,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: INK_TEXT.muted },
  labelDone: { color: INK_TEXT.primary },
});
