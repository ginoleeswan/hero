// src/components/ui/ShareHeaderButton.tsx
// The share affordance for pages whose header is a floating transparent bar:
// house, event and title. One component rather than three, because three
// copies of a Share.share call is how the character page ended up sharing a
// sentence with no link in it while the universe button did it correctly.
//
// It always sends a real URL. That is the whole point — api/og renders a card
// per page type, and a card only ever renders if something put the link in the
// share sheet.
import { Pressable, Share, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../constants/colors';
import { RADIUS } from '../../design';
import { nativeShare } from '../../lib/share';

export function ShareHeaderButton({
  message,
  url,
  label,
  tint = COLORS.beige,
  floating = false,
}: {
  message: string;
  url: string;
  /** Spoken name — "Share this house", not "Share". */
  label: string;
  tint?: string;
  /** Draw the dark disc the back chevron sits on (for headers over artwork). */
  floating?: boolean;
}) {
  const onPress = () => {
    Haptics.selectionAsync();
    Share.share(nativeShare(message, url, Platform.OS === 'ios')).catch(() => {
      // a dismissed sheet rejects, which is not an error worth reporting
    });
  };
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }: { pressed: boolean }) =>
        [styles.btn, floating && styles.floating, pressed && styles.pressed] as object
      }
    >
      {/* The SYSTEM share glyph, not a generic one. The character page and the
          arena already use square.and.arrow.up here — it is what an iOS reader
          recognises as "share" without reading a label, and three different
          glyphs for one action across a nav bar is the kind of thing that reads
          as several apps stitched together. Ionicons is the Android fallback. */}
      <SymbolView
        name="square.and.arrow.up"
        weight="semibold"
        tintColor={tint}
        size={21}
        resizeMode="scaleAspectFit"
        style={styles.icon}
        fallback={<Ionicons name="share-social-outline" size={20} color={tint} />}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  icon: { width: 21, height: 21 },
  // A disc, so RADIUS.pill rather than a hand-computed half-of-36.
  floating: { borderRadius: RADIUS.pill, backgroundColor: 'rgba(0,0,0,0.45)' },
  pressed: { opacity: 0.7 },
});
