-- hero_images: one row per character image, multi-source (ComicVine now;
-- AI/curated later). Replaces heroes.issue_covers in the read path.
create table public.hero_images (
  id          uuid primary key default gen_random_uuid(),
  hero_id     text not null references public.heroes(id) on delete cascade,
  url         text not null,
  source      text not null,            -- 'comicvine_primary' | 'comicvine_cover' | 'ai' | 'curated'
  caption     text,
  issue_id    text,                     -- set for covers → /issue/cvi:<id> read-through
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (hero_id, url)
);

create index hero_images_hero_id_idx on public.hero_images (hero_id, sort_order);

alter table public.hero_images enable row level security;

create policy "hero_images public read"
  on public.hero_images for select
  to anon, authenticated
  using (true);

-- One-time backfill of existing covers. sort_order = index + 1 leaves 0 for the
-- ComicVine primary image the edge fn will add later. Idempotent via the unique
-- constraint.
insert into public.hero_images (hero_id, url, source, caption, issue_id, sort_order)
select
  h.id,
  cover->>'url',
  'comicvine_cover',
  cover->>'name',
  cover->>'id',
  (ord::int) + 1
from public.heroes h
cross join lateral jsonb_array_elements(h.issue_covers) with ordinality as t(cover, ord)
where h.issue_covers is not null
  and jsonb_typeof(h.issue_covers) = 'array'
  and cover->>'url' is not null
on conflict (hero_id, url) do nothing;
