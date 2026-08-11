// src/hooks/useBootSignal.ts — reads the boot signal once, at launch.
//
// One local AsyncStorage read, fired on mount and never repeated: the value
// cannot change while the splash is on screen, and a splash is the last place
// that should be subscribing to anything.
//
// It resolves in a couple of milliseconds against an ambient that does not
// begin to fade in until 150ms, so in practice the light is correct before it
// is visible. `null` until then — BootStage holds the ember back rather than
// showing the fallback and swapping colour underneath the user.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dailyRecordKey, signalFrom, todayKey, type BootSignal } from '../lib/bootSignal';

export function useBootSignal(): BootSignal | null {
  const [signal, setSignal] = useState<BootSignal | null>(null);

  useEffect(() => {
    let alive = true;
    // Stamped in the effect rather than during render: reading the clock while
    // rendering is impure (react-hooks/purity), and this is the more honest
    // measurement anyway — the day the stage actually mounted.
    const dateKey = todayKey(new Date());
    AsyncStorage.getItem(dailyRecordKey(dateKey))
      .then((raw) => {
        if (alive) setSignal(signalFrom(raw, dateKey));
      })
      .catch(() => {
        // A failed read must not decide anything loudly.
        if (alive) setSignal(signalFrom('', dateKey));
      });
    return () => {
      alive = false;
    };
  }, []);

  return signal;
}
