-- Two CCXP windows are not CCXP.
--
-- CCXP is São Paulo in early December — 2019, 2022, 2023 and 2024 all sit in the
-- last week of November or the first of December. Two rows do not: a window in
-- July 2025 and one in April 2026. Something moved the CCXP article on those
-- dates, and the detector did its job in noticing; what it cannot do is know
-- that the thing it noticed was not the convention.
--
-- Left as suppressed rows rather than deleted, which is what suppression is for
-- here (see eccc/2019-10, "No Emerald City Comic Con has been held in October",
-- and eccc/2020, the show called off days before it opened). The detection
-- happened and the evidence is worth keeping; it just must not be presented to a
-- reader as an edition of a convention that did not take place.
--
-- The reason deliberately does not guess what the spike WAS. CCXP runs satellite
-- shows in Mexico and Colombia and announces its São Paulo line-up months ahead,
-- so there are several honest candidates and no way to choose between them from
-- readership — the same limit that made every event surface state a
-- correlational claim rather than a causal one.
--
-- Note the shape of the correction: suppressing the July row leaves 2025 with no
-- CCXP at all, and that is the accurate outcome. A gap says "we did not catch
-- it". The row said "we caught it, here it is", which was worse.
--
-- Found by comparing every edition's month against its own event's modal month,
-- after excluding the events whose variation is real: comiket runs twice a year,
-- pax and mcm-london are several shows under one name, nintendo-direct and
-- dc-fandome have no season, swce moves country to country by design, d23 has
-- had a February Tokyo edition, and 2020-2022 is the pandemic. These two were
-- the only rows left in the whole catalogue.

update public.event_editions
set suppressed_reason =
  'CCXP is held in São Paulo in early December. This window is months away from the convention, so whatever moved the article here, it was not the show.'
where slug = 'ccxp' and edition_slug in ('2025', '2026');
