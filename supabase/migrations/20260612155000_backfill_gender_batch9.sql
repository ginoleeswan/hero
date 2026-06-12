-- Backfill gender for ~100 most-viewed heroes missing it (batch 9).
-- Also catches 3 heroes missed from batch 8 (Yasser Arafat, Rodney Dangerfield,
-- William Sherman) and 1 from batch 7 (Elmo).
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-4206','cv-3261','cv-1855','cv-4427','cv-2858','cv-3342','cv-3273','cv-3861',
  'cv-3876','cv-2989','cv-2798','cv-4688','cv-4591','cv-3985','cv-4747','cv-3977',
  'cv-1340','cv-3680','cv-4159','cv-3986'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-3427','cv-2622','cv-4830','cv-3865','cv-1820','cv-4233','cv-4594','cv-2847',
  'cv-4530','cv-4182','cv-3646','cv-3950','cv-4070','cv-3010','cv-2751','cv-3151',
  'cv-1681','cv-4017','cv-4546','cv-1381','cv-4695','cv-3947','cv-1359','cv-2950',
  'cv-3968','cv-3842','cv-1924','cv-4495','cv-4073','cv-4137','cv-3894','cv-2595',
  'cv-1917','cv-4224','cv-2886','cv-4283','cv-4630','cv-3941','cv-1961','cv-3755',
  'cv-3984','cv-3974','cv-2371','cv-2255','cv-2295','cv-4504','cv-2888','cv-4741',
  'cv-4005','cv-2147','cv-3272','cv-3752','cv-2088','cv-3895','cv-2683','cv-4144',
  'cv-4276','cv-3943','cv-2777','cv-4592','cv-4450','cv-1268','cv-1295','cv-1911',
  'cv-2767','cv-3051','cv-3158','cv-3852','cv-3110','cv-3070','cv-4785','cv-4344',
  'cv-4597','cv-4071','cv-4014','cv-4047','cv-2724','cv-3847','cv-3892','cv-1369'
);
