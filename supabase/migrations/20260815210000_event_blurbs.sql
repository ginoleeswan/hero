-- Blurbs for the events that have a page, now that something renders them.
--
-- `watched_events.blurb` has existed since the table was created and rendered
-- nowhere: it was returned by get_live_events, carried through the LiveEvent
-- interface, and displayed by nothing. get_event_hub now surfaces it as the
-- hub's standing description, which is the one place on an event's pages where a
-- sentence about what the event IS belongs — every other line on those pages is
-- derived from measurement.
--
-- Written for a reader who has never heard of Mythique and arrived from a
-- search, because that is who a hub page is for. Deliberately evergreen: no
-- dates, no "this year", nothing that becomes false in August. The hub outlives
-- every edition beneath it.
--
-- Only the two events with archived editions get one. The other eighteen have no
-- page worth describing yet, and inventing copy for a page nobody can reach is
-- how you end up with eighteen more strings to maintain.

update public.watched_events
set blurb = 'Disney''s own fan convention, where Marvel, Star Wars, Pixar and '
         || 'Disney+ show what is coming next. Mythique watches it the way an '
         || 'audience does — by what people went and read about while it ran.'
where slug = 'd23';

update public.watched_events
set blurb = 'The largest comic convention in the world, and the week the film, '
         || 'television and comics industries do their announcing. Mythique '
         || 'records what was revealed and which characters the audience moved to.'
where slug = 'sdcc';
