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

// Description is returned as raw HTML — clients render it with their own HTML renderer.

const NULL_RESPONSE = {
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { heroId, heroName } = (await req.json()) as { heroId: string; heroName: string };
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

    // First issue — fetch full data so client never needs to call ComicVine directly
    let firstIssueImageUrl: string | null = null;
    let firstIssueData: Record<string, unknown> | null = null;
    if (firstIssueId) {
      const issueParams = new URLSearchParams({
        api_key: COMICVINE_API_KEY,
        format: 'json',
        field_list: 'id,image,name,cover_date,store_date,issue_number,deck,volume,person_credits,first_appearance_characters',
      });
      const issueRes = await fetch(`${COMICVINE_BASE}/issue/4000-${firstIssueId}/?${issueParams}`);
      if (issueRes.ok) {
        const issueJson = await issueRes.json();
        const r = issueJson.results ?? {};
        firstIssueImageUrl = r.image?.medium_url ?? null;

        const personCredits: string[] = Array.isArray(r.person_credits)
          ? r.person_credits
              .map((p: unknown) =>
                p && typeof (p as Record<string, unknown>).name === 'string'
                  ? ((p as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 5)
          : [];
        const debutCharacters: string[] = Array.isArray(r.first_appearance_characters)
          ? r.first_appearance_characters
              .map((c: unknown) =>
                c && typeof (c as Record<string, unknown>).name === 'string'
                  ? ((c as Record<string, unknown>).name as string)
                  : null,
              )
              .filter((n: string | null): n is string => n !== null)
              .slice(0, 8)
          : [];

        firstIssueData = {
          id: firstIssueId,
          imageUrl: firstIssueImageUrl,
          name: r.name ?? null,
          coverDate: r.cover_date ?? null,
          storeDate: r.store_date ?? null,
          issueNumber: r.issue_number != null ? String(r.issue_number) : null,
          deck: r.deck ?? null,
          seriesName: r.volume?.name ?? null,
          personCredits: personCredits.length > 0 ? personCredits : null,
          debutCharacters: debutCharacters.length > 0 ? debutCharacters : null,
        };
      }
    }

    // Detail endpoint — powers + all v2 fields
    let powers: string[] | null = null;
    let description: string | null = null;
    let origin: string | null = null;
    let issueCount: number | null = null;
    let creators: string[] | null = null;
    let enemies: string[] | null = null;
    let friends: string[] | null = null;
    let movies: Array<{ name: string; year: string | null; imageUrl: string | null; url: string | null; rating: string | null; runtime: string | null; deck: string | null; totalRevenue: string | null }> | null = null;
    let movieCount: number | null = null;
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

      const detailRes = await fetch(
        `${COMICVINE_BASE}/character/4005-${result.id}/?${detailParams}`,
      );
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

        // description — raw HTML trimmed
        const rawDesc: string = typeof d.description === 'string' ? d.description.trim() : '';
        description = rawDesc.length > 0 ? rawDesc : null;

        // origin
        origin = typeof d.origin?.name === 'string' ? d.origin.name : null;

        // issue count
        issueCount =
          typeof d.count_of_issue_appearances === 'number' ? d.count_of_issue_appearances : null;

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

        // movies — fetch poster images for first 10, store all as { name, year, imageUrl, url }
        const rawMovieItems: Array<{
          name: string;
          year: string | null;
          apiDetailUrl: string | null;
          url: string | null;
        }> = Array.isArray(d.movies)
          ? d.movies
              .filter((m: unknown) => m && typeof (m as Record<string, unknown>).name === 'string')
              .map((m: unknown) => {
                const mo = m as Record<string, unknown>;
                const name = mo.name as string;
                const date = typeof mo.date === 'string' ? mo.date : null;
                const year = date ? date.slice(0, 4) : null;
                const apiDetailUrl =
                  typeof mo.api_detail_url === 'string' ? mo.api_detail_url : null;
                const url =
                  typeof mo.site_detail_url === 'string' ? mo.site_detail_url : null;
                return { name, year, apiDetailUrl, url };
              })
          : [];

        movieCount = rawMovieItems.length > 0 ? rawMovieItems.length : null;

        const enriched = await Promise.all(
          rawMovieItems.map(async ({ name, year, apiDetailUrl, url }) => {
            if (!apiDetailUrl) return { name, year, imageUrl: null, url, rating: null, runtime: null, deck: null, totalRevenue: null };
            try {
              const params = new URLSearchParams({
                api_key: COMICVINE_API_KEY,
                format: 'json',
                field_list: 'image,rating,runtime,deck,total_revenue',
              });
              const res = await fetch(`${apiDetailUrl}?${params}`);
              if (!res.ok) return { name, year, imageUrl: null, url, rating: null, runtime: null, deck: null, totalRevenue: null };
              const json = await res.json();
              const r = json.results ?? {};
              const imageUrl: string | null = r.image?.medium_url ?? null;
              const rating: string | null = typeof r.rating === 'string' ? r.rating : null;
              const runtime: string | null = r.runtime != null ? String(r.runtime) : null;
              const deck: string | null = typeof r.deck === 'string' && r.deck.trim() ? r.deck.trim() : null;
              const totalRevenue: string | null = r.total_revenue != null ? String(r.total_revenue) : null;
              return { name, year, imageUrl, url, rating, runtime, deck, totalRevenue };
            } catch {
              return { name, year, imageUrl: null, url, rating: null, runtime: null, deck: null, totalRevenue: null };
            }
          }),
        );
        movies = enriched.length > 0 ? enriched : null;

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
        movies: movies as unknown as Record<string, unknown>[],
        movie_count: movieCount,
        teams,
        first_issue_image_url: firstIssueImageUrl,
        first_issue_id: firstIssueId,
        first_issue_data: firstIssueData,
        comicvine_enriched_at: new Date().toISOString(),
        comicvine_id: result.id ? String(result.id) : undefined,
      })
      .eq('id', heroId);

    return json({
      summary,
      publisher,
      firstIssueId,
      firstIssueData,
      powers,
      description,
      origin,
      issueCount,
      creators,
      enemies,
      friends,
      movies,
      movieCount,
      teams,
    });
  } catch (err) {
    console.error('[get-comicvine-hero]', err);
    return json(NULL_RESPONSE, 500);
  }
});
