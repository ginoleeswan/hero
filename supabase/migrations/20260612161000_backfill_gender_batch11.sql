-- Backfill gender for ~142 heroes missing it (batch 11).
-- Switched to querying only heroes with summaries for better yield.
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-1912','cv-1794','cv-2110','cv-3338','cv-3753','cv-1763','cv-4208','cv-4267',
  'cv-4850','cv-3055','cv-3600','cv-2040','cv-4207','cv-4962','cv-2076','cv-2075',
  'cv-3681','cv-4225','cv-4670','cv-3942','cv-2367','cv-3658','cv-3601','cv-3659',
  'cv-2790','cv-4131','cv-4132','cv-4511','cv-3650','cv-2513','cv-4879','cv-2314',
  'cv-1511','cv-1625','cv-3011','cv-2512','cv-3884','cv-2735','cv-4509','cv-3971',
  'cv-3674','cv-2910','cv-1897','cv-4638','cv-3686','cv-2042','cv-4548','cv-2651',
  'cv-4637','cv-2653','cv-1318','cv-1914'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-2923','cv-3361','cv-3824','cv-3990','cv-3341','cv-2603','cv-3924','cv-3896',
  'cv-2459','cv-4655','cv-1507','cv-4979','cv-3111','cv-2068','cv-2717','cv-2293',
  'cv-2376','cv-4160','cv-3965','cv-3969','cv-2370','cv-2067','cv-3872','cv-4900',
  'cv-3999','cv-4478','cv-4848','cv-4075','cv-3168','cv-3964','cv-2072','cv-3660',
  'cv-2202','cv-2728','cv-2721','cv-2505','cv-1292','cv-2079','cv-3673','cv-3944',
  'cv-2720','cv-2074','cv-3989','cv-2605','cv-1438','cv-3203','cv-3700','cv-4499',
  'cv-3720','cv-3153','cv-3822','cv-4196','cv-3305','cv-4742','cv-4242','cv-2988',
  'cv-4417','cv-3870','cv-1963','cv-3785','cv-3610','cv-2511','cv-3967','cv-3140',
  'cv-3972','cv-4123','cv-4320','cv-4058','cv-1798','cv-3897','cv-4877','cv-2515',
  'cv-2752','cv-4090','cv-3980','cv-2703','cv-3056','cv-2078','cv-4141','cv-3837',
  'cv-3867','cv-4515','cv-2998','cv-1320','cv-3109','cv-4061','cv-4911','cv-4787',
  'cv-2441','cv-3901'
);
