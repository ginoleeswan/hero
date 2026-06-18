// src/lib/shareMatchupImage.ts — NATIVE capture+share. Snapshots the off-screen
// ShareableMatchupCard view to a PNG (react-native-view-shot) and opens the OS
// share sheet (expo-sharing). The .web.ts sibling does the browser equivalent.
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { SHARE_CARD_SIZE } from '../components/compare/ShareableMatchupCard';

export type ShareImageResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

export async function captureAndShareMatchup(
  ref: RefObject<View | null>,
  // `poster` is web-only (its canvas renderer draws from data); native snapshots
  // the already-rendered ShareableMatchupCard via the ref, so it's ignored here.
  opts: { title: string; filename: string; poster?: unknown },
): Promise<ShareImageResult> {
  try {
    if (!ref.current) return 'error';
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      width: SHARE_CARD_SIZE,
      height: SHARE_CARD_SIZE,
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
