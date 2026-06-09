import { Redirect } from 'expo-router';

// Native fallback — the two-slot matchup builder is a web feature. On native the
// compare flow starts from a character's "Compare" button, so send users home.
export default function PickArenaNative() {
  return <Redirect href="/explore" />;
}
