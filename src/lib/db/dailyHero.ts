// Data layer for the daily "Guess the Hero" game. The puzzle (today's answer +
// its comparison attributes) comes from the get_daily_hero RPC; guesses are
// resolved client-side against it (honour-system, like Wordle).
import { supabase } from '../supabase';
import { parseFirstYear, type GuessHero } from '../game/guessCompare';
import type { Hero } from './heroes';

export interface DailyPuzzle {
  number: number;
  date: string; // YYYY-MM-DD
  hero: GuessHero;
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

function rawToGuessHero(h: RawDailyHero): GuessHero {
  return {
    id: h.id,
    name: h.name,
    imageUrl: h.image_url,
    portraitUrl: h.portrait_url,
    publisher: h.publisher,
    alignment: h.alignment,
    origin: h.origin,
    gender: h.gender,
    firstYear: parseFirstYear(h.first_appearance),
    powerTotal: h.powerstats_total ?? null,
    powers: h.powers ?? [],
  };
}

/** Fields a guessed hero needs for comparison (subset of the heroes row). */
type GuessableHero = Pick<
  Hero,
  | 'id'
  | 'name'
  | 'image_url'
  | 'portrait_url'
  | 'publisher'
  | 'alignment'
  | 'origin'
  | 'gender'
  | 'first_appearance'
  | 'powerstats_total'
  | 'powers'
>;

/** Convert a full heroes row (from getHeroById) into a comparable guess. */
export function heroToGuessHero(h: GuessableHero): GuessHero {
  return {
    id: h.id,
    name: h.name,
    imageUrl: h.image_url,
    portraitUrl: h.portrait_url,
    publisher: h.publisher,
    alignment: h.alignment,
    origin: h.origin,
    gender: h.gender,
    firstYear: parseFirstYear(h.first_appearance),
    powerTotal: h.powerstats_total ?? null,
    powers: h.powers ?? [],
  };
}

export async function getDailyHero(): Promise<DailyPuzzle | null> {
  const { data, error } = await supabase.rpc('get_daily_hero');
  if (error || !data) return null;
  const d = data as unknown as { number: number; date: string; hero: RawDailyHero | null };
  if (!d?.hero) return null;
  return { number: d.number, date: d.date, hero: rawToGuessHero(d.hero) };
}
