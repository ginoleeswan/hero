import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { touchLastSeen } from '../lib/db/presence';

// How often to re-stamp last_seen_at while the app is foregrounded. 60s keeps
// the "online now" window (5 min, server-side) comfortably fresh without chatty
// writes.
const HEARTBEAT_MS = 60_000;

/**
 * Keeps the signed-in user's presence fresh: an immediate beat on sign-in, then
 * every 60s, plus one whenever the app/tab returns to the foreground. No-op when
 * logged out (the RPC is anon-rejected anyway). Mount once, app-wide.
 */
export function usePresenceHeartbeat(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let active = true;
    const beat = () => {
      if (active) void touchLastSeen();
    };

    beat(); // stamp immediately on mount / sign-in
    const interval = setInterval(beat, HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') beat();
    });

    return () => {
      active = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [user]);
}
