import { useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  Modal,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

// Lazy require — avoids a hard crash when the module is not linked.
let WebView: React.ComponentType<{
  source: { uri: string };
  style?: object;
  allowsInlineMediaPlayback?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
}> | null = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {
    // not linked — will fall back to Linking.openURL
  }
}

export function FilmTrailer({
  trailerKey,
  accent,
}: {
  trailerKey: string;
  /** Orange hero treatment — the in-stage primary CTA. */
  accent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = Platform.OS === 'web' && width >= 900;
  // `playsinline=1` keeps playback inside the embed on iOS Safari (otherwise it
  // hands off to the fullscreen YouTube player); autoplay since the tap is the
  // user gesture; rel/modestbranding trim the YouTube chrome so it feels in-app.
  const embedUrl = `https://www.youtube.com/embed/${trailerKey}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  const canEmbed = Platform.OS === 'web' || WebView;

  // Web: close on Escape while the player is up.
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);
  const onPress = () => {
    if (canEmbed) setOpen(true);
    else Linking.openURL(`https://www.youtube.com/watch?v=${trailerKey}`);
  };

  // The embed only mounts while `open` — closing (or navigating away, which
  // unmounts this component) tears down the iframe/WebView so audio stops.
  const player =
    Platform.OS === 'web' ? (
      // @ts-ignore — iframe is a web-only element
      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ border: 'none', borderRadius: 14, display: 'block' }}
      />
    ) : WebView ? (
      <WebView
        source={{ uri: embedUrl }}
        style={styles.webView}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
      />
    ) : null;

  return (
    <>
      <View style={wide ? styles.btnWrap : undefined}>
        <TouchableOpacity
          style={[styles.btn, accent && styles.btnAccent] as object}
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Watch trailer"
        >
          <Ionicons name="play-circle" size={18} color="#fff" />
          <Text style={styles.btnText}>Watch Trailer</Text>
        </TouchableOpacity>
      </View>

      {/* Modal portals to the document root on web — escaping the app's
          transformed ancestors so the player centers over a full-screen scrim. */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityLabel="Close trailer"
          />
          <View style={styles.player}>{player}</View>
          <TouchableOpacity
            style={[styles.closeBtn, { top: insets.top + 16 }]}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close trailer"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Collapsed button: left-aligned, max 300px — keeps it proportionate on wide viewports
  btnWrap: {
    alignSelf: 'flex-start',
    maxWidth: 300,
    width: '100%',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 22,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
  },
  btnAccent: {
    backgroundColor: COLORS.orange,
    ...Platform.select({
      web: { boxShadow: '0 8px 20px -6px rgba(231,115,51,0.6)' } as object,
      default: {},
    }),
  },
  btnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: '#fff',
  },
  // ── Lightbox ──
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(7,14,19,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  player: {
    width: '100%',
    maxWidth: 1040,
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...Platform.select({
      web: { boxShadow: '0 40px 90px -30px rgba(0,0,0,0.9)' } as object,
      default: {},
    }),
  } as object,
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webView: { flex: 1, backgroundColor: '#000' },
});
