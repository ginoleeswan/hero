-- repeat('great-') is correct and unreadable past a couple of generations:
-- Daenerys's line to Aegon the Conqueror produced
-- "great-great-great-great-great-great-great-great-great-great-grandfather".
-- Keep the spelt-out form for the two generations people actually say aloud and
-- switch to a multiplier above that.
update public.hero_relatives r
set role = case
    when r.tier = 3 then 'great-grandparent'
    when r.tier = 4 then 'great-great-grandparent'
    else (r.tier - 2) || '× great-grandparent'
  end
from public.heroes h, public.heroes rel
where h.id = r.hero_id
  and h.publisher = 'Game of Thrones'
  and rel.id = r.related_hero_id
  and r.relation = 'ancestor';

-- Re-gender the labels now that the shape is settled.
update public.hero_relatives r
set role = replace(r.role, 'grandparent',
      case when rel.gender = 'Female' then 'grandmother' else 'grandfather' end)
from public.heroes h, public.heroes rel
where h.id = r.hero_id
  and h.publisher = 'Game of Thrones'
  and rel.id = r.related_hero_id
  and r.relation = 'ancestor';;
