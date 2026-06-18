// src/lib/shareMatchupImage.web.ts — WEB capture+share via a CANVAS renderer.
//
// We do NOT snapshot the DOM: html-to-image / modern-screenshot both render this
// RN-web card as a blank rectangle (Chromium rasterizes the complex <foreignObject>
// as empty). Canvas 2D is bulletproof here, so we redraw the poster directly from
// data — mirroring the ShareableMatchupCard design — then share/download it.
// Portraits are CORS-clean (Cloudinary), so drawImage + toBlob never taints.
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { COLORS } from '../constants/colors';
import { SHARE_CARD_SIZE } from '../components/compare/ShareableMatchupCard';

export type ShareImageResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

export interface PosterData {
  nameA: string;
  nameB: string;
  imageA: { uri: string } | null;
  imageB: { uri: string } | null;
  winner: 'A' | 'B' | 'tie';
  verdict: string | null;
  pctA: number;
  pctB: number;
  caption: string;
}

interface ShareNavigator {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string }) => Promise<void>;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = uri;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Cover-fit an image into a rounded box, optionally mirrored (faces inward). */
function drawPortrait(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  mirror: boolean,
  dim: boolean,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 36);
  ctx.clip();
  ctx.fillStyle = '#1b2a30';
  ctx.fillRect(x, y, w, h);
  if (img) {
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    const dx = x + (w - dw) / 2;
    const dy = y; // top-anchored, like contentPosition="top"
    if (mirror) {
      ctx.translate(x + w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, x + w - dx - dw, dy, dw, dh);
    } else {
      ctx.drawImage(img, dx, dy, dw, dh);
    }
    if (dim) {
      ctx.fillStyle = 'rgba(12,17,20,0.5)';
      ctx.fillRect(x, y, w, h);
    }
    // Bottom scrim so the name reads.
    const grad = ctx.createLinearGradient(0, y + h - 240, 0, y + h);
    grad.addColorStop(0, 'rgba(10,16,20,0)');
    grad.addColorStop(1, 'rgba(10,16,20,0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y + h - 240, w, 240);
  }
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

async function renderPoster(d: PosterData): Promise<HTMLCanvasElement> {
  const N = SHARE_CARD_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d')!;

  // Canvas only uses a custom face if it's actually loaded — document.fonts.ready
  // doesn't *trigger* a load, so explicitly load each family (the @font-face rules
  // are injected by expo-font; exact names: Flame-Regular, Nunito_700Bold,
  // Nunito_400Regular). Without this the wordmark/names fall back to system sans.
  const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (fonts) {
    await Promise.all([
      fonts.load('56px "Flame-Regular"'),
      fonts.load('26px "Nunito_700Bold"'),
      fonts.load('30px "Nunito_400Regular"'),
    ]).catch(() => {
      /* a face failed to load — canvas falls back to the system stack */
    });
  }

  const [imgA, imgB] = await Promise.all([
    d.imageA?.uri ? loadImage(d.imageA.uri).catch(() => null) : Promise.resolve(null),
    d.imageB?.uri ? loadImage(d.imageB.uri).catch(() => null) : Promise.resolve(null),
  ]);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, N);
  bg.addColorStop(0, '#1b2a30');
  bg.addColorStop(1, COLORS.deepNavy);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, N, N);

  ctx.textAlign = 'center';

  // Header
  ctx.fillStyle = COLORS.beige;
  ctx.font = '56px "Flame-Regular", serif';
  ctx.fillText('mythique', N / 2, 112);
  ctx.fillStyle = COLORS.goldAccent;
  ctx.font = '26px "Nunito_700Bold", sans-serif';
  ctx.fillText('W H O   W O U L D   W I N ?', N / 2, 160);

  // Portrait panels
  const top = 210;
  const h = 600;
  const pw = 458;
  const lx = 56;
  const rx = N - 56 - pw;
  const winA = d.winner === 'A';
  const winB = d.winner === 'B';
  drawPortrait(ctx, imgA, lx, top, pw, h, false, winB);
  drawPortrait(ctx, imgB, rx, top, pw, h, true, winA);

  // Winner glow + pill
  const drawWinner = (x: number) => {
    ctx.save();
    ctx.strokeStyle = COLORS.goldAccent;
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(206,155,51,0.5)';
    ctx.shadowBlur = 60;
    roundRect(ctx, x, top, pw, h, 36);
    ctx.stroke();
    ctx.restore();
    // pill
    ctx.save();
    ctx.fillStyle = 'rgba(14,20,24,0.8)';
    ctx.strokeStyle = COLORS.goldAccent;
    ctx.lineWidth = 2;
    const pillW = 168;
    const px = x + (pw - pillW) / 2;
    roundRect(ctx, px, top + 26, pillW, 50, 25);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.goldAccent;
    ctx.font = '22px "Nunito_700Bold", sans-serif';
    ctx.fillText('W I N N E R', x + pw / 2, top + 58);
    ctx.restore();
  };
  if (winA) drawWinner(lx);
  if (winB) drawWinner(rx);

  // Names — always legible in the portrait: a drop shadow over the scrim, and
  // the font auto-shrinks so long names never overflow / clip the panel.
  const drawName = (name: string, centerX: number, dim: boolean) => {
    let size = 46;
    const maxW = pw - 40;
    ctx.font = `${size}px "Flame-Regular", serif`;
    while (ctx.measureText(name).width > maxW && size > 24) {
      size -= 2;
      ctx.font = `${size}px "Flame-Regular", serif`;
    }
    ctx.save();
    ctx.fillStyle = dim ? 'rgba(245,235,220,0.6)' : COLORS.beige;
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
    ctx.fillText(name, centerX, top + h - 40);
    ctx.restore();
  };
  drawName(d.nameA, lx + pw / 2, winB);
  drawName(d.nameB, rx + pw / 2, winA);

  // VS badge
  const cx = N / 2;
  const cy = top + h / 2;
  ctx.save();
  ctx.fillStyle = COLORS.orange;
  ctx.strokeStyle = COLORS.deepNavy;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '44px "Flame-Regular", serif';
  ctx.fillText('VS', cx, cy + 15);
  ctx.restore();

  // Split bar
  const barY = top + h + 56;
  const barX = 56;
  const barW = N - 112;
  const aw = Math.round((barW * Math.max(d.pctA, 1)) / Math.max(d.pctA + d.pctB, 1));
  ctx.save();
  roundRect(ctx, barX, barY, barW, 24, 12);
  ctx.clip();
  ctx.fillStyle = COLORS.orange;
  ctx.fillRect(barX, barY, aw, 24);
  ctx.fillStyle = COLORS.blue;
  ctx.fillRect(barX + aw, barY, barW - aw, 24);
  ctx.restore();

  // Bar labels
  ctx.font = '38px "Flame-Regular", serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.orange;
  ctx.fillText(`${d.pctA}%`, barX, barY + 78);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.blue;
  ctx.fillText(`${d.pctB}%`, barX + barW, barY + 78);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(245,235,220,0.6)';
  ctx.font = '22px "Nunito_700Bold", sans-serif';
  ctx.fillText(d.caption.toUpperCase(), N / 2, barY + 72);

  // Verdict (wrapped)
  let y = barY + 140;
  if (d.verdict) {
    ctx.font = 'italic 30px "Nunito_400Regular", sans-serif';
    ctx.fillStyle = 'rgba(245,235,220,0.85)';
    const lines = wrapText(ctx, `“${d.verdict}”`, N - 200);
    for (const ln of lines) {
      ctx.fillText(ln, N / 2, y);
      y += 42;
    }
  }

  // CTA footer
  ctx.font = '22px "Nunito_700Bold", sans-serif';
  ctx.fillStyle = 'rgba(245,235,220,0.4)';
  ctx.fillText('SETTLE THE DEBATE · MYTHIQUE', N / 2, N - 46);

  return canvas;
}

export async function captureAndShareMatchup(
  _ref: RefObject<View | null>,
  opts: { title: string; filename: string; poster: PosterData },
): Promise<ShareImageResult> {
  try {
    const canvas = await renderPoster(opts.poster);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return 'error';

    const file = new File([blob], opts.filename, { type: 'image/png' });
    const nav = navigator as unknown as ShareNavigator;
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], title: opts.title });
      return 'shared';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = opts.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    return 'error';
  }
}
