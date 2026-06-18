-- 'unmatched' (no ComicVine character by this exact name) is a terminal status
-- distinct from 'failed'. The CHECK constraint didn't allow it, so every write of
-- it was silently rejected — the whole 'unmatched' classification was a no-op at
-- the data layer. Add it to the allowed set.
ALTER TABLE public.heroes DROP CONSTRAINT IF EXISTS heroes_comicvine_status_check;
ALTER TABLE public.heroes ADD CONSTRAINT heroes_comicvine_status_check
  CHECK (comicvine_status = ANY (ARRAY['pending'::text, 'done'::text, 'empty'::text, 'failed'::text, 'unmatched'::text]));
