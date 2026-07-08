-- Reels + filterable library support for the social posting queue.
-- media_type: 'image' (default; carousels/stills) | 'video' (reels — image_url
-- holds the poster frame, video_url the MP4).
-- angle: content angle for the Publish tab's filter chips
-- ('matchup'|'ranking'|'guess'|'fact'|null for legacy rows).
alter table social_posts
  add column if not exists media_type text not null default 'image',
  add column if not exists video_url text,
  add column if not exists angle text;
