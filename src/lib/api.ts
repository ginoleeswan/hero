import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { HeroStats, HeroDetails, FirstIssue, MovieAppearance, IssueCover } from '../types';
import { supabase } from './supabase';

const SUPERHERO_API_KEY = Constants.expoConfig?.extra?.superheroApiKey as string;
const COMICVINE_API_KEY = Constants.expoConfig?.extra?.comicvineApiKey as string;

const SUPERHERO_BASE = 'https://superheroapi.com/api';
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/id';

// CDN response shape (camelCase, numeric powerstats)
interface CdnHeroStats {
  id: number;
  name: string;
  powerstats: Record<string, number>;
  biography: {
    fullName: string;
    alterEgos: string;
    aliases: string[];
    placeOfBirth: string;
    firstAppearance: string;
    publisher: string;
    alignment: string;
  };
  appearance: {
    gender: string;
    race: string;
    height: string[];
    weight: string[];
    eyeColor: string;
    hairColor: string;
  };
  work: { occupation: string; base: string };
  connections: { groupAffiliation: string; relatives: string };
  images: { md: string };
}

function cdnToHeroStats(d: CdnHeroStats): HeroStats {
  return {
    id: String(d.id),
    name: d.name,
    powerstats: {
      intelligence: String(d.powerstats.intelligence ?? 0),
      strength: String(d.powerstats.strength ?? 0),
      speed: String(d.powerstats.speed ?? 0),
      durability: String(d.powerstats.durability ?? 0),
      power: String(d.powerstats.power ?? 0),
      combat: String(d.powerstats.combat ?? 0),
    },
    biography: {
      'full-name': d.biography.fullName,
      'alter-egos': d.biography.alterEgos,
      aliases: d.biography.aliases,
      'place-of-birth': d.biography.placeOfBirth,
      'first-appearance': d.biography.firstAppearance,
      publisher: d.biography.publisher,
      alignment: d.biography.alignment,
    },
    appearance: {
      gender: d.appearance.gender,
      race: d.appearance.race,
      height: d.appearance.height,
      weight: d.appearance.weight,
      'eye-color': d.appearance.eyeColor,
      'hair-color': d.appearance.hairColor,
    },
    work: d.work,
    connections: {
      'group-affiliation': d.connections.groupAffiliation,
      relatives: d.connections.relatives,
    },
    image: { url: d.images.md, portraitUrl: null },
  };
}

// Thrown only when a hero genuinely doesn't exist (an HTTP 404, or the
// SuperheroAPI's `response: "error"` payload) — as opposed to a transient
// network/server failure, which throws a plain Error. The character screen
// branches on this to show "Hero not found" vs. a retryable load error.
export class HeroNotFoundError extends Error {
  constructor(heroId: string) {
    super(`Hero not found: ${heroId}`);
    this.name = 'HeroNotFoundError';
  }
}

export async function fetchHeroStats(heroId: string): Promise<HeroStats> {
  if (Platform.OS === 'web') {
    const res = await fetch(`${CDN_BASE}/${heroId}.json`);
    if (res.status === 404) throw new HeroNotFoundError(heroId);
    if (!res.ok) throw new Error(`CDN error ${res.status}: ${heroId}`);
    const data: CdnHeroStats = await res.json();
    return cdnToHeroStats(data);
  }
  const res = await fetch(`${SUPERHERO_BASE}/${SUPERHERO_API_KEY}/${heroId}`);
  if (res.status === 404) throw new HeroNotFoundError(heroId);
  if (!res.ok) throw new Error(`SuperheroAPI error: ${res.status}`);
  const data = await res.json();
  if (data.response === 'error') throw new HeroNotFoundError(heroId);
  return data as HeroStats;
}

export async function fetchHeroDetails(heroId: string, heroName: string): Promise<HeroDetails> {
  const { data, error } = await supabase.functions.invoke<{
    summary: string | null;
    publisher: string | null;
    firstIssueId: string | null;
    firstIssueData: FirstIssue | null;
    powers: string[] | null;
    description: string | null;
    origin: string | null;
    issueCount: number | null;
    creators: string[] | null;
    enemies: string[] | null;
    friends: string[] | null;
    movies: MovieAppearance[] | null;
    movieCount: number | null;
    teams: string[] | null;
  }>('get-comicvine-hero', { body: { heroId, heroName } });

  if (error) console.warn('[fetchHeroDetails] error:', error.message, error);
  if (error || !data) {
    return {
      summary: null,
      publisher: null,
      firstIssueId: null,
      firstIssueData: null,
      powers: null,
      description: null,
      origin: null,
      issueCount: null,
      creators: null,
      enemies: null,
      friends: null,
      movies: null,
      movieCount: null,
      teams: null,
    };
  }

  return {
    summary: data.summary ?? null,
    publisher: data.publisher ?? null,
    firstIssueId: data.firstIssueId ?? null,
    firstIssueData: data.firstIssueData ?? null,
    powers: data.powers ?? null,
    description: data.description ?? null,
    origin: data.origin ?? null,
    issueCount: data.issueCount ?? null,
    creators: data.creators ?? null,
    enemies: data.enemies ?? null,
    friends: data.friends ?? null,
    movies: data.movies ?? null,
    movieCount: data.movieCount ?? null,
    teams: data.teams ?? null,
  };
}

