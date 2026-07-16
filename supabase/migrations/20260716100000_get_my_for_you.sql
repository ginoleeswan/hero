-- "Picked For You" — the DISCOVERY personalization row (program #4). Explore's
-- existing personalized rows all resurface what you've already touched (Jump
-- Back In = views, Your Favourites = saves, In Your Universe = trending ∩
-- taste); this one recommends characters you HAVEN'T engaged with yet:
--
--   graph : allies/enemies of your most recent favourites (hero_relationships,
--           rank-indexed + fame-gated), weighted by inverse rank — "people who
--           love Batman get Nightwing/Bane before deep cuts".
--   taste : recognizable (fame >= 40) heroes from your top franchises and
--           publishers, weighted by your engagement (favourite=3, view=1 — the
--           same 3:1 blend get_my_taste_profile uses).
--
-- Everything you've favourited OR viewed is excluded, a portrait is required
-- (this row sells discovery visually), and the caller identity comes from
-- auth.uid() — SECURITY DEFINER so the per-user RLS tables join to the RLS-free
-- catalog without the planner trap. Logged out ⇒ empty set.
create or replace function public.get_my_for_you(p_limit integer default 20)
returns table (id text, name text, image_url text, portrait_url text)
language sql
stable
security definer
set search_path = public
as $function$
  with engaged as (
    select hero_id, 3 as w from user_favourites where user_id = auth.uid()
    union all
    select hero_id, 1 as w from user_view_history where user_id = auth.uid()
  ),
  top_favs as (
    select hero_id from user_favourites
    where user_id = auth.uid()
    order by created_at desc
    limit 8
  ),
  graph as (
    select r.related_id as hero_id, sum(3.0 / (r.rank + 2)) as score
    from hero_relationships r
    join top_favs f on f.hero_id = r.hero_id
    where r.kind in ('ally', 'enemy') and r.rank <= 12
    group by r.related_id
  ),
  aff as (
    select h.publisher, h.franchise, sum(e.w)::numeric as w
    from engaged e
    join heroes h on h.id = e.hero_id
    where h.publisher is not null or h.franchise is not null
    group by h.publisher, h.franchise
  ),
  taste as (
    select h.id as hero_id, max(a.w) * 0.15 as score
    from aff a
    join heroes h
      on (a.franchise is not null and h.franchise = a.franchise)
      or (a.publisher is not null and h.publisher = a.publisher)
    where h.fame_score >= 40
    group by h.id
  ),
  cand as (
    select u.hero_id, sum(u.score) as score
    from (select * from graph union all select * from taste) u
    group by u.hero_id
  )
  select h.id, h.name, h.image_url, h.portrait_url
  from cand c
  join heroes h on h.id = c.hero_id
  where not exists (select 1 from engaged e where e.hero_id = c.hero_id)
    and h.portrait_url is not null
    and coalesce(h.fame_score, 0) >= 20
  order by c.score desc, h.fame_score desc nulls last
  limit greatest(least(p_limit, 40), 1);
$function$;

do $$
begin
  revoke all on function public.get_my_for_you(integer) from public, anon;
  grant execute on function public.get_my_for_you(integer) to authenticated, service_role;
end $$;
