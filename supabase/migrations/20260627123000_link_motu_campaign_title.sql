-- Link the seeded "Masters of the Universe" campaign to its TMDB title so the
-- "Right Now" hero leads with the film's cinematic backdrop instead of cropping
-- He-Man's character art. The campaign stays franchise-based for its character
-- roster; title_id only feeds the backdrop (see get_active_campaigns left join).
update public.featured_campaigns
set title_id = 'tmdb:454639'
where headline = 'Masters of the Universe'
  and franchise = 'Masters of the Universe'
  and title_id is null;
