// src/hooks/useMatchupShareImage.tsx — wires the shareable VS poster to a screen.
// Renders the ShareableMatchupCard off-screen (so it never affects layout), holds
// a ref to it, and exposes share() which snapshots that node to a PNG and hands it
// to the OS / browser share sheet (see src/lib/shareMatchupImage[.web].ts).
//
// The poster's split uses the STAT scorecard (winsA/winsB), not the live crowd
// tally — a freshly-shared matchup usually has ~1 vote, and "100% · 1 fan voted"
// makes a poor poster. The tale-of-the-tape split is always meaningful.
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { statSplit, statLead } from '../lib/home/matchupVote';
import { ShareableMatchupCard } from '../components/compare/ShareableMatchupCard';
import { captureAndShareMatchup, type ShareImageResult } from '../lib/shareMatchupImage';

interface MatchupShareInput {
  nameA: string;
  nameB: string;
  imageA: { uri: string } | null;
  imageB: { uri: string } | null;
  winner: 'A' | 'B' | 'tie';
  verdict: string | null;
  winsA: number;
  winsB: number;
}

export function useMatchupShareImage(input: MatchupShareInput): {
  hiddenCard: ReactElement;
  share: () => Promise<ShareImageResult>;
  busy: boolean;
} {
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const { nameA, nameB, imageA, imageB, winner, verdict, winsA, winsB } = input;
  const { pctA, pctB } = statSplit(winsA, winsB);
  const caption = statLead(winsA, winsB, nameA, nameB);

  const share = useCallback(async (): Promise<ShareImageResult> => {
    if (busy) return 'error';
    setBusy(true);
    try {
      // Make sure the portraits are decoded before the snapshot (native).
      await Promise.allSettled([
        imageA?.uri ? Image.prefetch(imageA.uri) : Promise.resolve(),
        imageB?.uri ? Image.prefetch(imageB.uri) : Promise.resolve(),
      ]);
      return await captureAndShareMatchup(ref, {
        title: `${nameA} vs ${nameB}`,
        filename: `${nameA}-vs-${nameB}.png`.replace(/\s+/g, '-'),
      });
    } finally {
      setBusy(false);
    }
  }, [busy, nameA, nameB, imageA, imageB]);

  const hiddenCard = (
    <View ref={ref} collapsable={false} pointerEvents="none" style={styles.offscreen}>
      <ShareableMatchupCard
        nameA={nameA}
        nameB={nameB}
        imageA={imageA}
        imageB={imageB}
        winner={winner}
        verdict={verdict}
        pctA={pctA}
        pctB={pctB}
        caption={caption}
      />
    </View>
  );

  return { hiddenCard, share, busy };
}

const styles = StyleSheet.create({
  // Kept rendered (so capture has a real node) but pushed far off-screen.
  offscreen: { position: 'absolute', left: -100000, top: 0, opacity: 0 },
});
