import { Redirect } from 'expo-router';

// The catalog-health admin dashboard is a web-only tool (see health.web.tsx).
// On native, bounce to the main app.
export default function AdminHealthNative() {
  return <Redirect href="/(tabs)/explore" />;
}
