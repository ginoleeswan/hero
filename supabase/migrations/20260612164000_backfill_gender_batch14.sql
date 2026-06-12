-- Backfill gender for ~55 heroes missing it (batch 14).
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-1426','cv-4491','cv-2039','cv-1367','cv-2447','cv-2281','cv-4384','cv-3931',
  'cv-3148','cv-2634','cv-3166','cv-2741','cv-3264','cv-4553','cv-3695','cv-2733',
  'cv-3932','cv-4180','cv-3679','cv-3696'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-4431','cv-2649','cv-4019','cv-1419','cv-4490','cv-4492','cv-2375','cv-2122',
  'cv-2446','cv-4356','cv-1422','cv-4725','cv-4737','cv-3923','cv-1803','cv-4200',
  'cv-4015','cv-1363','cv-2449','cv-2462','cv-1301','cv-1294','cv-2749','cv-4247',
  'cv-4726','cv-4730','cv-4829','cv-4227','cv-1300','cv-4978','cv-3218','cv-2719',
  'cv-2993','cv-2506','cv-4317'
);
