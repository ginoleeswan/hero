// Data layer for the daily "Guess the Hero" game. The puzzle (today's answer +
// the fields its portrait/clues are drawn from) comes from the get_daily_hero
// RPC; guesses are checked client-side against it (honour-system, like Wordle).
import { supabase } from '../supabase';
import type { RevealHero } from '../game/reveal';

export interface GuessOption {
  id: string;
  name: string;
}

export interface DailyPuzzle {
  number: number;
  date: string; // YYYY-MM-DD
  hero: RevealHero;
  options: GuessOption[]; // the answer + decoys, pre-shuffled, to tap
}

interface RawDailyHero {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
  publisher: string | null;
  alignment: string | null;
  origin: string | null;
  gender: string | null;
  first_appearance: string | null;
  powerstats_total: number | null;
  powers: string[] | null;
}

function rawToRevealHero(h: RawDailyHero): RevealHero {
  return {
    id: h.id,
    name: h.name,
    imageUrl: h.image_url,
    portraitUrl: h.portrait_url,
    publisher: h.publisher,
    alignment: h.alignment,
    origin: h.origin,
    gender: h.gender,
    firstAppearance: h.first_appearance,
    powers: h.powers ?? [],
  };
}

export async function getDailyHero(): Promise<DailyPuzzle | null> {
  const { data, error } = await supabase.rpc('get_daily_hero');
  if (error || !data) return null;
  const d = data as unknown as {
    number: number;
    date: string;
    hero: RawDailyHero | null;
    options: GuessOption[] | null;
  };
  if (!d?.hero) return null;
  return {
    number: d.number,
    date: d.date,
    hero: rawToRevealHero(d.hero),
    options: d.options ?? [],
  };
}
