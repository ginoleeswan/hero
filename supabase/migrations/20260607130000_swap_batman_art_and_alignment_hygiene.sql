-- Swap the profile art between Batman (Bruce Wayne, id 69) and Batman Beyond
-- (Terry McGinnis, id 70): the classic cowl belongs to Bruce, the red-accented
-- Beyond suit to Terry. Only the image pointers move, not the stored files.
UPDATE heroes SET
  image_url    = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/lg/70-batman.jpg',
  image_md_url = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md/70-batman.jpg',
  portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/70.jpg'
WHERE id = '69';
UPDATE heroes SET
  image_url    = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/lg/69-batman.jpg',
  image_md_url = 'https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images/md/69-batman.jpg',
  portrait_url = 'https://rpvgqfaeiowisdubgxkg.supabase.co/storage/v1/object/public/hero-portraits/69.jpg'
WHERE id = '70';

-- Alignment hygiene: '-' is not a valid alignment (the app expects
-- good / bad / neutral, or null). Normalise the 6 affected rows to NULL.
UPDATE heroes SET alignment = NULL WHERE alignment = '-';
