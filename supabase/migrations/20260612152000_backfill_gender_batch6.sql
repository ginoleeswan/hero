-- Backfill gender for the next ~160 most-viewed heroes missing it (batch 6).
-- Inferred by reading each name + summary (pronouns, female/male name signals,
-- relational cues like "mother/father/sister/brother/daughter/son", historical
-- figures, known characters from TerryToons/ElfQuest/G-Force/ALF etc.).
-- Genuinely ambiguous or genderless characters (Phoenix Force, Xavin, Colony,
-- Jigglypuff, entities with no summary) are intentionally left null.
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-4033','cv-1584','cv-3331','cv-3574','cv-4264','cv-4940','cv-1394','cv-3260',
  'cv-3643','cv-3953','cv-2483','cv-3052','cv-4619','cv-4463','cv-2416','cv-1321',
  'cv-3354','cv-2369','cv-4238','cv-2807','cv-1871','cv-4575','cv-2970','cv-1870',
  'cv-4766','cv-4824','cv-1957','cv-1315','cv-2188','cv-3960','cv-4291','cv-2419',
  'cv-1288','cv-2460','cv-3333','cv-4805','cv-2674','cv-2096','cv-4311','cv-4135',
  'cv-1284','cv-1343','cv-1646','cv-1580','cv-1553','cv-2498','cv-2904','cv-3349',
  'cv-4831','cv-2200','cv-3745','cv-2906','cv-1286','cv-4902'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-3105','cv-3283','cv-3416','cv-1558','cv-3821','cv-1353','cv-3143','cv-2364',
  'cv-3393','cv-4772','cv-2116','cv-2133','cv-1357','cv-4812','cv-2945','cv-1354',
  'cv-2277','cv-2415','cv-2021','cv-2418','cv-2937','cv-2496','cv-4712','cv-4764',
  'cv-4377','cv-1819','cv-3032','cv-3949','cv-1971','cv-3959','cv-4418','cv-1324',
  'cv-3131','cv-2186','cv-3451','cv-4803','cv-4729','cv-2495','cv-3449','cv-1285',
  'cv-4859','cv-3265','cv-2884','cv-3854','cv-4926','cv-4282','cv-3838','cv-2129',
  'cv-2939','cv-3045','cv-3907','cv-3869','cv-4739','cv-2132','cv-2538','cv-4585',
  'cv-3898','cv-1306','cv-3165','cv-3690','cv-3882','cv-2455','cv-4260','cv-3864',
  'cv-4947','cv-4933','cv-1287','cv-4738','cv-4781','cv-4696','cv-3655','cv-2600',
  'cv-3743','cv-4414','cv-3809','cv-2453','cv-1953','cv-2266','cv-2493','cv-2454',
  'cv-3450','cv-3961','cv-3332','cv-1360','cv-3049','cv-4534','cv-4792','cv-4976',
  'cv-3116','cv-2504','cv-4816','cv-4419','cv-4605','cv-2542','cv-3948','cv-3988',
  'cv-3157','cv-3926','cv-3108','cv-4303','cv-4782','cv-2397','cv-2686','cv-2417',
  'cv-1579','cv-3656'
);
