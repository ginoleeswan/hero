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
  offscreen: { position: 'absolute', left: -100000, top: 0, opacity: 0 },
});
