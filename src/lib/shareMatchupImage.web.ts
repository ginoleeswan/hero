// src/lib/shareMatchupImage.web.ts — WEB capture+share. Renders the off-screen
// ShareableMatchupCard DOM node to a PNG (html-to-image), then shares it via the
// Web Share API (Level 2, file sharing — mobile Safari/Chrome) or falls back to a
// download. html-to-image re-fetches and inlines images, so remote portraits must
// be CORS-enabled (Cloudinary is; a tainted canvas throws → caught as 'error').
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { toPng } from 'html-to-image';
import { SHARE_CARD_SIZE } from '../components/compare/ShareableMatchupCard';

export type ShareImageResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

interface ShareNavigator {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
}

export async function captureAndShareMatchup(
  ref: RefObject<View | null>,
  opts: { title: string; filename: string },
): Promise<ShareImageResult> {
  try {
    // On RN-web a host View forwards its underlying DOM node through the ref.
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return 'error';

    const dataUrl = await toPng(node, {
      width: SHARE_CARD_SIZE,
      height: SHARE_CARD_SIZE,
      pixelRatio: 1,
      cacheBust: true,
      backgroundColor: '#0b1820',
    });

    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], opts.filename, { type: 'image/png' });
    const nav = navigator as unknown as ShareNavigator;

    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: opts.title });
      return 'shared';
    }

    // No file-share support (most desktop browsers) — download the PNG instead.
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = opts.filename;
    a.click();
    return 'downloaded';
  } catch {
    return 'error';
  }
}
