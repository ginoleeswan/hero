-- Backfill gender for ~127 most-viewed heroes missing it (batch 8).
-- Approach: name + summary reading (pronouns, gendered titles, relational cues,
-- known real-world figures, mythological and fictional characters from context).
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-3000','cv-2146','cv-4202','cv-3933','cv-1620','cv-4842','cv-4125','cv-3366',
  'cv-2638','cv-3893','cv-4312','cv-3355','cv-2987','cv-4229','cv-2893','cv-3956',
  'cv-2782','cv-2150','cv-4835','cv-2210','cv-4204','cv-3385','cv-2087','cv-3661',
  'cv-4287','cv-2775','cv-2018','cv-4205','cv-3357','cv-4195','cv-1962','cv-3084',
  'cv-4945','cv-2154','cv-3836','cv-3339','cv-3662','cv-3855'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-3088','cv-2992','cv-3885','cv-4740','cv-2761','cv-3832','cv-3093','cv-4390',
  'cv-3334','cv-4107','cv-2804','cv-4950','cv-4199','cv-4114','cv-4953','cv-4939',
  'cv-4013','cv-2145','cv-2616','cv-4948','cv-4104','cv-4100','cv-4388','cv-1530',
  'cv-3973','cv-2654','cv-3899','cv-3004','cv-1747','cv-1848','cv-3938','cv-3516',
  'cv-3071','cv-4145','cv-2815','cv-1653','cv-3881','cv-2408','cv-4771','cv-4275',
  'cv-1757','cv-4750','cv-3020','cv-4269','cv-2274','cv-2144','cv-2763','cv-2731',
  'cv-1765','cv-1984','cv-4370','cv-4152','cv-4593','cv-2924','cv-4770','cv-4784',
  'cv-3234','cv-4731','cv-3751','cv-3092','cv-4273','cv-3997','cv-2983','cv-2535',
  'cv-3951','cv-4133','cv-4601','cv-3935','cv-2747','cv-1907','cv-1586','cv-3742',
  'cv-4198','cv-4536','cv-2614','cv-1821','cv-3255','cv-3902','cv-3547','cv-1670',
  'cv-2500','cv-4674','cv-2964','cv-4201','cv-1624','cv-4266','cv-3891','cv-1978',
  'cv-3940'
);
