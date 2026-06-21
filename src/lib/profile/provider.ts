import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

/** Maps a Supabase auth provider to its Ionicons logo + display label. */
export function providerMeta(provider: string): { icon: IoniconName; label: string } {
  switch (provider) {
    case 'apple':
      return { icon: 'logo-apple', label: 'Apple' };
    case 'google':
      return { icon: 'logo-google', label: 'Google' };
    default:
      return { icon: 'mail-outline', label: provider.charAt(0).toUpperCase() + provider.slice(1) };
  }
}

/** Apple's private-relay addresses look broken shown raw — flag them. */
export function isPrivateRelayEmail(email: string): boolean {
  return email.endsWith('@privaterelay.appleid.com');
}
