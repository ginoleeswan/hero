create table user_view_history (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  hero_id    text        not null,
  viewed_at  timestamptz not null default now(),
  unique(user_id, hero_id)
);

create index user_view_history_user_recent
  on user_view_history(user_id, viewed_at desc);

alter table user_view_history enable row level security;

create policy "Users can manage their own view history"
  on user_view_history
  for all
  using (auth.uid() = user_id);
