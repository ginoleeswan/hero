// src/hooks/useUniverseShareImage.tsx — wires the shareable "My Universe" poster
// to the profile screen. Renders ShareableUniverseCard off-screen, holds a ref,
// and exposes share() which snapshots it to a PNG and hands it to the OS / browser
// share sheet (see src/lib/shareUniverseImage[.web].ts).
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import {
  ShareableUniverseCard,
  type UniverseHero,
} from '../components/profile/ShareableUniverseCard';
import { captureAndShareUniverse, type ShareImageResult } from '../lib/shareUniverseImage';

interface UniverseShareInput {
  displayName: string;
  avatarUri: string | null;
  insight: string;
  chips: string[];
  topHeroes: UniverseHero[];
  savedCount: number;
  badgesEarned: number;
}

export function useUniverseShareImage(input: UniverseShareInput): {
  hiddenCard: ReactElement;
  share: () => Promise<ShareImageResult>;
  busy: boolean;
} {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const { displayName, avatarUri, insight, chips, topHeroes, savedCount, badgesEarned } = input;

  const share = useCallback(async (): Promise<ShareImageResult> => {
    if (busy) return 'error';
    setBusy(true);
    try {
      // Decode the avatar + hero portraits before the snapshot (native).
      await Promise.allSettled([
        avatarUri ? Image.prefetch(avatarUri) : Promise.resolve(),
        ...topHeroes.map((h) => (h.uri ? Image.prefetch(h.uri) : Promise.resolve())),
      ]);
      return await captureAndShareUniverse(ref, {
        title: `${displayName}'s Mythique universe`,
        filename: `${displayName}-mythique-universe.png`.replace(/\s+/g, '-'),
        poster: { displayName, avatarUri, insight, chips, topHeroes, savedCount, badgesEarned },
      });
    } finally {
      setBusy(false);
    }
  }, [busy, displayName, avatarUri, insight, chips, topHeroes, savedCount, badgesEarned]);

  const hiddenCard = (
    <View ref={ref} collapsable={false} pointerEvents="none" style={styles.offscreen}>
      <ShareableUniverseCard
        displayName={displayName}
        avatarUri={avatarUri}
        insight={insight}
        chips={chips}
        topHeroes={topHeroes}
        savedCount={savedCount}
        badgesEarned={badgesEarned}
      />
    </View>
  );

  return { hiddenCard, share, busy };
}

const styles = StyleSheet.create({
  // Kept rendered (so capture has a real node) but pushed far off-screen.
  // NO `opacity: 0` here. react-native-view-shot captures what the layer renders, and
  // a layer at zero opacity renders nothing — the snapshot comes back blank
  // while still being a full-size PNG, so it looks like a real file in the
  // share sheet and is empty when opened. Pushing the node far off-screen is
  // what hides it; the opacity was belt-and-braces that silently broke the
  // thing it was protecting.
  offscreen: { position: 'absolute', left: -100000, top: 0 },
});
