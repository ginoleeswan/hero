// Bridges the command-center's alert list up to the global web TopBar, so the
// notification bell can live in the nav instead of a second header band. The
// admin health screen publishes its alerts here on mount (and clears them on
// unmount); the TopBar renders the bell from this context. Empty everywhere
// else, so the bell only ever appears on the command center.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { type Alert } from '../components/admin/health/AlertStack';

interface CommandAlertsValue {
  alerts: Alert[];
  setAlerts: (a: Alert[]) => void;
}

const CommandAlertsContext = createContext<CommandAlertsValue>({
  alerts: [],
  setAlerts: () => {},
});

export function CommandAlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // setAlerts is stable (useState); only `alerts` drives a re-render.
  const value = useMemo(() => ({ alerts, setAlerts }), [alerts]);
  return <CommandAlertsContext.Provider value={value}>{children}</CommandAlertsContext.Provider>;
}

export const useCommandAlerts = () => useContext(CommandAlertsContext);
