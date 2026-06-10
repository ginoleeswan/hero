-- Hero association graph — the sibling of hero_relatives (family).
--
-- The same mature pattern: the raw columns (heroes.enemies / friends / teams)
-- stay the source of truth; hero_relationships is a NORMALISED, DERIVED table,
-- fully rebuildable by rebuild_hero_relationships(). Resolving name → hero and
-- ranking by popularity happens ONCE here (set-based in Postgres), not on every
-- render across two platforms. One table + one `kind` column generalises to any
-- grouping (enemy / ally / teammate today; extend by adding a kind), and the
-- reverse index enables "who counts X as an enemy / teammate" lookups.

create table if not exists public.hero_relationships (
  hero_id        text not null references public.heroes(id) on delete cascade,
  related_id     text not null references public.heroes(id) on delete cascade,
  kind           text not null,                      -- 'enemy' | 'ally' | 'teammate'
  source         text not null default 'comicvine',  -- provenance
  rank           integer,                            -- 1 = top by related-hero popularity, within (hero_id, kind)
  cross_universe boolean not null default false,     -- related hero is a different publisher
  primary key (hero_id, kind, related_id)
);

create index if not exists hero_relationships_lookup on public.hero_relationships (hero_id, kind, rank);
create index if not exists hero_relationships_reverse on public.hero_relationships (related_id, kind);
-- GIN on teams powers the teammate (array-overlap) rebuild.
create index if not exists heroes_teams_gin on public.heroes using gin (teams);
create index if not exists heroes_name_idx on public.heroes (name);

-- Rebuild the whole graph from the raw columns. Idempotent; safe to re-run after
-- any enrichment (e.g. the backfill-enemies job) refreshes the source arrays.
create or replace function public.rebuild_hero_relationships()
returns void
language plpgsql
as $$
begin
  truncate public.hero_relationships;

  -- enemies + allies — resolve each name to the most-popular matching hero, dedupe,
  -- then rank by that hero's popularity within (subject, kind). Cap so mega-lists
  -- stay bounded.
  insert into public.hero_relationships (hero_id, related_id, kind, source, rank, cross_universe)
  select hero_id, related_id, kind, 'comicvine', rank, cross_universe
  from (
    select hero_id, related_id, kind, cross_universe,
           row_number() over (partition by hero_id, kind order by issue_count desc nulls last) as rank
    from (
      select distinct on (h.id, k.kind, nm.nm_name)
        h.id as hero_id,
        m.id as related_id,
        k.kind,
        m.issue_count,
        (m.publisher is distinct from h.publisher) as cross_universe
      from public.heroes h
      cross join (values ('enemy'), ('ally')) as k(kind)
      cross join lateral unnest(
        case when k.kind = 'ally' then h.friends else h.enemies end
      ) as nm(nm_name)
      join public.heroes m on m.name = nm.nm_name and m.id <> h.id
      order by h.id, k.kind, nm.nm_name, m.issue_count desc nulls last
    ) resolved
  ) ranked
  where rank <= 60;

  -- teammates — heroes that share a team. Bounded to the top 40 by popularity.
  insert into public.hero_relationships (hero_id, related_id, kind, source, rank, cross_universe)
  select hero_id, related_id, 'teammate', 'comicvine', rank, cross_universe
  from (
    select hero_id, related_id, cross_universe,
           row_number() over (partition by hero_id order by issue_count desc nulls last) as rank
    from (
      select distinct on (h.id, m.id)
        h.id as hero_id,
        m.id as related_id,
        m.issue_count,
        (m.publisher is distinct from h.publisher) as cross_universe
      from public.heroes h
      join public.heroes m on m.id <> h.id and m.teams && h.teams
      where h.teams is not null and array_length(h.teams, 1) > 0
    ) resolved
  ) ranked
  where rank <= 40;
end;
$$;

-- Read API — joined, ranked, optionally limited to the subject's own universe.
create or replace function public.get_related_heroes(
  p_hero_id text,
  p_kind text default 'enemy',
  p_limit integer default 60,
  p_same_universe boolean default false
)
returns table (
  id text,
  name text,
  image_url text,
  image_md_url text,
  portrait_url text,
  publisher text,
  alignment text,
  rank integer,
  source text
)
language sql
stable
as $$
  select m.id, m.name, m.image_url, m.image_md_url, m.portrait_url,
         m.publisher, m.alignment, r.rank, r.source
  from public.hero_relationships r
  join public.heroes m on m.id = r.related_id
  where r.hero_id = p_hero_id
    and r.kind = p_kind
    and (not p_same_universe or not r.cross_universe or r.source = 'curated')
  order by r.rank asc nulls last
  limit p_limit;
$$;

grant execute on function public.rebuild_hero_relationships() to service_role;
grant execute on function public.get_related_heroes(text, text, integer, boolean) to anon, authenticated, service_role;
