// app/(tabs)/search/_layout.web.tsx — web override. The native layout keeps a
// header (iOS search-bar chrome); on web the screen owns its own header, so hide
// the default react-navigation header entirely (it was the stray white back bar).
import { Stack } from 'expo-router';

export default function SearchLayoutWeb() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
