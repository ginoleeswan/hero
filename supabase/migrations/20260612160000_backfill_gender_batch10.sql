-- Backfill gender for ~78 most-viewed heroes missing it (batch 10).
-- Also catches Martin Luther missed from batch 9.
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-2089','cv-1336','cv-4209','cv-4980','cv-4325','cv-3937','cv-4000','cv-3132',
  'cv-2557','cv-4498','cv-4599','cv-3741','cv-3167','cv-3772','cv-4297','cv-3987',
  'cv-3952','cv-4309','cv-1857','cv-3918','cv-2305','cv-2209','cv-4875','cv-3027'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-4025','cv-3688','cv-3487','cv-4012','cv-2558','cv-3306','cv-4124','cv-3860',
  'cv-3831','cv-4876','cv-3018','cv-2383','cv-3863','cv-4687','cv-2885','cv-4496',
  'cv-3336','cv-2499','cv-2948','cv-3529','cv-1952','cv-2770','cv-1875','cv-4147',
  'cv-4977','cv-4699','cv-3310','cv-4981','cv-3050','cv-3991','cv-2920','cv-4775',
  'cv-3372','cv-4719','cv-2038','cv-4226','cv-2744','cv-3906','cv-2543','cv-2882',
  'cv-2232','cv-4783','cv-3337','cv-2341','cv-3062','cv-3929','cv-3164','cv-3915',
  'cv-2340','cv-4600','cv-2556','cv-2555','cv-2612','cv-3981'
);
