-- The eighteen Targaryen monarchs of the Iron Throne, AC = After the Conquest.
--
-- Keyed by id, not name: this house holds several Aegons and two Aerys, and a
-- name-keyed update here would be a coin flip. Rhaenyra and Aegon II overlap
-- because they ruled against each other during the Dance of the Dragons — that
-- is the data, not an error.
update public.heroes set reign_start = v.s, reign_end = v.e
from (values
  ('h_81e51866-ca1d-4494-bd9d-a0b7c9a32ed8', '1 AC',   '37 AC'),   -- Aegon I, the Conqueror
  ('h_0010a9d1-5464-429e-982b-d841bdb6c3c9', '37 AC',  '42 AC'),   -- Aenys I
  ('h_db495609-3483-4331-802c-cb262c71902d', '42 AC',  '48 AC'),   -- Maegor I, the Cruel
  ('h_c30060e3-c2b6-4095-b474-bcbefb17ed6c', '48 AC',  '103 AC'),  -- Jaehaerys I, the Conciliator
  ('h_f2598a4e-337e-47ac-ae75-15c255c2ca7e', '103 AC', '129 AC'),  -- Viserys I
  ('h_1c4b0581-3f25-41a1-a000-1d9aa9b61329', '129 AC', '130 AC'),  -- Rhaenyra
  ('h_2ca8347e-c782-401a-b945-74448a593260', '129 AC', '131 AC'),  -- Aegon II
  ('h_c21a7b01-cf85-485e-8381-6042e303e49c', '131 AC', '157 AC'),  -- Aegon III, the Dragonbane
  ('h_c0209c7e-3fe4-4a08-892f-4131e9e31ca7', '157 AC', '161 AC'),  -- Daeron I, the Young Dragon
  ('h_64ea2a0f-0440-4b4e-b995-61a1b0e8db55', '161 AC', '171 AC'),  -- Baelor I, the Blessed
  ('h_fd818ab4-c492-417f-864d-7ed7aba1bc27', '171 AC', '172 AC'),  -- Viserys II
  ('h_e4663a99-b1e7-49e0-bbe3-6eeccb958034', '172 AC', '184 AC'),  -- Aegon IV, the Unworthy
  ('h_68ffb5e8-e06f-4cd7-8ef6-1429a155794a', '184 AC', '209 AC'),  -- Daeron II, the Good
  ('h_b3018aee-7a6c-4e5a-887a-4a569e12efca', '209 AC', '221 AC'),  -- Aerys I
  ('h_3db72377-ddf6-4642-a4af-38bd5751811c', '221 AC', '233 AC'),  -- Maekar I
  ('h_217c57a8-8471-4507-84dd-944a61945d0a', '233 AC', '259 AC'),  -- Aegon V, the Unlikely
  ('h_2054cddc-28f0-466b-b856-46dfad92ff70', '259 AC', '262 AC'),  -- Jaehaerys II
  ('h_3c3e0083-ec4b-4a82-8976-0abd584fedae', '262 AC', '283 AC')   -- Aerys II, the Mad King
) as v(id, s, e)
where public.heroes.id = v.id;
