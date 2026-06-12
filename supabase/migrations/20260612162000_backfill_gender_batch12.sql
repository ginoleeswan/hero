-- Backfill gender for ~109 heroes missing it (batch 12).
-- Also catches 3 missed from batch 11 (Ted Bundy, Paul Wang, Abdiel)
-- and 1 missed from batch 11 (Kirstie Alley).
-- Guarded so an existing gender is never overwritten.

update heroes set gender = 'Female'
where (gender is null or gender = '') and id in (
  'cv-4777','cv-2514','cv-2730','cv-1311','cv-2805','cv-3358','cv-4773','cv-2862',
  'cv-4126','cv-2734','cv-4230','cv-1289','cv-2723','cv-4369','cv-4232','cv-4827',
  'cv-1364','cv-3912','cv-3993','cv-3843','cv-2234','cv-2443','cv-4212','cv-3663',
  'cv-3962','cv-4006','cv-3676','cv-2729','cv-4239','cv-4788','cv-2806','cv-3820',
  'cv-3352'
);

update heroes set gender = 'Male'
where (gender is null or gender = '') and id in (
  'cv-3858','cv-2077','cv-4959','cv-3983','cv-2617','cv-4714','cv-4007','cv-2516',
  'cv-4890','cv-1428','cv-4178','cv-2510','cv-1885','cv-2786','cv-3675','cv-4054',
  'cv-4197','cv-3340','cv-4221','cv-4715','cv-3992','cv-2754','cv-2666','cv-3012',
  'cv-4290','cv-1604','cv-3946','cv-3841','cv-3373','cv-4500','cv-2564','cv-4547',
  'cv-4035','cv-4965','cv-2679','cv-4510','cv-3013','cv-1797','cv-3216','cv-1753',
  'cv-2748','cv-3292','cv-1831','cv-1901','cv-3212','cv-1397','cv-4382','cv-3309',
  'cv-1400','cv-4036','cv-4652','cv-3845','cv-3848','cv-3887','cv-3908','cv-3757',
  'cv-3851','cv-4034','cv-3903','cv-4118','cv-4222','cv-4048','cv-2797','cv-4878',
  'cv-3159','cv-3975','cv-2887','cv-3995','cv-3966','cv-3830','cv-4274','cv-2903',
  'cv-4158'
);
