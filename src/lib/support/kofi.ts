import { Linking } from 'react-native';

/** The project's donation page. Single source of truth. */
export const KO_FI_URL = 'https://ko-fi.com/glstudio';

/** Extensible registry — adding a partner later is one entry. */
export const SUPPORT_LINKS = [{ id: 'kofi', label: 'Ko-fi', url: KO_FI_URL }] as const;

/** Open the donation page. One call site so analytics can hook in later. */
export function openKofi(): void {
  Linking.openURL(KO_FI_URL);
}
