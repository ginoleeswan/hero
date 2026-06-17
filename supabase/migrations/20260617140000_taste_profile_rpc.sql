-- "Your Universe" taste profile for the signed-in user. Aggregates the heroes
-- they've engaged with (favourites weighted 3x, viewed 1x) into top publishers,
-- franchises, tags, and an alignment lean. Read-only, SECURITY DEFINER (joins
-- heroes/hero_tags past the per-user RLS on the engagement tables).
create or replace function public.get_my_taste_profile()
returns json
language sql
security definer
set search_path = public
stable
as $$
  with engaged as (
    select hero_id, max(w) as weight
    from (
      select hero_id, 3 as w from public.user_favourites
        where user_id = auth.uid() and hero_id is not null
      union all
      select hero_id, 1 as w from public.user_view_history
        where user_id = auth.uid()
    ) u
    group by hero_id
  ),
  h as (
    select e.weight, x.publisher, x.franchise, x.alignment
    from engaged e
    join public.heroes x on x.id = e.hero_id
  )
  select json_build_object(
    'based_on', (select count(*) from engaged),
    'publishers', coalesce((
      select json_agg(p) from (
        select publisher as name, sum(weight)::int as weight
        from h where publisher is not null and publisher <> ''
        group by publisher order by weight desc, name limit 5
      ) p
    ), '[]'::json),
    'franchises', coalesce((
      select json_agg(f) from (
        select franchise as name, sum(weight)::int as weight
        from h where franchise is not null and franchise <> ''
        group by franchise order by weight desc, name limit 6
      ) f
    ), '[]'::json),
    'tags', coalesce((
      select json_agg(t) from (
        select tg.tag as slug, coalesce(v.label, tg.tag) as label, sum(e.weight)::int as weight
        from engaged e
        join public.hero_tags tg on tg.hero_id = e.hero_id
        left join public.hero_tag_vocab v on v.slug = tg.tag
        group by tg.tag, v.label
        order by weight desc, label limit 6
      ) t
    ), '[]'::json),
    'alignment', json_build_object(
      'good',    coalesce((select sum(weight) from h where lower(alignment) = 'good'), 0)::int,
      'bad',     coalesce((select sum(weight) from h where lower(alignment) = 'bad'), 0)::int,
      'neutral', coalesce((select sum(weight) from h where lower(alignment) like '%neutral%'), 0)::int
    )
  );
$$;

revoke all on function public.get_my_taste_profile() from public, anon;
grant execute on function public.get_my_taste_profile() to authenticated, service_role;
