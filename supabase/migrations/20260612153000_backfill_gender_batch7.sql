-- Backfill gender for ~143 most-viewed heroes missing it (batch 7).
-- Also fills 4 heroes that were classified but missed from batch 6's SQL
-- (Sweet Polly Purebred, Savah, Aunt Clinker, Mazie).
-- Approach: name + summary reading. Skipped: shapeshifters (Xavin), hive entities
-- (Colony), genderless Pokémon (Jigglypuff), cosmic entities (Phoenix Force),
-- and entries with no summary and ambiguous names.
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-2456','cv-4716','cv-3900','cv-4682','cv-2294','cv-4080','cv-1975','cv-3330',
  'cv-3922','cv-3905','cv-4284','cv-3074','cv-1379','cv-1316','cv-1755','cv-3343',
  'cv-2991','cv-1614','cv-3769','cv-3262','cv-4661','cv-4584','cv-3829','cv-2684',
  'cv-4020','cv-4587','cv-4082','cv-2938','cv-3307','cv-1550','cv-2303','cv-3649',
  'cv-3448','cv-2909','cv-2117','cv-4001','cv-3846','cv-2999','cv-3889','cv-2678',
  'cv-1341','cv-4745','cv-3059','cv-3197','cv-1424','cv-1815','cv-3567','cv-3826',
  'cv-2036','cv-2148','cv-1626','cv-3035','cv-1854','cv-2949','cv-4218'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-2766','cv-2492','cv-3033','cv-2844','cv-3235','cv-4308','cv-2536','cv-4882',
  'cv-1564','cv-3667','cv-4749','cv-1358','cv-4657','cv-1756','cv-3890','cv-4336',
  'cv-3706','cv-1972','cv-1710','cv-4886','cv-2440','cv-2053','cv-4136','cv-4425',
  'cv-3834','cv-4271','cv-4076','cv-1966','cv-1776','cv-2022','cv-3850','cv-1927',
  'cv-2155','cv-3099','cv-4451','cv-1983','cv-1549','cv-3087','cv-2784','cv-3704',
  'cv-3073','cv-1578','cv-3360','cv-1317','cv-3783','cv-2094','cv-3925','cv-3849',
  'cv-4113','cv-2534','cv-1858','cv-4140','cv-3945','cv-3107','cv-2092','cv-3518',
  'cv-2788','cv-3728','cv-3091','cv-2302','cv-3996','cv-4083','cv-3243','cv-1615',
  'cv-3888','cv-3014','cv-1291','cv-3139','cv-1956','cv-3955','cv-4304','cv-4010',
  'cv-4121','cv-4146','cv-1376','cv-4081','cv-3669','cv-3994','cv-3910','cv-4022',
  'cv-3326','cv-1585','cv-3868','cv-1866','cv-1977','cv-2911','cv-4838','cv-3094'
);
