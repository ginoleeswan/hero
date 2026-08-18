// app/(auth)/signup.tsx — a redirect, deliberately.
//
// NATIVE auth is one screen: /(auth)/login asks for the email first and routes
// to sign-in or account-creation from what the database says about it, so a
// separate signup form has nothing left to do. This file survives only
// because routes elsewhere still point at it (old links, the web pair's
// switcher) — it forwards them, preserving returnTo.
//
// The WEB pair (signup.web.tsx) keeps its own two-page flow; Metro resolves
// by platform extension, so this redirect never runs there.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { loginHref } from '../../src/lib/loginRedirect';

export default function SignupRedirect() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  return <Redirect href={loginHref(returnTo)} />;
}
