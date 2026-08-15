// src/lib/db/heroes/columns.ts — which columns a hero row fetch actually asks for.
//
// `select('*')` used to be the default everywhere, and it meant every character
// page downloaded the whole `description`: 417 KB on Spider-Man, 398 KB on
// Batman, 45 MB across the catalogue. The character page never renders a
// character of it — it only checks whether one exists, to decide if it should
// offer "read the full biography". Hundreds of kilobytes over cellular, on the
// most-visited pages, to compute a boolean.
//
// So the biography HTML is fetched only by the screen that shows it
// (`getHeroBiography`), and everything else takes this list plus the
// `has_description` computed field.
//
// PostgREST has no "all columns except" syntax, so this is spelled out. That
// would normally rot — a column added by a later migration would silently stop
// reaching the app — so `__tests__/lib/heroColumns.test.ts` reads
// `src/types/database.generated.ts` and fails if the two ever disagree.

/** Every column of `heroes` except `description`, plus the computed flag. */
export const HERO_ROW_COLUMNS = [
  'id',
  'name',
  'publisher',
  'image_url',
  'category',
  'image_md_url',
  'intelligence',
  'strength',
  'speed',
  'durability',
  'power',
  'combat',
  'full_name',
  'alter_egos',
  'aliases',
  'place_of_birth',
  'first_appearance',
  'alignment',
  'gender',
  'race',
  'height_imperial',
  'height_metric',
  'weight_imperial',
  'weight_metric',
  'eye_color',
  'hair_color',
  'occupation',
  'base',
  'group_affiliation',
  'relatives',
  'summary',
  'first_issue_image_url',
  'comicvine_enriched_at',
  'enriched_at',
  'portrait_url',
  'powers',
  'origin',
  'issue_count',
  'creators',
  'enemies',
  'friends',
  'movies',
  'teams',
  'movie_count',
  // Set by apply_backfilled_movers so a re-run can tell "already grown" from
  // "never attempted" — see 20260815161014_backfilled_movers_can_grow.sql.
  'movers_backfilled_at',
  'comicvine_id',
  'stats_source',
  'ai_stats_status',
  'first_issue_id',
  'first_issue_data',
  'powerstats_total',
  'issue_covers',
  'gallery_enriched_at',
  'comicvine_status',
  'wikidata_qid',
  'wikidata_status',
  'wikidata_candidates',
  'wikidata_enriched_at',
  'narrative_status',
  'franchise',
  'added_at',
  'superhero_api_id',
  'fame_tier',
  'fame_rated_at',
  'fame_rated_by',
  'wikidata_sitelinks',
  'fame_score',
  'fame_score_version',
  'search_text',
  'enwiki_title',
  'pageviews_week',
  'pageviews_prev',
  'pageviews_spike',
  'pageviews_at',
  'portrait_blurhash',
  'igdb_id',
  'igdb_status',
  'power_rating',
  'avatar_url',
  'born',
  'died',
  'reign_start',
  'reign_end',
  'views_daily',
] as const;

/**
 * The column the list deliberately leaves out. Kept as a named constant so the
 * drift test can state the exception rather than hard-code it twice.
 */
export const HERO_COLUMN_OMITTED = 'description' as const;

/**
 * Ready for `.select()`. `has_description` is a PostgREST computed field backed
 * by a SQL function (migration `heroes_has_description_computed_field`), not a
 * stored column — so it costs nothing and never appears in the generated types.
 */
export const HERO_ROW_SELECT = `${HERO_ROW_COLUMNS.join(',')},has_description`;
