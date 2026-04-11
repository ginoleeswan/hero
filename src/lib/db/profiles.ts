import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../supabase';

export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string | null;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data ?? null;
}

export async function upsertProfile(
  userId: string,
  data: Partial<Pick<UserProfile, 'display_name' | 'avatar_url' | 'cover_url'>>
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id: userId, ...data }, { onConflict: 'id' });
  if (error) throw error;
}

async function uploadMedia(userId: string, localUri: string, path: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = decode(base64);
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const { error } = await supabase.storage
    .from('user-media')
    .upload(path, arrayBuffer, { contentType, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('user-media').getPublicUrl(path);
  // Bust cache by appending a timestamp
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  return uploadMedia(userId, localUri, `${userId}/avatar`);
}

export async function uploadCover(userId: string, localUri: string): Promise<string> {
  return uploadMedia(userId, localUri, `${userId}/cover`);
}
