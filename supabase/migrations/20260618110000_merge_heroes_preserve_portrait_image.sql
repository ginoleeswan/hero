-- When merging, the surviving hero must keep a proper portrait/image: previously
-- the winner's row was kept wholesale, so a portrait-less winner + a portrait-
-- bearing loser silently lost the portrait. Coalesce portrait_url and image_url
-- from the loser onto the winner (winner wins when it has one; otherwise inherit
-- the loser's) so a merge never strips a character's art.
CREATE OR REPLACE FUNCTION public.admin_merge_heroes(p_loser text, p_winner text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l_cv text; l_sa text; l_qid text; l_portrait text; l_image text;
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_loser = p_winner then raise exception 'loser and winner must differ'; end if;
  if not exists (select 1 from public.heroes where id = p_winner) then
    raise exception 'winner % not found', p_winner;
  end if;
  if not exists (select 1 from public.heroes where id = p_loser) then
    raise exception 'loser % not found', p_loser;
  end if;

  select comicvine_id, superhero_api_id, wikidata_qid, portrait_url, image_url
    into l_cv, l_sa, l_qid, l_portrait, l_image
  from public.heroes where id = p_loser;

  update hero_narrative_facts set hero_id = p_winner where hero_id = p_loser;
  update hero_relatives set hero_id = p_winner where hero_id = p_loser;
  update hero_relatives set related_hero_id = p_winner where related_hero_id = p_loser;
  insert into hero_tags (hero_id, tag)
    select p_winner, tag from hero_tags t where t.hero_id = p_loser
    and not exists (select 1 from hero_tags t2 where t2.hero_id = p_winner and t2.tag = t.tag);
  insert into hero_facts (hero_id, key, value, source)
    select p_winner, key, value, source from hero_facts f where f.hero_id = p_loser
    and not exists (select 1 from hero_facts f2 where f2.hero_id = p_winner and f2.key = f.key);

  update user_favourites uf set hero_id = p_winner where uf.hero_id = p_loser
    and not exists (select 1 from user_favourites u2 where u2.user_id = uf.user_id and u2.hero_id = p_winner);
  delete from user_favourites where hero_id = p_loser;
  update user_view_history v set hero_id = p_winner where v.hero_id = p_loser
    and not exists (select 1 from user_view_history v2 where v2.user_id = v.user_id and v2.hero_id = p_winner);
  delete from user_view_history where hero_id = p_loser;
  delete from verdicts where hero_a_id = p_loser or hero_b_id = p_loser;

  delete from public.heroes where id = p_loser;

  update public.heroes w set
    comicvine_id     = coalesce(w.comicvine_id, l_cv),
    superhero_api_id = coalesce(w.superhero_api_id, l_sa),
    wikidata_qid     = coalesce(w.wikidata_qid, l_qid),
    portrait_url     = coalesce(w.portrait_url, l_portrait),
    image_url        = coalesce(w.image_url, l_image),
    wikidata_status  = case when w.wikidata_qid is null and l_qid is not null
                            then 'resolved' else w.wikidata_status end
  where w.id = p_winner;

  perform public.rebuild_hero_relationships();
end $function$;
