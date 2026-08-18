-- pin search_path on the new SQL functions
alter function public.get_pending_build_ids(integer) set search_path = public;
alter function public.find_duplicate_heroes(integer) set search_path = public;

-- lock the admin/definer + dedup functions to signed-in users (anon revoked);
-- the internal is_admin gate still restricts them to admins.
revoke execute on function public.admin_add_comicvine_heroes(jsonb) from public;
grant execute on function public.admin_add_comicvine_heroes(jsonb) to authenticated;
revoke execute on function public.admin_merge_heroes(text, text) from public;
grant execute on function public.admin_merge_heroes(text, text) to authenticated;
revoke execute on function public.find_duplicate_heroes(integer) from public;
grant execute on function public.find_duplicate_heroes(integer) to authenticated;;
