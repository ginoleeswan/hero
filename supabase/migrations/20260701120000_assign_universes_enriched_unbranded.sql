-- Assign a universe (publisher) to ComicVine-enriched heroes that had none.
-- Two cohorts, both filling a real franchise so the characters become
-- browsable universes + fame-eligible (see [[project_publisher_branding]],
-- [[project_universe_reframe]]). Assignment is by comicvine_id, the established
-- hand-curated key. Gated on the current bucket so a re-run is idempotent and
-- won't clobber later manual edits.

-- ── 1 · NULL publisher (ComicVine returned no publisher) ─────────────────────
update public.heroes set publisher = 'Avatar: The Last Airbender'
  where publisher is null and comicvine_id in ('135728', '135842', '135731');
update public.heroes set publisher = 'Star Wars'
  where publisher is null and comicvine_id in ('64449');
update public.heroes set publisher = 'Marvel'
  where publisher is null and comicvine_id in ('194959');
update public.heroes set publisher = 'Hasbro'
  where publisher is null and comicvine_id in ('73262');
update public.heroes set publisher = 'DC Comics'
  where publisher is null and comicvine_id in ('183199');

-- ── 2 · Creator-Owned catch-all → real franchises (by team/identity) ─────────
-- The Boys (96)
update public.heroes set publisher = 'The Boys'
  where publisher = 'Creator-Owned' and comicvine_id in ('3917', '16905', '19496', '20925', '30095', '37172', '39350', '39743', '40552', '40553', '40555', '40557', '40558', '44499', '44500', '44501', '51099', '51100', '51101', '51102', '51103', '51105', '51106', '51107', '51108', '51109', '53157', '56068', '56070', '56439', '56773', '57779', '58269', '59640', '59641', '60457', '63561', '65503', '67471', '67472', '67473', '67474', '67475', '67476', '67477', '67836', '67837', '67838', '67839', '67840', '67841', '67842', '67843', '67844', '67845', '67846', '67847', '67848', '67849', '67850', '67851', '67852', '67854', '67855', '68007', '68008', '68009', '68010', '69072', '70425', '77315', '77316', '77317', '77318', '83829', '102258', '102259', '102261', '102263', '102264', '102265', '102266', '102267', '102268', '149807', '149856', '149859', '149860', '150029', '150035', '150036', '150037', '150045', '169731', '169732', '190458');
-- Sin City (21)
update public.heroes set publisher = 'Sin City'
  where publisher = 'Creator-Owned' and comicvine_id in ('12425', '18159', '21263', '21267', '21268', '21269', '25043', '25044', '25045', '25046', '25082', '25083', '25124', '25126', '25175', '25176', '26396', '44585', '70490', '73228', '119727');
-- Game of Thrones (3)
update public.heroes set publisher = 'Game of Thrones'
  where publisher = 'Creator-Owned' and comicvine_id in ('80161', '80202', '80612');
-- Hellboy (2)
update public.heroes set publisher = 'Hellboy'
  where publisher = 'Creator-Owned' and comicvine_id in ('5466', '25795');
-- Kick-Ass (2)
update public.heroes set publisher = 'Kick-Ass'
  where publisher = 'Creator-Owned' and comicvine_id in ('56881', '59157');
-- Preacher (1)
update public.heroes set publisher = 'Preacher'
  where publisher = 'Creator-Owned' and comicvine_id in ('10527');
-- Marvel (1)
update public.heroes set publisher = 'Marvel'
  where publisher = 'Creator-Owned' and comicvine_id in ('17817');
-- Tank Girl (1)
update public.heroes set publisher = 'Tank Girl'
  where publisher = 'Creator-Owned' and comicvine_id in ('46763');

-- Placing heroes into real franchises makes them fame-eligible.
select public.refresh_fame();
