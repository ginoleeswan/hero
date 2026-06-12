-- Backfill gender for recognizable ComicVine-imported heroes (batch 2:
-- issue_count rank ~150-310). Ambiguous/obscure/foreign entries skipped.
-- Guarded so only NULL columns are touched.

update heroes h set gender = v.gender
from (values
  ('cv-4486','Female'),('cv-3318','Female'),('cv-3447','Male'),('cv-3740','Female'),
  ('cv-4845','Male'),('cv-2864','Male'),('cv-2172','Male'),('cv-3622','Female'),
  ('cv-3277','Male'),('cv-2030','Male'),('cv-1536','Female'),('cv-3211','Male'),
  ('cv-1529','Male'),('cv-1256','Male'),('cv-2880','Female'),('cv-3134','Male'),
  ('cv-1790','Female'),('cv-4069','Male'),('cv-2479','Male'),('cv-3616','Male'),
  ('cv-2379','Male'),('cv-2943','Male'),('cv-3225','Male'),('cv-2254','Male'),
  ('cv-1723','Male'),('cv-3771','Male'),('cv-2646','Male'),('cv-1847','Female'),
  ('cv-3629','Female'),('cv-1721','Female'),('cv-1940','Female'),('cv-1936','Female'),
  ('cv-4807','Male'),('cv-3161','Male'),('cv-3763','Male'),('cv-3183','Male'),
  ('cv-3608','Male'),('cv-3327','Female'),('cv-2098','Male'),('cv-4008','Male'),
  ('cv-4943','Female'),('cv-3939','Male'),('cv-2213','Male'),('cv-2197','Male'),
  ('cv-4262','Male'),('cv-4680','Male'),('cv-4009','Male'),('cv-2212','Male'),
  ('cv-4270','Male'),('cv-4767','Male'),('cv-2258','Male'),('cv-2841','Male'),
  ('cv-3320','Male'),('cv-3115','Male'),('cv-4846','Male'),('cv-3758','Male'),
  ('cv-3795','Male'),('cv-1814','Male'),('cv-2127','Male'),('cv-3737','Male'),
  ('cv-3104','Male'),('cv-3708','Male'),('cv-4918','Male'),('cv-4457','Male'),
  ('cv-4560','Male'),('cv-4814','Female'),('cv-1668','Male'),('cv-2222','Female'),
  ('cv-3517','Male'),('cv-3459','Male'),('cv-3625','Male'),('cv-3282','Male'),
  ('cv-3573','Female'),('cv-2857','Male'),('cv-1965','Male'),('cv-3470','Male'),
  ('cv-2933','Female'),('cv-1365','Female'),('cv-3754','Male'),('cv-4881','Female'),
  ('cv-3064','Female'),('cv-3799','Male'),('cv-3770','Male'),('cv-2166','Male'),
  ('cv-3362','Male'),('cv-2106','Male'),('cv-2097','Male'),('cv-3582','Male'),
  ('cv-2930','Male'),('cv-2816','Female'),('cv-2537','Female'),('cv-4561','Female'),
  ('cv-2658','Female'),('cv-2246','Male'),('cv-4589','Male'),('cv-3803','Male'),
  ('cv-4660','Male'),('cv-4905','Male'),('cv-4581','Female'),('cv-4937','Male'),
  ('cv-4704','Female'),('cv-3438','Male'),('cv-3223','Male'),('cv-2128','Male'),
  ('cv-2968','Male'),('cv-3229','Male'),('cv-2170','Male'),('cv-2690','Male'),
  ('cv-2473','Male'),('cv-2611','Male'),('cv-4703','Male'),('cv-3733','Male'),
  ('cv-4813','Male'),('cv-2194','Male'),('cv-2474','Male'),('cv-4906','Female'),
  ('cv-2676','Male'),('cv-3920','Male'),('cv-3632','Female'),('cv-2140','Female'),
  ('cv-3598','Male'),('cv-3315','Male'),('cv-4607','Male'),('cv-2169','Male'),
  ('cv-3777','Male'),('cv-2695','Male'),('cv-2189','Male'),('cv-1938','Male'),
  ('cv-3555','Male'),('cv-4686','Female'),('cv-2142','Female'),('cv-2168','Male'),
  ('cv-3807','Male'),('cv-4944','Male'),('cv-1996','Male'),('cv-2391','Female'),
  ('cv-1960','Female'),('cv-3239','Male'),('cv-1943','Female'),('cv-3144','Male'),
  ('cv-3415','Female'),('cv-1432','Male'),('cv-1526','Male'),('cv-2167','Male'),
  ('cv-3577','Female'),('cv-2035','Female'),('cv-2385','Male'),('cv-2670','Male'),
  ('cv-1813','Male')
) as v(id, gender)
where h.id = v.id and h.gender is null;

update heroes set alignment = 'bad' where alignment is null and id = 'cv-4814';
