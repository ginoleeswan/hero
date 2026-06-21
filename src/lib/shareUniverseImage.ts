// src/lib/shareUniverseImage.ts — NATIVE capture+share for the "My Universe"
// poster. Snapshots the off-screen ShareableUniverseCard to a PNG
// (react-native-view-shot) and opens the OS share sheet (expo-sharing). The
// .web.ts sibling redraws the poster via canvas.
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { UNIVERSE_CARD_SIZE } from '../components/profile/ShareableUniverseCard';
import type { UniversePosterData } from './shareUniverseImage.types';

export type ShareImageResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

export async function captureAndShareUniverse(
  ref: RefObject<View | null>,
  // `poster` is web-only (its canvas renderer draws from data); native snapshots
  // the already-rendered card via the ref, so it's ignored here.
  opts: { title: string; filename: string; poster?: UniversePosterData },
): Promise<ShareImageResult> {
  try {
    if (!ref.current) return 'error';
    // Lazy-import so Expo Go (which lacks the ExpoSharing native module) doesn't
    // crash on module load — the import only runs when sharing is actually invoked.
    const Sharing = await import('expo-sharing');
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      width: UNIVERSE_CARD_SIZE,
      height: UNIVERSE_CARD_SIZE,
    });
    if (!(await Sharing.isAvailableAsync())) return 'unsupported';
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: opts.title,
      UTI: 'public.png',
    });
    return 'shared';
  } catch {
    return 'error';
  }
}
