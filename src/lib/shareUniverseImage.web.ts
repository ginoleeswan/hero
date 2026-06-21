// src/lib/shareUniverseImage.web.ts — WEB capture+share via a CANVAS renderer.
//
// As with the matchup poster, we do NOT snapshot the DOM (RN-web rasterizes the
// card as a blank rectangle in Chromium). Canvas 2D redraws the poster from data
// — mirroring ShareableUniverseCard — then shares (Web Share API) or downloads.
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { COLORS } from '../constants/colors';
import { UNIVERSE_CARD_SIZE } from '../components/profile/ShareableUniverseCard';
import type { UniversePosterData } from './shareUniverseImage.types';

export type ShareImageResult = 'shared' | 'downloaded' | 'unsupported' | 'error';

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

/** Cover-fit an image into a rounded portrait tile with a bottom scrim + name. */
function drawTile(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 32);
  ctx.clip();
  ctx.fillStyle = '#243842';
  ctx.fillRect(x, y, w, h);
  if (img) {
    const sc = Math.max(w / img.width, h / img.height);
    const dw = img.width * sc;
    const dh = img.height * sc;
    ctx.drawImage(img, x + (w - dw) / 2, y, dw, dh); // top-anchored
  } else {
    ctx.fillStyle = 'rgba(245,235,220,0.5)';
    ctx.font = '140px "Flame-Regular", serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.charAt(0), x + w / 2, y + h / 2 + 50);
  }
  // Bottom scrim
  const grad = ctx.createLinearGradient(0, y + h - 200, 0, y + h);
  grad.addColorStop(0, 'rgba(10,16,20,0)');
  grad.addColorStop(1, 'rgba(10,16,20,0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y + h - 200, w, 200);
  // Name (auto-shrink)
  let size = 34;
  const maxW = w - 24;
  ctx.font = `${size}px "Flame-Regular", serif`;
  while (ctx.measureText(name).width > maxW && size > 16) {
    size -= 2;
    ctx.font = `${size}px "Flame-Regular", serif`;
  }
  ctx.fillStyle = COLORS.beige;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 12;
  ctx.fillText(name, x + w / 2, y + h - 28);
  ctx.restore();
  ctx.restore();
}

function spaced(text: string): string {
  return text.split('').join(' ');
}

/** Lay chips into centred rows that fit maxWidth; draw rounded pills. */
function drawChips(
  ctx: CanvasRenderingContext2D,
  chips: string[],
  centerX: number,
  topY: number,
  maxWidth: number,
): void {
  const padX = 26;
  const gap = 16;
  const rowH = 56;
  ctx.font = '26px "Nunito_700Bold", sans-serif';

  const measured = chips.map((c) => ({ c, w: ctx.measureText(c).width + padX * 2 }));
  const rows: { c: string; w: number }[][] = [];
  let row: { c: string; w: number }[] = [];
  let rowW = 0;
  for (const m of measured) {
    const add = (row.length ? gap : 0) + m.w;
    if (rowW + add > maxWidth && row.length) {
      rows.push(row);
      row = [m];
      rowW = m.w;
    } else {
      row.push(m);
      rowW += add;
    }
  }
  if (row.length) rows.push(row);

  rows.slice(0, 2).forEach((r, ri) => {
    const totalW = r.reduce((sum, m, i) => sum + m.w + (i ? gap : 0), 0);
    let x = centerX - totalW / 2;
    const y = topY + ri * (rowH + 12);
    for (const m of r) {
      ctx.fillStyle = 'rgba(245,235,220,0.12)';
      roundRect(ctx, x, y, m.w, rowH, rowH / 2);
      ctx.fill();
      ctx.fillStyle = COLORS.beige;
      ctx.font = '26px "Nunito_700Bold", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(m.c, x + m.w / 2, y + rowH / 2 + 9);
      x += m.w + gap;
    }
  });
}

