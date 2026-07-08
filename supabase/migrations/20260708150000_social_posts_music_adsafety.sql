-- Music suggestion + ad-safety flag for the social posting queue.
-- guide_music: suggested audio direction for IG/TikTok (text, per-post).
-- ad_safety: 'organic' (default — organic-only, never boost as a paid ad)
--            or 'ad_safe' (produced by the tier-checked ads pipeline; boostable).
alter table social_posts
  add column if not exists guide_music text,
  add column if not exists ad_safety text not null default 'organic';