export async function fetchFirstIssue(issueId: string): Promise<FirstIssue> {
  const params = new URLSearchParams({
    api_key: COMICVINE_API_KEY,
    format: 'json',
    field_list:
      'id,image,name,cover_date,store_date,issue_number,deck,volume,person_credits,first_appearance_characters',
  });

  const res = await fetch(`${COMICVINE_BASE}/issue/4000-${issueId}/?${params}`);
  if (!res.ok) throw new Error(`ComicVine issue error: ${res.status}`);
  const json = await res.json();
  const r = json.results;

  const personCredits: string[] = Array.isArray(r?.person_credits)
    ? r.person_credits
        .map((p: unknown) =>
          p && typeof (p as Record<string, unknown>).name === 'string'
            ? ((p as Record<string, unknown>).name as string)
            : null,
        )
        .filter((n: string | null): n is string => n !== null)
        .slice(0, 5)
    : [];

  const debutCharacters: string[] = Array.isArray(r?.first_appearance_characters)
    ? r.first_appearance_characters
        .map((c: unknown) =>
          c && typeof (c as Record<string, unknown>).name === 'string'
            ? ((c as Record<string, unknown>).name as string)
            : null,
        )
        .filter((n: string | null): n is string => n !== null)
        .slice(0, 8)
    : [];

  return {
    id: issueId,
    imageUrl: r?.image?.medium_url ?? null,
    name: r?.name ?? null,
    coverDate: r?.cover_date ?? null,
    storeDate: r?.store_date ?? null,
    issueNumber: r?.issue_number != null ? String(r.issue_number) : null,
    deck: r?.deck ?? null,
    seriesName: r?.volume?.name ?? null,
    personCredits: personCredits.length > 0 ? personCredits : null,
    debutCharacters: debutCharacters.length > 0 ? debutCharacters : null,
  };
}

export async function fetchHeroGallery(
  heroId: string,
  comicvineId: string,
): Promise<{ issueCovers: IssueCover[] | null }> {
  const { data, error } = await supabase.functions.invoke<{
    issueCovers: IssueCover[] | null;
  }>('get-hero-gallery', { body: { heroId, comicvineId } });

  if (error) console.warn('[fetchHeroGallery] error:', error.message, error);
  if (error || !data) {
    return { issueCovers: null };
  }
  return {
    issueCovers: data.issueCovers ?? null,
  };
}

export interface VerdictInput {
  // Hero ids let the edge function read/write the shared verdict cache. Optional
  // so callers that only have names still get a (non-cached) verdict.
  heroAId?: string;
  heroBId?: string;
  heroA: string;
  heroB: string;
  winsA: number;
  winsB: number;
  statsA: Record<string, number>;
  statsB: Record<string, number>;
}

function verdictFallback(input: VerdictInput): string {
  const { heroA, heroB, winsA, winsB } = input;
  if (winsA === winsB) return `${heroA} and ${heroB} are evenly matched — ${winsA} stats each.`;
  const winner = winsA > winsB ? heroA : heroB;
  const wins = Math.max(winsA, winsB);
  return `${winner} takes it — ${wins} of 6 stats.`;
}

// Generous timeout: the Gemini call runs ~0.7–2s server-side, and on web the
// browser adds a CORS preflight round-trip before the POST. 3s tripped the
// fallback on web even though the edge function succeeded; 9s leaves headroom
// while still bounding a genuinely hung request. Verdicts are cached per
// matchup (React Query, staleTime: Infinity), so this cost is paid once.
const VERDICT_TIMEOUT_MS = 9000;

export async function generateVerdict(input: VerdictInput): Promise<string> {
  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<{ verdict?: string }>('generate-verdict', { body: input }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), VERDICT_TIMEOUT_MS),
      ),
    ]);
    if (error || !data) return verdictFallback(input);
    return data.verdict?.trim() || verdictFallback(input);
  } catch {
    return verdictFallback(input);
  }
}

