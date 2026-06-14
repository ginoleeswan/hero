import { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Linking } from 'react-native';
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    WebView = require('react-native-webview').WebView;
  } catch {
    // not linked — will fall back to Linking.openURL
  }
}

export function FilmTrailer({ trailerKey }: { trailerKey: string }) {
  const [expanded, setExpanded] = useState(false);
  const embedUrl = `https://www.youtube.com/embed/${trailerKey}`;

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.btn} onPress={() => setExpanded(true)} activeOpacity={0.8}>
        <Ionicons name="play-circle" size={18} color="#fff" />
        <Text style={styles.btnText}>Watch Trailer</Text>
      </TouchableOpacity>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.frame}>
        {/* @ts-ignore — iframe is a web-only element */}
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ border: 'none', borderRadius: 10 }}
        />
      </View>
    );
  }

  if (WebView) {
    return (
      <View style={styles.frame}>
        <WebView
          source={{ uri: embedUrl }}
          style={styles.webView}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${trailerKey}`)}
      activeOpacity={0.8}
    >
      <Ionicons name="play-circle" size={18} color="#fff" />
      <Text style={styles.btnText}>Open Trailer</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    backgroundColor: COLORS.navy,
    borderRadius: 14,
  },
  btnText: {
    fontFamily: 'FlameSans-Regular',
    fontSize: 14,
    color: '#fff',
  },
  frame: {
    width: '100%',
    height: 210,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webView: { flex: 1 },
});
