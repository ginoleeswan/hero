-- Never feature real people (publisher='Non-Fictional' — historical figures,
-- politicians, celebrities) in the auto-generated daily-debate matchup. Assigning
-- a real person an opponent, an alignment, and a "who would win" framing is a
-- publicity/defamation risk. They currently sit at fame <= 13 so the fame >= 60
-- gate already excludes them, but make it explicit so a future fame re-rating or
-- signal change can't leak one in. Everything else is unchanged.
create or replace function public.pick_daily_debate()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.daily_debate (debate_date, hero_a_id, hero_b_id)
  select current_date + 1, least(r.hero_id, r.related_id),
         greatest(r.hero_id, r.related_id)
  from public.hero_relationships r
  join public.heroes a on a.id = r.hero_id
  join public.heroes b on b.id = r.related_id
  where r.kind = 'enemy'
    and a.fame_score >= 60 and b.fame_score >= 60
    and a.publisher is distinct from 'Non-Fictional'
    and b.publisher is distinct from 'Non-Fictional'
    and a.portrait_url is not null and b.portrait_url is not null
    and not exists (
      select 1 from public.daily_debate dd
      where dd.debate_date > current_date - 90
        and dd.hero_a_id = least(r.hero_id, r.related_id)
        and dd.hero_b_id = greatest(r.hero_id, r.related_id))
  order by (a.fame_score + b.fame_score) desc, random()
  limit 1
  on conflict (debate_date) do nothing;
end;
$function$;