// --- Team battle verdicts ---------------------------------------------------
export interface TeamVerdictInput {
  teamAId: string; teamBId: string; teamA: string; teamB: string; splitA: number; splitB: number;
}

function teamVerdictFallback(input: TeamVerdictInput): string {
  const { teamA, teamB, splitA, splitB } = input;
  if (splitA === splitB) return `${teamA} and ${teamB} are dead even.`;
  const winner = splitA > splitB ? teamA : teamB;
  return `${winner} take it — synergy and stats favour them.`;
}

export async function generateTeamVerdict(input: TeamVerdictInput): Promise<string> {
  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke<{ verdict?: string }>('generate-team-verdict', { body: input }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 9000)),
    ]);
    if (error || !data) return teamVerdictFallback(input);
    return data.verdict?.trim() || teamVerdictFallback(input);
  } catch {
    return teamVerdictFallback(input);
  }
}

// --- Wikidata entity summaries (admin review) -------------------------------
// Label + description for a batch of QIDs, so the admin "Needs you" review can
// show what each candidate actually is inline instead of linking out. Wikidata's
// API is CORS-enabled (origin=*), so the web console calls it directly.
export interface WikidataSummary {
  label: string;
  description: string;
  image: string | null; // P18 thumbnail, for visual disambiguation
}

/** Commons thumbnail URL for a P18 filename (Special:FilePath handles spaces). */
function commonsThumb(filename: string, width = 96): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`;
}

/** Lead-image thumbnails for a batch of enwiki page titles → { title: url }. */
async function fetchWikipediaThumbs(titles: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    // pilicense=any is essential here: comic-character lead images are almost
    // always non-free fair-use, which the default (free-only) would exclude.
    const url =
      'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
      `&prop=pageimages&piprop=thumbnail&pithumbsize=96&pilicense=any&titles=${batch.map(encodeURIComponent).join('|')}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = (await res.json()) as {
        query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string } }> };
      };
      for (const page of Object.values(body.query?.pages ?? {})) {
        if (page.title && page.thumbnail?.source) out[page.title] = page.thumbnail.source;
      }
    } catch {
      /* ignore — entity just stays imageless */
    }
  }
  return out;
}

// Session-lived cache so revisiting the review (or paging in more) never refetches
// a QID we've already resolved.
const wikidataCache = new Map<string, WikidataSummary>();

export async function fetchWikidataEntities(
  qids: string[],
): Promise<Record<string, WikidataSummary>> {
  const requested = [...new Set(qids.filter((q) => /^Q\d+$/.test(q)))];
  if (requested.length === 0) return {};
  const out: Record<string, WikidataSummary> = {};
  // Serve cached entities immediately; only fetch the ones we haven't seen.
  const unique = requested.filter((q) => {
    const hit = wikidataCache.get(q);
    if (hit) {
      out[q] = hit;
      return false;
    }
    return true;
  });
  if (unique.length === 0) return out;
  const enwikiTitle: Record<string, string> = {}; // qid → enwiki title (for image fallback)
  // wbgetentities accepts up to 50 ids per call. Claims → P18, sitelinks → enwiki.
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const url =
      'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*' +
      `&props=labels|descriptions|claims|sitelinks&languages=en&ids=${batch.join('|')}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const body = (await res.json()) as {
        entities?: Record<
          string,
          {
            labels?: { en?: { value?: string } };
            descriptions?: { en?: { value?: string } };
            claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] };
            sitelinks?: { enwiki?: { title?: string } };
          }
        >;
      };
      for (const [qid, ent] of Object.entries(body.entities ?? {})) {
        const file = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        out[qid] = {
          label: ent.labels?.en?.value ?? qid,
          description: ent.descriptions?.en?.value ?? '',
          image: typeof file === 'string' && file ? commonsThumb(file) : null,
        };
        if (!out[qid].image && ent.sitelinks?.enwiki?.title)
          enwikiTitle[qid] = ent.sitelinks.enwiki.title;
      }
    } catch {
      /* leave this batch unresolved; UI falls back to the QID */
    }
  }

  // Fallback: pull the Wikipedia lead image for entities that lack a P18.
  const titles = Object.values(enwikiTitle);
  if (titles.length > 0) {
    const thumbs = await fetchWikipediaThumbs(titles);
    for (const [qid, title] of Object.entries(enwikiTitle)) {
      if (thumbs[title]) out[qid].image = thumbs[title];
    }
  }
  // Cache everything we just resolved for the rest of the session.
  for (const qid of unique) if (out[qid]) wikidataCache.set(qid, out[qid]);
  return out;
}
