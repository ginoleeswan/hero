import { useState, useEffect, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  getProfile,
  upsertProfile,
  uploadAvatar,
  uploadCover,
  type UserProfile,
} from '../lib/db/profiles';

interface UseProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  avatarUploading: boolean;
  coverUploading: boolean;
  error: string | null;
  pickAndUploadAvatar: () => Promise<void>;
  pickAndUploadCover: () => Promise<void>;
}

export function useProfile(userId: string | undefined): UseProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    getProfile(userId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  const pickAndUploadAvatar = useCallback(async () => {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const prev = profile?.avatar_url ?? null;
    setProfile((p) => p ? { ...p, avatar_url: uri } : p);
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(userId, uri);
      await upsertProfile(userId, { avatar_url: url });
      setProfile((p) => p ? { ...p, avatar_url: url } : p);
    } catch {
      setProfile((p) => p ? { ...p, avatar_url: prev } : p);
      setError('Failed to upload photo. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setAvatarUploading(false);
    }
  }, [userId, profile]);

  const pickAndUploadCover = useCallback(async () => {
    if (!userId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const prev = profile?.cover_url ?? null;
    setProfile((p) => p ? { ...p, cover_url: uri } : p);
    setCoverUploading(true);
    try {
      const url = await uploadCover(userId, uri);
      await upsertProfile(userId, { cover_url: url });
      setProfile((p) => p ? { ...p, cover_url: url } : p);
    } catch {
      setProfile((p) => p ? { ...p, cover_url: prev } : p);
      setError('Failed to upload cover. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setCoverUploading(false);
    }
  }, [userId, profile]);

  return { profile, loading, avatarUploading, coverUploading, error, pickAndUploadAvatar, pickAndUploadCover };
}
