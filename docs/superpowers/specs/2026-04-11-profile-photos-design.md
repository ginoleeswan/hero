# Profile Photos & Google Profile Sync Design

**Date:** 2026-04-11  
**Status:** Approved

## Overview

Two connected features:
1. On Google sign-in, automatically populate the user's display name and profile photo from their Google account
2. Let users upload their own profile picture and cover photo inline on the profile screen

## Data Model

### Migration

Add two nullable columns to `user_profiles`:

```sql
ALTER TABLE user_profiles
  ADD COLUMN avatar_url TEXT,
  ADD COLUMN cover_url  TEXT;
```

- `avatar_url` — either a Supabase Storage public URL (user-uploaded) or a Google CDN URL (auto-synced). Once the user uploads their own photo, Google's URL stops overwriting it.
- `cover_url` — Supabase Storage public URL only (no Google equivalent)

### Supabase Storage

One bucket: `user-media`, public read, authenticated write only.

File paths:
- `{userId}/avatar` — profile photo
- `{userId}/cover` — cover photo

Files are upserted (overwritten) on each upload so paths stay stable and no cleanup is needed.

### Google sync rule

On Google sign-in, upsert `user_profiles` with:
- `display_name` from `user.user_metadata.full_name`
- `avatar_url` from `user.user_metadata.avatar_url` — **only if `avatar_url` is not already a Supabase Storage URL** (detected by checking whether the current value contains the Supabase project hostname). This ensures a user-uploaded photo is never overwritten by a re-login.

## Architecture

### New package

- `expo-image-picker` — installed via `yarn expo install expo-image-picker`

### Migration file

`supabase/migrations/YYYYMMDDHHMMSS_add_profile_media.sql` — adds `avatar_url` and `cover_url` columns and creates the `user-media` Storage bucket with appropriate RLS policies.

### `src/lib/db/profiles.ts` (new)

Follows existing `src/lib/db/` conventions. Exports:

- `getProfile(userId: string)` — fetch the `user_profiles` row
- `upsertProfile(userId: string, data: Partial<{ display_name, avatar_url, cover_url }>)` — upsert the row
- `uploadAvatar(userId: string, localUri: string): Promise<string>` — upload file to `user-media/{userId}/avatar`, return the public URL
- `uploadCover(userId: string, localUri: string): Promise<string>` — upload file to `user-media/{userId}/cover`, return public URL

### `src/hooks/useProfile.ts` (new)

Loads and manages the profile row for the current user. Exposes:

```ts
{
  profile: UserProfile | null;
  loading: boolean;
  pickAndUploadAvatar: () => Promise<void>;
  pickAndUploadCover: () => Promise<void>;
}
```

Internally:
1. Calls `getProfile(userId)` on mount
2. `pickAndUploadAvatar` — opens image picker (square crop hint, library only), optimistically updates local state, calls `uploadAvatar`, then `upsertProfile` with the returned URL. On error, reverts and sets error state.
3. `pickAndUploadCover` — same flow for cover, landscape aspect hint.

### `src/hooks/useAuth.ts` (update)

After a successful `signInWithGoogle`, call `syncGoogleProfile(user)`:

```ts
async function syncGoogleProfile(user: User) {
  const meta = user.user_metadata;
  const existing = await getProfile(user.id);
  const isStorageUrl = existing?.avatar_url?.includes(supabaseHost);
  await upsertProfile(user.id, {
    display_name: meta.full_name ?? existing?.display_name,
    avatar_url: isStorageUrl ? existing.avatar_url : (meta.avatar_url ?? existing?.avatar_url),
  });
}
```

### `app/(tabs)/profile.tsx` (update)

Replace current hardcoded cover + initials avatar with data from `useProfile`:

**Cover area:**
- If `cover_url` set: `expo-image` fills the cover `View`, `contentFit="cover"`
- If not set: existing navy gradient fallback
- "Edit cover" pill button — bottom-left, above the avatar overlap zone
- While `coverUploading`: subtle dark overlay + `ActivityIndicator` centred on cover

**Avatar:**
- If `avatar_url` set: `expo-image` in the existing circle, `contentFit="cover"`
- If not set: existing initials gradient fallback
- Camera icon badge — 26×26, orange background, bottom-right of avatar circle
- Tapping avatar (or badge) triggers `pickAndUploadAvatar`
- While `avatarUploading`: `ActivityIndicator` replaces avatar content

**Display name:**
- Use `profile.display_name` if set, fall back to email prefix

**Error handling:**
- A single `errorMsg` string state — shown in the existing `errorBox` style if set, auto-clears after 3 seconds

## Profile Screen Layout (cover area)

```
┌─────────────────────────────────┐
│  [cover image or navy gradient] │  ← tappable via "Edit cover" pill
│                                 │
│ [Edit cover ✎]                  │  ← bottom-left pill, 12px from edge
└────────────┬────────────────────┘
             │ avatar overlaps bottom of cover (-45pt margin)
         [avatar]  ← camera badge bottom-right
```

## Out of Scope

- Display name editing (separate feature)
- Image cropping UI (expo-image-picker's built-in crop is sufficient)
- Video cover photos
- Removing/resetting photos to default (can be added later)
