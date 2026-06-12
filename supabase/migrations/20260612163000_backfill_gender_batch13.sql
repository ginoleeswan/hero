-- Backfill gender for ~78 heroes missing it (batch 13).
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-3928','cv-4554','cv-3930','cv-2235','cv-4620','cv-1282','cv-4622','cv-3204',
  'cv-4432','cv-4535','cv-2787','cv-4955','cv-3138','cv-1891','cv-3698','cv-4412',
  'cv-1399','cv-4430','cv-4190','cv-2644','cv-2722','cv-2732','cv-2507','cv-2552',
  'cv-2668','cv-4316'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-4954','cv-3678','cv-1297','cv-3722','cv-1402','cv-4429','cv-2712','cv-1527',
  'cv-4623','cv-1818','cv-2442','cv-4523','cv-4151','cv-4514','cv-4228','cv-3297',
  'cv-4413','cv-4241','cv-3137','cv-4526','cv-4642','cv-4501','cv-1393','cv-2759',
  'cv-3363','cv-3102','cv-2878','cv-4517','cv-1671','cv-3677','cv-3954','cv-1425',
  'cv-4003','cv-4527','cv-3871','cv-4089','cv-4023','cv-4502','cv-4078','cv-1406',
  'cv-1417','cv-1430','cv-2718','cv-2693','cv-2708','cv-1423','cv-2682','cv-1431',
  'cv-2689','cv-3077','cv-3744'
);
