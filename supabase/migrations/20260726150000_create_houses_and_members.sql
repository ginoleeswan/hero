-- Houses of Westeros: a destination for the family tree.
--
-- `houses` is curated by hand. These pages are meant to read as authored rather
-- than generated, and house words, a seat and a sigil colour are what make the
-- difference. Eight rows is an afternoon; the alternative was pages that read
-- like query results.
create table if not exists public.houses (
  slug        text primary key,
  name        text not null,
  universe    text not null,
  words       text,
  seat        text,
  sigil_tint  text,
  blurb       text,
  position    int  not null default 0,
  created_at  timestamptz not null default now()
);

-- Membership is derived once and then correctable by hand. Storing it rather
-- than computing it means a wrong member is fixed by editing a row instead of
-- tuning a heuristic.
--
-- `via` records how someone was picked up — 'surname' for the seed, 'kin' for
-- the one-hop closure — so a bad closure can be found and removed without
-- disturbing the seed.
create table if not exists public.house_members (
  house_slug text not null references public.houses(slug) on delete cascade,
  hero_id    text not null references public.heroes(id)   on delete cascade,
  via        text not null check (via in ('surname', 'kin')),
  primary key (house_slug, hero_id)
);

create index if not exists house_members_hero_idx on public.house_members(hero_id);

alter table public.houses enable row level security;
alter table public.house_members enable row level security;

-- RLS is on by default, and without a public read policy anon reads zero rows
-- and the RPC returns empty silently rather than erroring.
create policy houses_public_read on public.houses for select using (true);
create policy house_members_public_read on public.house_members for select using (true);
