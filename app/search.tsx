// Native fallback — search on native uses the mobile SearchSheet, not this route.
import { Redirect } from 'expo-router';

export default function SearchScreen() {
  return <Redirect href="/explore" />;
}
