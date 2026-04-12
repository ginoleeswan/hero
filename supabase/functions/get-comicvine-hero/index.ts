import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COMICVINE_API_KEY = Deno.env.get('COMICVINE_API_KEY') ?? '';
const COMICVINE_BASE = 'https://comicvine.gamespot.com/api';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const NULL_RESPONSE = {
  summary: null,
  publisher: null,
  firstIssueId: null,
  powers: null,
  description: null,
  origin: null,
  issueCount: null,
  creators: null,
  enemies: null,
  friends: null,
  movies: null,
  teams: null,
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { heroId, heroName } = await req.json() as { heroId: string; heroName: string };
    if (!heroId || !heroName) return json({ error: 'heroId and heroName required' }, 400);

    // List endpoint — character id, deck, publisher, first issue
    const listParams = new URLSearchParams({
      api_key: COMICVINE_API_KEY,
      format: 'json',
      filter: `name:${heroName}`,
      field_list: 'id,deck,publisher,first_appeared_in_issue',
      limit: '1',
    });

    const listRes = await fetch(`${COMICVINE_BASE}/characters/?${listParams}`);
    if (!listRes.ok) return json({ error: `ComicVine error: ${listRes.status}` }, 502);

    const listJson = await listRes.json();
    const result = listJson.results?.[0];

    if (!result) return json(NULL_RESPONSE);

    const summary: string | null = result.deck ?? null;
    const publisher: string | null = result.publisher?.name ?? null;
    const firstIssueId: string | null = result.first_appeared_in_issue?.id
      ? String(result.first_appeared_in_issue.id)
      : null;

    // Detail endpoint — powers + all v2 fields
    let powers: string[] | null = null;
    let description: string | null = null;
    let origin: string | null = null;
    let issueCount: number | null = null;
    let creators: string[] | null = null;
    let enemies: string[] | null = null;
    let friends: string[] | null = null;
    let movies: string[] | null = null;
    let teams: string[] | null = null;

    if (result.id) {
      const detailParams = new URLSearchParams({
        api_key: COMICVINE_API_KEY,
        format: 'json',
        field_list: [
          'powers',
          'origin',
          'character_enemies',
          'character_friends',
          'creators',
          'count_of_issue_appearances',
          'movies',
          'description',
          'teams',
        ].join(','),
      });

      const detailRes = await fetch(`${COMICVINE_BASE}/character/4005-${result.id}/?${detailParams}`);
      if (detailRes.ok) {
        const d = (await detailRes.json()).results ?? {};

        // powers
        const rawPowers: string[] = Array.isArray(d.powers)
          ? d.powers
              .map((p: unknown) =>
                p && typeof (p as Record<string, unknown>).name === 'string'
                  ? ((p as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
          : [];
        powers = rawPowers.length > 0 ? rawPowers : null;

        // description — strip HTML
        const rawDesc: string = typeof d.description === 'string' ? d.description : '';
        const stripped = rawDesc ? stripHtml(rawDesc) : '';
        description = stripped.length > 0 ? stripped : null;

        // origin
        origin = typeof d.origin?.name === 'string' ? d.origin.name : null;

        // issue count
        issueCount = typeof d.count_of_issue_appearances === 'number'
          ? d.count_of_issue_appearances
          : null;

        // creators — names only, capped at 5
        creators = Array.isArray(d.creators)
          ? d.creators
              .map((c: unknown) =>
                c && typeof (c as Record<string, unknown>).name === 'string'
                  ? ((c as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 5)
          : null;
        if (creators?.length === 0) creators = null;

        // enemies
        const rawEnemies: string[] = Array.isArray(d.character_enemies)
          ? d.character_enemies
              .map((e: unknown) =>
                e && typeof (e as Record<string, unknown>).name === 'string'
                  ? ((e as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 20)
          : [];
        enemies = rawEnemies.length > 0 ? rawEnemies : null;

        // friends
        const rawFriends: string[] = Array.isArray(d.character_friends)
          ? d.character_friends
              .map((f: unknown) =>
                f && typeof (f as Record<string, unknown>).name === 'string'
                  ? ((f as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 20)
          : [];
        friends = rawFriends.length > 0 ? rawFriends : null;

        // movies — "Title (YYYY)" formatted strings
        const rawMovies: string[] = Array.isArray(d.movies)
          ? d.movies
              .map((m: unknown) => {
                if (!m || typeof (m as Record<string, unknown>).name !== 'string') return null;
                const name = (m as Record<string, unknown>).name as string;
                const date = (m as Record<string, unknown>).date;
                const year = typeof date === 'string' ? date.slice(0, 4) : null;
                return year ? `${name} (${year})` : name;
              })
              .filter((s: string | null): s is string => s !== null)
          : [];
        movies = rawMovies.length > 0 ? rawMovies : null;

        // teams — names, capped at 20
        const rawTeams: string[] = Array.isArray(d.teams)
          ? d.teams
              .map((t: unknown) =>
                t && typeof (t as Record<string, unknown>).name === 'string'
                  ? ((t as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 20)
          : [];
        teams = rawTeams.length > 0 ? rawTeams : null;
      }
    }

    // Write to DB — no IS NULL condition so previously-enriched heroes get new columns
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    await supabase
      .from('heroes')
      .update({
        summary,
        powers,
        description,
        origin,
        issue_count: issueCount,
        creators,
        enemies,
        friends,
        movies,
        teams,
        comicvine_enriched_at: new Date().toISOString(),
      })
      .eq('id', heroId);

    return json({ summary, publisher, firstIssueId, powers, description, origin, issueCount, creators, enemies, friends, movies, teams });
  } catch (err) {
    console.error('[get-comicvine-hero]', err);
    return json(NULL_RESPONSE, 500);
  }
});
