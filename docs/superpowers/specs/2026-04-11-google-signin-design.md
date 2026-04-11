# Google Sign-In Design

**Date:** 2026-04-11  
**Status:** Approved

## Overview

Add "Continue with Google" to the login and signup screens using Supabase OAuth + `expo-web-browser`. The flow is platform-split: native uses an in-app browser session and PKCE code exchange; web uses a full-page redirect with automatic token detection.

## Architecture

### New package

- `expo-web-browser` — opens the OAuth browser session on iOS/Android via `WebBrowser.openAuthSessionAsync`

### `src/lib/supabase.ts`

Change `detectSessionInUrl` from `false` to `Platform.OS === 'web'`. On web, Supabase needs this to auto-parse the access token from the redirect URL after OAuth completes. On native it must remain `false` (we handle the code exchange manually).

### `src/hooks/useAuth.ts`

Add a new `signInWithGoogle()` method to the `AuthState` interface and implementation:

**Native path:**
1. Build redirect URL: `Linking.createURL('auth/callback')` — resolves to `hero://auth/callback` in production builds, or the correct `exp://` URL in Expo Go
2. Call `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } })`
3. Open the returned URL with `WebBrowser.openAuthSessionAsync(url, redirectTo)`
4. If `result.type === 'success'`, call `supabase.auth.exchangeCodeForSession(result.url)` to exchange the PKCE code for a session
5. Return `{ error }` — `onAuthStateChange` in the hook fires automatically, setting the user state, and `AuthGate` redirects to `/(tabs)`

**Web path:**
1. Call `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`
2. Supabase performs a full-page redirect to Google, then back to the app root
3. `detectSessionInUrl: true` auto-parses the token; `onAuthStateChange` fires; `AuthGate` redirects to `/(tabs)`

### No new routes needed

The deep link `hero://auth/callback` is intercepted by `WebBrowser.openAuthSessionAsync` before Expo Router sees it — no `auth-callback.tsx` screen required. On web, redirecting to the origin root is sufficient since `AuthGate` handles unauthenticated → `/(tabs)` routing.

## UI Components

### `src/components/ui/SocialDivider.tsx`

A horizontal rule with centred "or" label between two lines. Used on both auth screens to visually separate the email form from the social login section.

- Two `View` lines (`rgba(41,60,67,0.12)` — matches existing subtle borders)
- "or" in `Nunito_400Regular`, 12px, `COLORS.grey`, `opacity: 0.6`

### `src/components/ui/GoogleSignInButton.tsx`

A full-width pressable button rendered below `SocialDivider` on both auth screens.

- White fill, `#e0d6ca` border (matches existing input borders), `borderRadius: 12`
- Google "G" logo as an inline SVG via `react-native-svg` (already used transitively in the project) — coloured per Google brand guidelines
- "Continue with Google" in `Nunito_700Bold`, 15px, `COLORS.navy`
- `ActivityIndicator` replaces content while `loading` is true
- Accepts `onPress` and `loading` props; calls `useAuth().signInWithGoogle()` from the screen

## Screen Changes

### `app/(auth)/login.tsx` and `app/(auth)/signup.tsx`

Below the existing primary CTA button and above the "Don't have an account?" switch row, add:

```
<SocialDivider />
<GoogleSignInButton onPress={handleGoogleSignIn} loading={googleLoading} />
```

Each screen manages its own `googleLoading` boolean state, separate from the existing email `loading` state so the two flows don't interfere.

On error, the existing `error` / `errorBox` pattern is reused — `handleGoogleSignIn` sets `setError(error.message)` on failure.

## External Setup (manual steps)

These are one-time configuration steps outside the codebase that must be completed before the feature works:

1. **Google Cloud Console** — Create an OAuth 2.0 client ID (Web application type). Add authorised redirect URIs:
   - `https://<your-supabase-project>.supabase.co/auth/v1/callback`
2. **Supabase Dashboard** — Authentication → Providers → Google → enable, paste the Client ID and Client Secret from Google Cloud Console
3. **Redirect URL allowlist in Supabase** — Add `hero://` (for native production) and `exp://` (for Expo Go development) under Authentication → URL Configuration → Redirect URLs

## Error Handling

| Scenario | Behaviour |
|---|---|
| User cancels the browser (dismisses without signing in) | `result.type` is `'cancel'` — silently ignored, no error shown |
| Google auth fails (token error, network) | Error returned from `exchangeCodeForSession`, shown in `errorBox` |
| Provider not enabled in Supabase | Error from `signInWithOAuth`, shown in `errorBox` |

## Out of Scope

- Apple Sign-In
- Other OAuth providers (GitHub, Facebook)
- Native Google SDK (`@react-native-google-signin/google-signin`) — can be adopted later for a native picker UX
