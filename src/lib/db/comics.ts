import { supabase } from '../supabase';

// "New This Week" — the ComicVine weekly slate, curated to issues featuring a
// recognizable catalogue character. Sibling of db/trending.ts: the get_new_comics
// RPC does the window + fame gate + character join; the client just groups the
// flat rows (issue fields repeated per character) into issues.

export interface NewComicCharacter {
  id: string;
  name: string;
  image_url: string | null;
  portrait_url: string | null;
}

export interface IssueCreator {
  name: string;
  role: string | null;
}

export interface NewComic {
  id: string; // 'cvi:<comicvine_issue_id>'
  volumeName: string | null;
  issueNumber: string | null;
  coverUrl: string | null;
  storeDate: string | null;
  publisher: string | null;
  /** ComicVine synopsis (plaintext). Only populated on the single-issue fetch
   *  (getIssueById); null on rail rows from get_new_comics. */
  description: string | null;
  /** The issue's story name + its creators — best-effort (ComicVine tags
   *  established issues; brand-new ones come back empty). getIssueById only. */
  storyTitle: string | null;
  creators: IssueCreator[] | null;
  characters: NewComicCharacter[];
}

export interface NewComicRow {
  issue_id: string;
  volume_name: string | null;
  issue_number: string | null;
  cover_url: string | null;
  store_date: string | null;
  publisher: string | null;
  max_fame: number | null;
  hero_id: string;
  hero_name: string;
  hero_image_url: string | null;
  hero_portrait_url: string | null;
}

/** Flat RPC rows → grouped issues, preserving the RPC's order (issues by recency
 *  then fame, characters lead-first within each issue). */
export function groupComicRows(rows: NewComicRow[]): NewComic[] {
  const byId = new Map<string, NewComic>();
  for (const r of rows) {
    let c = byId.get(r.issue_id);
    if (!c) {
      c = {
        id: r.issue_id,
        volumeName: r.volume_name,
        issueNumber: r.issue_number,
        coverUrl: r.cover_url,
        storeDate: r.store_date,
        publisher: r.publisher,
        description: null,
        storyTitle: null,
        creators: null,
        characters: [],
      };
      byId.set(r.issue_id, c);
    }
    c.characters.push({
      id: r.hero_id,
      name: r.hero_name,
      image_url: r.hero_image_url,
      portrait_url: r.hero_portrait_url,
    });
  }
  return [...byId.values()];
}

/** The curated comic issues that shipped this week. Degrades to [] so a DB hiccup
 *  never errors the Explore band. */
export async function getNewComics(limit = 12): Promise<NewComic[]> {
  const { data, error } = await supabase.rpc('get_new_comics', { p_limit: limit } as never);
  if (error) {
    console.warn('[getNewComics] error:', error.message);
    return [];
  }
  return groupComicRows((data ?? []) as unknown as NewComicRow[]);
}

interface IssueNestedRow {
  id: string;
  volume_name: string | null;
  issue_number: string | null;
  cover_url: string | null;
  store_date: string | null;
  publisher: string | null;
  description: string | null;
  story_title: string | null;
  creators: IssueCreator[] | null;
  lead_hero_id: string | null;
  comic_issue_appearances: { heroes: NewComicCharacter | null }[] | null;
}

/** A single issue by id ('cvi:<n>') for the issue page. Lead character first,
 *  the rest in graph order. Null on error/not found. */
async function fetchIssueRow(id: string): Promise<NewComic | null> {
  const { data, error } = await supabase
    .from('comic_issues')
    .select(
      'id, volume_name, issue_number, cover_url, store_date, publisher, description, story_title, creators, lead_hero_id, comic_issue_appearances ( heroes ( id, name, image_url, portrait_url ) )',
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as IssueNestedRow;
  const chars = (r.comic_issue_appearances ?? [])
    .map((a) => a.heroes)
    .filter((h): h is NewComicCharacter => h !== null);
  // Put the lead hero first (best-effort; detail view, order is non-critical).
  chars.sort((a, b) => (a.id === r.lead_hero_id ? -1 : b.id === r.lead_hero_id ? 1 : 0));
  return {
    id: r.id,
    volumeName: r.volume_name,
    issueNumber: r.issue_number,
    coverUrl: r.cover_url,
    storeDate: r.store_date,
    publisher: r.publisher,
    description: r.description && r.description.length > 0 ? r.description : null,
    storyTitle: r.story_title && r.story_title.length > 0 ? r.story_title : null,
    creators: r.creators && r.creators.length > 0 ? r.creators : null,
    characters: chars,
  };
}

/** A single issue by id ('cvi:<n>'). Curated weekly issues are already stored;
 *  any other ComicVine issue (a debut, a gallery cover) is fetched + cached
 *  on first view via the get-comicvine-issue read-through, then re-read. */
export async function getIssueById(id: string): Promise<NewComic | null> {
  const cached = await fetchIssueRow(id);
  if (cached) return cached;
  if (!id.startsWith('cvi:')) return null;
  const { error } = await supabase.functions.invoke('get-comicvine-issue', { body: { id } });
  if (error) {
    console.warn('[getIssueById] read-through failed:', error.message);
    return null;
  }
  return fetchIssueRow(id);
}

interface HeroIssueRow {
  id: string;
  volume_name: string | null;
  issue_number: string | null;
  cover_url: string | null;
  store_date: string | null;
  publisher: string | null;
}

/** Recent issues that feature a given character (newest first) — the "New This
 *  Week" rail on the character page. Only the curated in-print window; empty for
 *  characters not in any recent issue. Covers link to `/issue/[id]`. */
export async function getIssuesForHero(heroId: string, days = 21, limit = 12): Promise<NewComic[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('comic_issues')
    .select(
      'id, volume_name, issue_number, cover_url, store_date, publisher, comic_issue_appearances!inner(hero_id)',
    )
    .eq('comic_issue_appearances.hero_id', heroId)
    .gte('store_date', since)
    .not('cover_url', 'is', null)
    .order('store_date', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[getIssuesForHero] error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as HeroIssueRow[]).map((r) => ({
    id: r.id,
    volumeName: r.volume_name,
    issueNumber: r.issue_number,
    coverUrl: r.cover_url,
    storeDate: r.store_date,
    publisher: r.publisher,
    description: null,
    storyTitle: null,
    creators: null,
    characters: [],
  }));
}
