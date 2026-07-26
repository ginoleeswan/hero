// src/constants/eventBrands.ts
//
// Marks for the watched real-world events in `watched_events` — the live card in
// the Pulse rail renders one of these instead of leaving a name floating in an
// empty box. Keyed by the SAME slug the table uses, so adding an event row and
// adding its mark are the same lookup.
//
// Every mark is a single-path silhouette that paints with `currentColor`, so the
// caller tints it with the event's own accent and all twenty read as one set.
// That uniformity is deliberate: the sources are a mess of formats, palettes and
// eras (a red square, a blue wordmark, a scanned photo), and dropping them onto
// a dark card in their own colours looked like a sponsor wall. They were each
// rendered, traced back to vector, and flattened — see the design doc for the
// pipeline and the per-mark thresholds it needed.
//
// Provenance, because it matters if these are ever redistributed:
//   * Commons (freely licensed): d23, anime-expo, comiket, gamescom, dc-fandome,
//     ccxp, nintendo-direct, game-awards, summer-game-fest, pax, angouleme
//   * en.wikipedia non-free logo uploads, used nominatively to identify the
//     event they name — the same posture as the existing marvel/dc marks in
//     assets/brands: sdcc, nycc, eccc, dragon-con
//   * `typeset: true` — NO logo exists on any Wikipedia for these, so the mark
//     is our own wordmark in the app's display face. Not the official logo, and
//     it should be replaced if a real one ever becomes available.
import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import AngoulemeMark from '../../assets/brands/events/angouleme.svg';
import AnimeExpoMark from '../../assets/brands/events/anime-expo.svg';
import CcxpMark from '../../assets/brands/events/ccxp.svg';
import ComiketMark from '../../assets/brands/events/comiket.svg';
import D23Mark from '../../assets/brands/events/d23.svg';
import DcFandomeMark from '../../assets/brands/events/dc-fandome.svg';
import DragonConMark from '../../assets/brands/events/dragon-con.svg';
import EcccMark from '../../assets/brands/events/eccc.svg';
import FanExpoCanadaMark from '../../assets/brands/events/fan-expo-canada.svg';
import GameAwardsMark from '../../assets/brands/events/game-awards.svg';
import GamescomMark from '../../assets/brands/events/gamescom.svg';
import LuccaMark from '../../assets/brands/events/lucca.svg';
import McmLondonMark from '../../assets/brands/events/mcm-london.svg';
import NintendoDirectMark from '../../assets/brands/events/nintendo-direct.svg';
import NyccMark from '../../assets/brands/events/nycc.svg';
import PaxMark from '../../assets/brands/events/pax.svg';
import SdccMark from '../../assets/brands/events/sdcc.svg';
import SummerGameFestMark from '../../assets/brands/events/summer-game-fest.svg';
import SwceMark from '../../assets/brands/events/swce.svg';
import WonderConMark from '../../assets/brands/events/wondercon.svg';

export interface EventBrand {
  /** Matches `watched_events.slug`. */
  slug: string;
  mark: FC<SvgProps>;
  /** viewBox width ÷ height. Callers size by height and derive width from this,
   *  because these range from a near-square badge (sdcc 0.81) to a very wide
   *  wordmark (nintendo-direct 5.67) and a fixed box would crush one or the
   *  other. */
  aspect: number;
  /** Our own wordmark rather than the event's real logo — no public one exists. */
  typeset?: boolean;
}

export const EVENT_BRANDS: Record<string, EventBrand> = {
  angouleme: { slug: 'angouleme', mark: AngoulemeMark, aspect: 2.24 },
  'anime-expo': { slug: 'anime-expo', mark: AnimeExpoMark, aspect: 1.0 },
  ccxp: { slug: 'ccxp', mark: CcxpMark, aspect: 0.969 },
  comiket: { slug: 'comiket', mark: ComiketMark, aspect: 1.654 },
  d23: { slug: 'd23', mark: D23Mark, aspect: 2.12 },
  'dc-fandome': { slug: 'dc-fandome', mark: DcFandomeMark, aspect: 1.724 },
  'dragon-con': { slug: 'dragon-con', mark: DragonConMark, aspect: 1.293 },
  eccc: { slug: 'eccc', mark: EcccMark, aspect: 1.05 },
  'fan-expo-canada': {
    slug: 'fan-expo-canada',
    mark: FanExpoCanadaMark,
    aspect: 1.698,
    typeset: true,
  },
  'game-awards': { slug: 'game-awards', mark: GameAwardsMark, aspect: 2.94 },
  gamescom: { slug: 'gamescom', mark: GamescomMark, aspect: 4.023 },
  lucca: { slug: 'lucca', mark: LuccaMark, aspect: 2.967, typeset: true },
  'mcm-london': { slug: 'mcm-london', mark: McmLondonMark, aspect: 1.5, typeset: true },
  'nintendo-direct': { slug: 'nintendo-direct', mark: NintendoDirectMark, aspect: 5.67 },
  nycc: { slug: 'nycc', mark: NyccMark, aspect: 2.703 },
  pax: { slug: 'pax', mark: PaxMark, aspect: 2.913 },
  sdcc: { slug: 'sdcc', mark: SdccMark, aspect: 0.81 },
  'summer-game-fest': {
    slug: 'summer-game-fest',
    mark: SummerGameFestMark,
    aspect: 1.42,
  },
  swce: { slug: 'swce', mark: SwceMark, aspect: 2.414, typeset: true },
  wondercon: { slug: 'wondercon', mark: WonderConMark, aspect: 4.077, typeset: true },
};

/** The mark for a watched event, or undefined if we don't have one. Callers must
 *  handle undefined — a new row can land in `watched_events` before its mark
 *  does, and the card falls back to the headline text. */
export function brandForEvent(slug: string | null | undefined): EventBrand | undefined {
  return slug ? EVENT_BRANDS[slug] : undefined;
}

/** Largest size a mark can take inside `maxWidth` × `maxHeight` without
 *  distorting. Fitting to BOTH bounds is the point: these range from a
 *  near-square badge to a 5.67:1 wordmark, so sizing by height alone overflows
 *  the card and sizing by width alone leaves the square ones tiny. */
export function fitMark(
  brand: EventBrand,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const height = Math.min(maxHeight, maxWidth / brand.aspect);
  return { width: Math.round(height * brand.aspect), height: Math.round(height) };
}
