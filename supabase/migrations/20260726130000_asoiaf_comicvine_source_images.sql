-- Source art for two of the art-less Game of Thrones characters.
--
-- Fetched by comicvine_id, never by name search. Name search is actively
-- dangerous in this universe: querying ComicVine for "Aemond Targaryen" returns
-- Rhaegar, Valarr and Daenerys, because it fuzzy-matches on "Targaryen". Every
-- apparent hit for the 26 newly-added characters was a false positive of that
-- kind, and the one exact name match — "Rhaenys Targaryen", cv-147646 — is the
-- infant daughter of Rhaegar, not the Queen Who Never Was of the Dance.
--
-- Wikidata was checked as a second source and has no free image for any of
-- them; its single P18 hit is a convention photograph of an actor, i.e. a real
-- person, which is not something to feed a portrait model.
--
-- Mace Tyrell is deliberately excluded. His ComicVine record exists but its
-- image is the site's grey "Blank!" placeholder — see the BLANK_SOURCE_RE guard
-- in scripts/generate-portraits.ts for why that is worse than no source at all.
update public.heroes
set image_url = v.image_url
from (values
  ('h_3227eafa-1dc6-4f14-bf2e-8f26a5f6e87b','154252','https://comicvine.gamespot.com/a/uploads/scale_large/11134/111343560/6776720-lynesse.png'),
  ('h_5e7d24dd-a54a-4fc3-b610-f6f7e5215b76','147665','https://comicvine.gamespot.com/a/uploads/scale_large/1/15776/10131331-janos_slynt.jpg')
) as v(id, comicvine_id, image_url)
where public.heroes.id = v.id
  and public.heroes.comicvine_id = v.comicvine_id
  and public.heroes.image_url is null;
