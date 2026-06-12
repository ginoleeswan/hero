-- Backfill gender for the next ~186 most-viewed heroes missing it, inferred by
-- reading each name + summary (catching cross-character pronoun contamination
-- that a pure heuristic gets wrong, e.g. "Betty Lou ... when he was a kid" = the
-- male friend, Betty Lou herself is female). Genuinely unknowable/genderless
-- characters (Phoenix Force, no-summary ambiguous names) are intentionally left
-- null. Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-3639','cv-2662','cv-3585','cv-3631','cv-3284','cv-1939','cv-2530','cv-2103',
  'cv-4836','cv-4678','cv-2195','cv-3640','cv-1587','cv-2996','cv-2541','cv-1366',
  'cv-4756','cv-3186','cv-4400','cv-1682','cv-3587','cv-2490','cv-2637','cv-3368',
  'cv-2203','cv-3090','cv-3369','cv-4537','cv-1925','cv-3192','cv-4826','cv-3371',
  'cv-3128','cv-3425','cv-2975','cv-2178','cv-1976','cv-2803','cv-1851','cv-1684',
  'cv-1556','cv-3593','cv-2627','cv-4240','cv-4122','cv-3408','cv-4668','cv-1583',
  'cv-4949','cv-3611','cv-2269','cv-1888','cv-4880','cv-4666','cv-1356','cv-1348',
  'cv-2070','cv-4809','cv-2856','cv-3723'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-2199','cv-4679','cv-4606','cv-1869','cv-3424','cv-4362','cv-3205','cv-1849',
  'cv-2997','cv-1789','cv-3564','cv-4923','cv-3592','cv-2636','cv-4598','cv-3764',
  'cv-3671','cv-1908','cv-4566','cv-1909','cv-2765','cv-3177','cv-4258','cv-4922',
  'cv-4582','cv-1548','cv-3666','cv-4936','cv-2664','cv-1333','cv-2141','cv-3801',
  'cv-1981','cv-2225','cv-3562','cv-3057','cv-2139','cv-3522','cv-1731','cv-2494',
  'cv-1520','cv-2263','cv-4643','cv-4110','cv-3612','cv-2881','cv-4894','cv-2487',
  'cv-2758','cv-2125','cv-2033','cv-2669','cv-3615','cv-3620','cv-1954','cv-3479',
  'cv-3236','cv-1993','cv-1327','cv-2757','cv-4615','cv-2546','cv-1375','cv-2421',
  'cv-4685','cv-3697','cv-2245','cv-3839','cv-2241','cv-3302','cv-2467','cv-1329',
  'cv-3815','cv-1542','cv-1332','cv-4310','cv-4423','cv-2249','cv-2034','cv-2221',
  'cv-4804','cv-4590','cv-2032','cv-3374','cv-3230','cv-3409','cv-4214','cv-1355',
  'cv-2489','cv-3609','cv-3432','cv-3642','cv-3058','cv-1860','cv-3085','cv-4426',
  'cv-4424','cv-3414','cv-2055','cv-3594','cv-2501','cv-2278','cv-3125','cv-4106',
  'cv-2179','cv-3370','cv-4713','cv-4608','cv-3780','cv-1581','cv-3376','cv-2135',
  'cv-2184','cv-4667','cv-1955','cv-1554','cv-3286','cv-1427','cv-4669','cv-4467',
  'cv-3021','cv-4280','cv-1853','cv-1910','cv-2185'
);
