import { Stack } from 'expo-router';

export default function AuthLayout() {
  // No headers anywhere in the group. The sign-in screen draws its own back
  // control (see login.tsx): a nested Stack header was tried first and never
  // rendered — the root layout runs its own `screenOptions={{ headerShown:
  // false }}` Stack with the whole (auth) group as one screen, so the group's
  // header sits inside a container that is already headerless.
  return <Stack screenOptions={{ headerShown: false }} />;
}
