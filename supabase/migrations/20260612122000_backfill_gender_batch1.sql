-- Backfill gender for the most-viewed ComicVine-imported heroes (batch 1:
-- issue_count rank ~1-150). Gender is an unambiguous fact for recognizable
-- characters; the genuinely genderless (Phoenix Force, R2-D2) are intentionally
-- left null. A handful of clear alignment nulls are filled alongside.
-- Guarded so only NULL columns are touched.

update heroes h set gender = v.gender
from (values
  ('cv-2936','Male'),('cv-1691','Male'),('cv-2839','Male'),('cv-3552','Female'),
  ('cv-2840','Female'),('cv-2843','Female'),('cv-2151','Male'),('cv-1728','Male'),
  ('cv-1808','Female'),('cv-3548','Female'),('cv-3727','Male'),('cv-2438','Male'),
  ('cv-3176','Female'),('cv-3202','Male'),('cv-3213','Male'),('cv-2860','Male'),
  ('cv-3200','Female'),('cv-2247','Male'),('cv-3546','Male'),('cv-4563','Male'),
  ('cv-1487','Male'),('cv-4562','Female'),('cv-4586','Male'),('cv-1809','Male'),
  ('cv-4644','Male'),('cv-1780','Female'),('cv-3566','Female'),('cv-2647','Male'),
  ('cv-2350','Male'),('cv-4557','Female'),('cv-1451','Male'),('cv-2015','Male'),
  ('cv-1463','Female'),('cv-3560','Female'),('cv-4913','Female'),('cv-2012','Male'),
  ('cv-2861','Male'),('cv-3404','Male'),('cv-4324','Male'),('cv-4885','Male'),
  ('cv-4279','Male'),('cv-3586','Male'),('cv-2859','Male'),('cv-2395','Male'),
  ('cv-1741','Female'),('cv-1489','Male'),('cv-3179','Male'),('cv-2743','Male'),
  ('cv-3182','Male'),('cv-3617','Male'),('cv-3584','Female'),('cv-1737','Male'),
  ('cv-3618','Female'),('cv-4915','Female'),('cv-3190','Male'),('cv-1686','Male'),
  ('cv-1838','Male'),('cv-1480','Female'),('cv-3718','Male'),('cv-3726','Male'),
  ('cv-3329','Male'),('cv-4442','Female'),('cv-4444','Male'),('cv-3725','Male'),
  ('cv-3457','Male'),('cv-1782','Male'),('cv-1781','Male'),('cv-3381','Male'),
  ('cv-2010','Male'),('cv-3426','Female'),('cv-4558','Female'),('cv-3181','Female'),
  ('cv-3526','Male'),('cv-3175','Male'),('cv-4327','Female'),('cv-4559','Female'),
  ('cv-4929','Female'),('cv-2248','Male'),('cv-4329','Male'),('cv-4052','Male'),
  ('cv-3588','Male'),('cv-3507','Male'),('cv-4684','Male'),('cv-1273','Female'),
  ('cv-2478','Male'),('cv-3544','Male'),('cv-2484','Female'),('cv-4063','Female'),
  ('cv-2652','Female'),('cv-3715','Male'),('cv-1690','Female'),('cv-4437','Male'),
  ('cv-2657','Female'),('cv-2655','Male'),('cv-1264','Male'),('cv-4647','Male'),
  ('cv-1786','Male'),('cv-1680','Male'),('cv-2773','Female'),('cv-4920','Female'),
  ('cv-3316','Female'),('cv-1722','Female'),('cv-3172','Male'),('cv-4484','Male'),
  ('cv-3602','Male'),('cv-2384','Male'),('cv-2650','Male'),('cv-3401','Male'),
  ('cv-4555','Female'),('cv-3445','Female'),('cv-4459','Male'),('cv-2439','Female'),
  ('cv-1739','Male'),('cv-2054','Male'),('cv-2356','Female'),('cv-3554','Male'),
  ('cv-2648','Female'),('cv-3124','Male'),('cv-3603','Female'),('cv-2635','Male'),
  ('cv-4653','Male'),('cv-3228','Male'),('cv-3399','Male'),('cv-2608','Male'),
  ('cv-3423','Female'),('cv-3716','Female'),('cv-3513','Male'),('cv-1677','Female'),
  ('cv-3189','Female'),('cv-2716','Male'),('cv-2215','Male'),('cv-4552','Male'),
  ('cv-3628','Female'),('cv-2868','Female'),('cv-4567','Male'),('cv-2926','Male'),
  ('cv-4917','Female'),('cv-4337','Female'),('cv-4799','Male'),('cv-3162','Male'),
  ('cv-2796','Female'),('cv-3558','Male'),('cv-3298','Male'),('cv-4281','Male'),
  ('cv-3511','Male'),('cv-4916','Male'),('cv-3512','Male'),('cv-3534','Male')
) as v(id, gender)
where h.id = v.id and h.gender is null;

update heroes set alignment = 'good' where alignment is null and id in ('cv-2936','cv-1691','cv-2840','cv-2151','cv-3200','cv-1489');
update heroes set alignment = 'bad' where alignment is null and id in ('cv-3718','cv-4684');
update heroes set alignment = 'neutral' where alignment is null and id in ('cv-4916');
