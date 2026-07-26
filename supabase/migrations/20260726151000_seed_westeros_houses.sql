insert into public.houses (slug, name, universe, words, seat, sigil_tint, blurb, position) values
('targaryen','House Targaryen','Game of Thrones','Fire and Blood','Dragonstone','#8c1c13',
 'Dragonlords of old Valyria who survived its Doom, conquered six kingdoms on the backs of three dragons, and spent three centuries marrying each other to keep the blood pure.', 1),
('stark','House Stark','Game of Thrones','Winter is Coming','Winterfell','#5b6770',
 'Kings in the North for eight thousand years, descended from the First Men, and the only house in Westeros that treats honour as a strategy rather than a decoration.', 2),
('lannister','House Lannister','Game of Thrones','Hear Me Roar','Casterly Rock','#a8181b',
 'The richest house in the Seven Kingdoms, seated on a literal mountain of gold, and famous for a saying about paying debts that is not actually their words.', 3),
('baratheon','House Baratheon','Game of Thrones','Ours is the Fury','Storm''s End','#c8a02c',
 'Founded by Aegon the Conqueror''s bastard brother, raised to a throne by rebellion, and undone within a generation by three brothers who could not agree on anything.', 4),
('greyjoy','House Greyjoy','Game of Thrones','We Do Not Sow','Pyke','#1f2d3a',
 'Ironborn reavers who take what they want from the sea and everyone on it, and who have rebelled against the Iron Throne roughly as often as they have been beaten by it.', 5),
('tully','House Tully','Game of Thrones','Family, Duty, Honour','Riverrun','#8f2c2c',
 'Lords of the Riverlands, whose words put family first and whose alliances by marriage pulled them into every war fought across their own fields.', 6),
('tyrell','House Tyrell','Game of Thrones','Growing Strong','Highgarden','#3f7d44',
 'Stewards who became lords of the richest farmland in Westeros, and who preferred to win by marriage, harvest and reputation rather than by battle.', 7),
('martell','House Martell','Game of Thrones','Unbowed, Unbent, Unbroken','Sunspear','#c9631f',
 'The only kingdom Aegon''s dragons never conquered, joined to the realm by marriage instead, and the only house in Westeros where a daughter inherits before her younger brother.', 8)
on conflict (slug) do nothing;
