-- Normalized family graph derived from the free-text heroes.relatives string.
-- Populated by the backfill-family edge function; heroes.relatives stays the
-- source of truth. hero_id / related_hero_id are text to match heroes.id.
create type relation_kind as enum (
  'parent','child','sibling','spouse','grandparent','grandchild',
  'aunt_uncle','niece_nephew','cousin','in_law','ancestor','clone','other'
);

create table hero_relatives (
  id              uuid primary key default gen_random_uuid(),
  hero_id         text not null references heroes(id) on delete cascade,
  name            text not null,
  alias           text,
  role            text not null,
  relation        relation_kind not null,
  tier            smallint not null,
  modifiers       text[] not null default '{}',
  status          text,
  related_hero_id text references heroes(id) on delete set null,
  position        int not null default 0,
  created_at      timestamptz not null default now()
);

create index hero_relatives_hero_id_idx on hero_relatives (hero_id);
create index hero_relatives_related_hero_id_idx on hero_relatives (related_hero_id);

alter table hero_relatives enable row level security;
create policy "hero_relatives public read"
  on hero_relatives for select using (true);