async function renderPoster(d: UniversePosterData): Promise<HTMLCanvasElement> {
  const N = UNIVERSE_CARD_SIZE;
  const pad = 64;
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d')!;

  const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
  if (fonts) {
    await Promise.all([
      fonts.load('52px "Flame-Regular"'),
      fonts.load('30px "Nunito_700Bold"'),
    ]).catch(() => {});
  }

  const [avatarImg, ...heroImgs] = await Promise.all([
    d.avatarUri ? loadImage(d.avatarUri).catch(() => null) : Promise.resolve(null),
    ...d.topHeroes
      .slice(0, 3)
      .map((h) => (h.uri ? loadImage(h.uri).catch(() => null) : Promise.resolve(null))),
  ]);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, N);
  bg.addColorStop(0, '#1b2a30');
  bg.addColorStop(1, COLORS.navy);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, N, N);

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.beige;
  ctx.font = '52px "Flame-Regular", serif';
  ctx.fillText('mythique', N / 2, 118);
  ctx.fillStyle = COLORS.orange;
  ctx.font = '26px "Nunito_700Bold", sans-serif';
  ctx.fillText(spaced('MY UNIVERSE'), N / 2, 168);

  // Identity — avatar circle + name + stats
  const avCx = pad + 80;
  const avCy = 300;
  const r = 80;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avCx, avCy, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    const sc = Math.max((r * 2) / avatarImg.width, (r * 2) / avatarImg.height);
    const dw = avatarImg.width * sc;
    const dh = avatarImg.height * sc;
    ctx.drawImage(avatarImg, avCx - dw / 2, avCy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = '#1b2a30';
    ctx.fillRect(avCx - r, avCy - r, r * 2, r * 2);
    ctx.fillStyle = COLORS.beige;
    ctx.font = '64px "Flame-Regular", serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.displayName.slice(0, 2).toUpperCase(), avCx, avCy + 22);
  }
  ctx.restore();
  // Avatar ring
  ctx.beginPath();
  ctx.arc(avCx, avCy, r, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = COLORS.orange;
  ctx.stroke();

  // Name + stats
  const textX = pad + 200;
  const nameMaxW = N - textX - pad;
  let nameSize = 60;
  ctx.font = `${nameSize}px "Flame-Regular", serif`;
  while (ctx.measureText(d.displayName).width > nameMaxW && nameSize > 30) {
    nameSize -= 2;
    ctx.font = `${nameSize}px "Flame-Regular", serif`;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.beige;
  ctx.fillText(d.displayName, textX, avCy - 8);
  ctx.font = '30px "Nunito_700Bold", sans-serif';
  ctx.fillStyle = 'rgba(245,235,220,0.6)';
  ctx.fillText(`${d.savedCount} saved · ${d.badgesEarned} badges`, textX, avCy + 44);

  // Top hero tiles
  const tilesTop = 410;
  const tileH = 400;
  const heroes = d.topHeroes.slice(0, 3);
  if (heroes.length > 0) {
    const gap = 24;
    const tileW = (N - pad * 2 - gap * (heroes.length - 1)) / heroes.length;
    heroes.forEach((h, i) => {
      drawTile(ctx, heroImgs[i] ?? null, h.name, pad + i * (tileW + gap), tilesTop, tileW, tileH);
    });
  }

  // Footer — insight, chips, CTA
  let y = tilesTop + tileH + 70;
  if (d.insight) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.beige;
    ctx.font = '40px "Flame-Regular", serif';
    ctx.fillText(d.insight, N / 2, y);
    y += 56;
  }
  if (d.chips.length > 0) {
    drawChips(ctx, d.chips.slice(0, 6), N / 2, y, N - pad * 2);
  }

  ctx.textAlign = 'center';
  ctx.font = '24px "Nunito_700Bold", sans-serif';
  ctx.fillStyle = 'rgba(245,235,220,0.4)';
  ctx.fillText(spaced('DISCOVER YOURS · MYTHIQUE'), N / 2, N - 46);

  return canvas;
}

export async function captureAndShareUniverse(
  _ref: RefObject<View | null>,
  opts: { title: string; filename: string; poster: UniversePosterData },
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
