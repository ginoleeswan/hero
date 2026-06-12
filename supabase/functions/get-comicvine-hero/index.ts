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

// Pull a capped, name list out of a ComicVine relation array.
const nameList = (arr: unknown, cap: number): string[] =>
  Array.isArray(arr)
    ? arr
        .map((e) =>
          e && typeof (e as Record<string, unknown>).name === 'string'
            ? ((e as Record<string, unknown>).name as string)
            : null,
        )
        .filter((n): n is string => n !== null)
        .slice(0, cap)
    : [];

const cvParams = (extra: Record<string, string>) =>
  new URLSearchParams({ api_key: COMICVINE_API_KEY, format: 'json', ...extra });

// Whether a non-OK ComicVine HTTP status is transient (retry later) vs terminal.
// 420 is ComicVine's own "rate limit exceeded"; 429/5xx are transient too.
const isTransient = (status: number): boolean =>
  status === 420 || status === 429 || status >= 500;

// One character call carries both the lightweight fields (deck/publisher/first
// issue) and the heavy detail fields — so resolving by comicvine_id needs a
// single request, not the old list + detail pair.
const CHAR_FIELDS = [
  'id',
  'deck',
  'publisher',
  'first_appeared_in_issue',
  'powers',
  'origin',
  'character_enemies',
  'character_friends',
  'creators',
  'count_of_issue_appearances',
  'movies',
  'description',
  'teams',
].join(',');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { heroId, heroName } = (await req.json()) as { heroId: string; heroName: string };
    if (!heroId || !heroName) return json({ error: 'heroId and heroName required' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const markFailed = () =>
      supabase.from('heroes').update({ comicvine_status: 'failed' }).eq('id', heroId);

    // ── Resolve the ComicVine character ─────────────────────────────────────────
    // Prefer the stored comicvine_id: one direct call, no name ambiguity. Fall back
    // to a name search only when there's no id on file (or the stored id is stale).
    const { data: row } = await supabase
      .from('heroes')
      .select('comicvine_id')
      .eq('id', heroId)
      .maybeSingle();

    let cvId: string | null = row?.comicvine_id ? String(row.comicvine_id) : null;
    let d: Record<string, unknown> | null = null;

    // Fetch a character by ComicVine id → 'ok' | 'transient' | 'empty'.
    const fetchChar = async (id: string): Promise<'ok' | 'transient' | 'empty'> => {
      const res = await fetch(
        `${COMICVINE_BASE}/character/4005-${id}/?${cvParams({ field_list: CHAR_FIELDS })}`,
      );
      if (!res.ok) return isTransient(res.status) ? 'transient' : 'empty';
      const body = await res.json();
      // ComicVine signals rate limiting with HTTP 200 + status_code 107 ("Rate
      // limit exceeded"). Treat it as transient — never as an empty/terminal miss,
      // which would wrongly mark a real hero `failed`.
      if (body?.status_code === 107) return 'transient';
      const results = body.results as Record<string, unknown> | undefined;
      if (!results || !results.id) return 'empty';
      d = results;
      return 'ok';
    };

    if (cvId) {
      const r = await fetchChar(cvId);
      // Transient failure: don't touch comicvine_status — the row stays whatever it
      // was (pending heroes get retried by the cron / next view), and we just serve
      // an empty payload this time rather than corrupting state.
      if (r === 'transient') return json(NULL_RESPONSE);
      // Stored id didn't resolve (stale/wrong) — fall through to a name search.
      if (r === 'empty') cvId = null;
    }

    if (!d) {
      const listRes = await fetch(
        `${COMICVINE_BASE}/characters/?${cvParams({
          filter: `name:${heroName}`,
          field_list: 'id',
          limit: '1',
        })}`,
      );
      if (!listRes.ok) {
        // Transient → leave status alone; terminal → park as failed.
        if (!isTransient(listRes.status)) await markFailed();
        return json(NULL_RESPONSE);
      }
      const listBody = await listRes.json();
      // Rate limited (HTTP 200 + status_code 107) — transient, don't mark failed.
      if (listBody?.status_code === 107) return json(NULL_RESPONSE);
      const match = listBody.results?.[0];
      if (!match?.id) {
        // No ComicVine character matches this name — terminal.
        await markFailed();
        return json(NULL_RESPONSE);
      }
      cvId = String(match.id);
      const r = await fetchChar(cvId);
      if (r === 'transient') return json(NULL_RESPONSE);
      if (r === 'empty') {
        await markFailed();
        return json(NULL_RESPONSE);
      }
    }

    // d is populated, cvId is set.
    const detail = d as Record<string, unknown>;
    const summary: string | null = (detail.deck as string | null) ?? null;
    const publisher: string | null =
      (detail.publisher as { name?: string } | null)?.name ?? null;
    const fai = detail.first_appeared_in_issue as { id?: number | string } | null;
    const firstIssueId: string | null = fai?.id != null ? String(fai.id) : null;

    // ── First issue (cover + credits) so the client never calls ComicVine itself ──
    let firstIssueImageUrl: string | null = null;
    let firstIssueData: Record<string, unknown> | null = null;
    if (firstIssueId) {
      const issueRes = await fetch(
        `${COMICVINE_BASE}/issue/4000-${firstIssueId}/?${cvParams({
          field_list:
            'id,image,name,cover_date,store_date,issue_number,deck,volume,person_credits,first_appearance_characters',
        })}`,
      );
      if (issueRes.ok) {
        const r = (await issueRes.json()).results ?? {};
        firstIssueImageUrl = r.image?.medium_url ?? null;
        const personCredits = nameList(r.person_credits, 5);
        const debutCharacters = nameList(r.first_appearance_characters, 8);
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

    // ── Detail fields (already in `detail`) ─────────────────────────────────────
    const rawPowers = nameList(detail.powers, 100);
    const powers = rawPowers.length > 0 ? rawPowers : null;

    const rawDesc = typeof detail.description === 'string' ? detail.description.trim() : '';
    const description = rawDesc.length > 0 ? rawDesc : null;

    const origin =
      typeof (detail.origin as { name?: string } | null)?.name === 'string'
        ? (detail.origin as { name: string }).name
        : null;

    const issueCount =
      typeof detail.count_of_issue_appearances === 'number'
        ? detail.count_of_issue_appearances
        : null;

    const rawCreators = nameList(detail.creators, 5);
    const creators = rawCreators.length > 0 ? rawCreators : null;

    // Enemies/friends arrive alphabetically — store a wide slice; the UI resolves
    // them to heroes and re-orders by popularity, so famous late-alphabet foes
    // (e.g. Sabretooth) aren't lost to a low cap.
    const rawEnemies = nameList(detail.character_enemies, 120);
    const enemies = rawEnemies.length > 0 ? rawEnemies : null;
    const rawFriends = nameList(detail.character_friends, 120);
    const friends = rawFriends.length > 0 ? rawFriends : null;

    const rawTeams = nameList(detail.teams, 20);
    const teams = rawTeams.length > 0 ? rawTeams : null;

    // ── Movies (+ poster/meta for the first 10) ─────────────────────────────────
    const rawMovieItems: Array<{
      name: string;
      year: string | null;
      apiDetailUrl: string | null;
      url: string | null;
    }> = Array.isArray(detail.movies)
      ? detail.movies
          .filter((m: unknown) => m && typeof (m as Record<string, unknown>).name === 'string')
          .map((m: unknown) => {
            const mo = m as Record<string, unknown>;
            const date = typeof mo.date === 'string' ? mo.date : null;
            return {
              name: mo.name as string,
              year: date ? date.slice(0, 4) : null,
              apiDetailUrl: typeof mo.api_detail_url === 'string' ? mo.api_detail_url : null,
              url: typeof mo.site_detail_url === 'string' ? mo.site_detail_url : null,
            };
          })
      : [];

    const movieCount = rawMovieItems.length > 0 ? rawMovieItems.length : null;

    const enrichedMovies = await Promise.all(
      rawMovieItems.slice(0, 10).map(async ({ name, year, apiDetailUrl, url }) => {
        const blank = {
          name,
          year,
          imageUrl: null,
          url,
          rating: null,
          runtime: null,
          deck: null,
          totalRevenue: null,
        };
        if (!apiDetailUrl) return blank;
        try {
          const res = await fetch(
            `${apiDetailUrl}?${cvParams({ field_list: 'image,rating,runtime,deck,total_revenue' })}`,
          );
          if (!res.ok) return blank;
          const r = (await res.json()).results ?? {};
          return {
            name,
            year,
            imageUrl: r.image?.medium_url ?? null,
            url,
            rating: typeof r.rating === 'string' ? r.rating : null,
            runtime: r.runtime != null ? String(r.runtime) : null,
            deck: typeof r.deck === 'string' && r.deck.trim() ? r.deck.trim() : null,
            totalRevenue: r.total_revenue != null ? String(r.total_revenue) : null,
          };
        } catch {
          return blank;
        }
      }),
    );
    const restMovies = rawMovieItems.slice(10).map(({ name, year, url }) => ({
      name,
      year,
      imageUrl: null,
      url,
      rating: null,
      runtime: null,
      deck: null,
      totalRevenue: null,
    }));
    const movies = [...enrichedMovies, ...restMovies];

    // ── Persist (terminal success) ──────────────────────────────────────────────
    await supabase
      .from('heroes')
      .update({
        summary,
        publisher,
        comicvine_status: 'done',
        powers,
        description,
        origin,
        issue_count: issueCount,
        creators,
        enemies,
        friends,
        movies: movies.length > 0 ? (movies as unknown as Record<string, unknown>[]) : null,
        movie_count: movieCount,
        teams,
        first_issue_image_url: firstIssueImageUrl,
        first_issue_id: firstIssueId,
        first_issue_data: firstIssueData,
        comicvine_enriched_at: new Date().toISOString(),
        comicvine_id: cvId ?? undefined,
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
      movies: movies.length > 0 ? movies : null,
      movieCount,
      teams,
    });
  } catch (err) {
    console.error('[get-comicvine-hero]', err);
    return json(NULL_RESPONSE, 500);
  }
});
