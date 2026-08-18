-- category_facet_counts is a plain (invoker-rights) function, so its caller
-- needs execute on the helper too. Same exposure as the wrapper: read-only
-- counts over publicly readable hero columns.
grant execute on function public.category_base_rows(text, text) to anon, authenticated;;
