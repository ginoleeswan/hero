import type { MediaType, TitleSource } from '../db/titles';

export interface WorkRow {
  workLabel: string;
  year: string | null;
  tmdbMovie: string | null;
  tmdbTv: string | null;
  igdb: string | null;
}

export interface MappedTitle {
  id: string;
  source: TitleSource;
  mediaType: MediaType;
  externalId: string;
  title: string;
  year: number | null;
}

const yearOf = (s: string | null): number | null => {
  if (!s) return null;
  const m = s.match(/(18|19|20)\d{2}/);
  return m ? parseInt(m[0], 10) : null;
};

/**
 * Classify a Wikidata work by WHICH external-id property it carries (robust;
 * the work's P31 "instance of" is ambiguous). Precedence: movie > tv > game.
 */
export function mapWorkRow(r: WorkRow): MappedTitle | null {
  let source: TitleSource;
  let mediaType: MediaType;
  let externalId: string;
  if (r.tmdbMovie) {
    source = 'tmdb';
    mediaType = 'film';
    externalId = r.tmdbMovie;
  } else if (r.tmdbTv) {
    source = 'tmdb';
    mediaType = 'tv';
    externalId = r.tmdbTv;
  } else if (r.igdb) {
    source = 'igdb';
    mediaType = 'game';
    externalId = r.igdb;
  } else return null;
  return {
    id: `${source}:${externalId}`,
    source,
    mediaType,
    externalId,
    title: r.workLabel,
    year: yearOf(r.year),
  };
}

export type PerformerRole = 'performer' | 'voice_actor';

export interface MappedPerson {
  personName: string;
  role: PerformerRole;
}

/** A cast row → hero_people shape. `isVoice` comes from the statement source
 *  (voice-actor property vs. plain cast member). */
export function mapPersonRow(performerName: string, isVoice: boolean): MappedPerson {
  return { personName: performerName, role: isVoice ? 'voice_actor' : 'performer' };
}
