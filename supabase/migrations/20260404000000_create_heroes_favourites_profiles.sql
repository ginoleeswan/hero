-- Heroes table (curated lists, populated from seed)
create table if not exists heroes (
  id          text primary key,
  name        text not null,
  publisher   text,
  image_url   text,
  category    text check (category in ('popular', 'villain', 'xmen'))
);

-- User favourites
create table if not exists user_favourites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade,
  hero_id     text references heroes(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_id, hero_id)
);

-- User profiles (shell — not built out yet)
create table if not exists user_profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at   timestamptz default now()
);

-- Row Level Security
alter table heroes enable row level security;
alter table user_favourites enable row level security;
alter table user_profiles enable row level security;

-- Heroes: any authenticated user can read
create policy "heroes_select" on heroes
  for select to authenticated using (true);

-- Favourites: users manage their own rows only
create policy "favourites_select" on user_favourites
  for select to authenticated using (auth.uid() = user_id);
create policy "favourites_insert" on user_favourites
  for insert to authenticated with check (auth.uid() = user_id);
create policy "favourites_delete" on user_favourites
  for delete to authenticated using (auth.uid() = user_id);

-- Profiles: users manage their own row only
create policy "profiles_select" on user_profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_insert" on user_profiles
  for insert to authenticated with check (auth.uid() = id);
