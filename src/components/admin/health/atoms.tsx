// Small shared UI atoms for the catalog-health dashboard.
import { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

/** Hero thumbnail with a graceful person-icon fallback when the source is
 *  missing OR fails to load (many upstream ComicVine URLs 404). */
export function HeroThumb({
  uri,
  size = 30,
  width,
  height,
  radius = 8,
}: {
  uri?: string | null;
  size?: number;
  width?: number;
  height?: number;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const w = width ?? size;
  const h = height ?? size;
  const show = !!uri && !failed;
  return (
    <View style={[thumbStyles.wrap, { width: w, height: h, borderRadius: radius }]}>
      {show ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: w, height: h }}
          contentFit="cover"
          transition={150}
          onError={() => setFailed(true)}
        />
      ) : (
        <Ionicons
          name="person"
          size={Math.round(Math.min(w, h) * 0.5)}
          color="rgba(41,60,67,0.3)"
        />
      )}
    </View>
  );
}

const thumbStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#efe6d6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

/** Pill chip with an explicit bg/fg (status, source, comicvine-state, …). */
export function Chip({
  bg,
  fg,
  text,
  spinner,
  capitalize,
}: {
  bg: string;
  fg: string;
  text: string;
  spinner?: boolean;
  capitalize?: boolean;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {spinner && (
        <ActivityIndicator size="small" color={fg} style={{ transform: [{ scale: 0.7 }] }} />
      )}
      <Text style={[styles.chipText, capitalize && styles.chipCapitalize, { color: fg }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  chipCapitalize: { textTransform: 'capitalize' },
});
