# Auth returnTo — preserve location through sign-in

**Status:** spec, ready to execute
**Priority:** 3 of 4 in the 2026-07-15 hardening batch (see `2026-07-15-hardening-execution-plan.md`)
**Size:** small (1 PR)

## Problem

A logged-out user who taps an auth-gated action (vote on a team battle, post a
take, contribute, report) is `router.push`ed to `/(auth)/login` — and after
signing in lands on `/explore`. The character/matchup they were on and the
action they intended are both lost.

The redirect to `/explore` is hardcoded in **three** places:

1. `app/(auth)/login.tsx:64` — `router.replace('/explore')` after email sign-in
2. `app/(auth)/login.web.tsx:58` — same, web
3. `app/_layout.tsx:66` — the **AuthGate**: when `user && segments[0] === '(auth)'`
   (or native root), it `router.replace('/explore')`

Web OAuth is the only path that returns correctly today, via
`redirectTo: window.location.href` in `useAuth.ts:139-149/170-180` — but even
that captures the *login page's* URL, not the origin page, so it only works if
the login URL itself carries the origin (which this spec makes true).

## The critical gotcha (why the naive fix fails)

You cannot just change the login handlers to `router.replace(target)`. The
AuthGate effect (`app/_layout.tsx:57-73`, deps `[user, loading, segments, router]`)
fires when `user` flips truthy **while the user is still on the `(auth)` screen**
— `segments[0] === '(auth)'` is still true at that instant — so the gate's own
`router.replace('/explore')` races and clobbers the intended target.

**The fix must go through the gate:** the AuthGate itself must honor `returnTo`.
This also makes OAuth work for free — OAuth never navigates from the login
screen (native: ID-token flow + `onAuthStateChange`; web: full-page redirect
back to the login URL), so the AuthGate is the *only* component positioned to
redirect after OAuth, and it must know the target.

## Design

A `returnTo` query param on the login route, sanitized before use.

```
/(auth)/login?returnTo=%2Fversus%2Fteam%2Fabc123
```

### New module: `src/lib/loginRedirect.ts`

```ts
import type { Href } from 'expo-router';

/**
 * Validates a raw returnTo param into a safe internal path, or null.
 * Rejects anything that isn't a same-app absolute path: external URLs,
 * protocol-relative ('//evil.com'), auth-group paths (redirect loops),
 * and the root ('/' is the landing page — an authed user belongs on /explore).
 */
export function sanitizeReturnTo(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || typeof v !== 'string') return null;
  if (!v.startsWith('/') || v.startsWith('//')) return null;
  if (v === '/' || v.startsWith('/(auth)')) return null;
  return v;
}

/** Href for the login screen, carrying the page to return to after sign-in. */
export function loginHref(returnTo?: string | null): Href {
  const clean = sanitizeReturnTo(returnTo ?? undefined);
  return clean
    ? { pathname: '/(auth)/login', params: { returnTo: clean } }
    : '/(auth)/login';
}
```

(Match house style: TypeScript, no `any`; keep the comment tone.)

### Change 1 — AuthGate honors returnTo (`app/_layout.tsx:57-73`)

In `AuthGate`, read the param with `useGlobalSearchParams()` (global, not local
— AuthGate is not the route component) and use it as the redirect target:

```ts
const params = useGlobalSearchParams<{ returnTo?: string | string[] }>();
// inside the effect:
if (user && (inAuthGroup || atRoot)) {
  router.replace(sanitizeReturnTo(params.returnTo) ?? '/explore');
}
```

Add `params.returnTo` to the effect deps. **Do not** change any other gate
logic (the `settled` mechanism, loading guard, native `atRoot` all stay).

Check whether `app/_layout.web.tsx` has its own gate with the same hardcoded
`/explore` — if so, apply the identical change there.

### Change 2 — login email handlers (`login.tsx:56-66`, `login.web.tsx:49-60`)

```ts
const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
// on success:
router.replace(sanitizeReturnTo(returnTo) ?? '/explore');
```

Belt-and-braces with Change 1 (whichever fires first wins; both compute the
same target). "Browse without signing in" (`login.tsx:230`) stays `/explore`.

### Change 3 — thread returnTo through the auth group's internal links

- login ↔ signup switch links (`login` bottom row, `signup.tsx:127/260`,
  `signup.web.tsx:73/201`): pass the current `returnTo` param along so the
  param survives switching forms. Signup itself does **not** redirect (it parks
  on the email-confirmation card — `signup.tsx:63`); if the user then goes
  "Back to Sign In", the param is still there. That's the graceful degradation:
  a confirmation-link round-trip through the user's inbox does not preserve
  returnTo, and that's acceptable (non-goal).
- forgot-password links: pass it through the same way only if trivially easy;
  otherwise skip (out of scope).

### Change 4 — the 13 gate call sites pass their location

Each caller adds `usePathname()` (from `expo-router`) and replaces
`router.push('/(auth)/login')` with `router.push(loginHref(pathname))`:

| Site | Action |
| --- | --- |
| `app/character/[id].tsx:1685`, `:1705` | Contribute / Report |
| `app/character/[id].web.tsx:2394`, `:2408` | Contribute / Report |
| `app/versus/team/[battleId].tsx:21`, `.web.tsx:20` | Team-battle vote |
| `src/components/takes/TakesSection.tsx:179` (`goToLogin`, used at `:182/:271/:292`) | Take submit / CTA / report |
| `app/(tabs)/explore.web.tsx:1505` | Favourites invite |
| `app/(tabs)/profile.tsx:225`, `profile.web.tsx:100` | Guest profile sign-in |
| `src/components/web/TopBar.tsx:393` | Top-bar sign-in |
| `src/components/landing/LandingPage.dom.tsx:2771` | Landing sign-in — pathname is `/`, which `sanitizeReturnTo` rejects → plain `/(auth)/login`. Correct; leave it using `loginHref(pathname)` anyway for uniformity. |

Line numbers are as of commit `d4b653e4` — re-locate by grepping
`(auth)/login` if drifted.

### Why web OAuth now works end-to-end

The user is on `/login?returnTo=%2Fversus%2Fteam%2Fabc` when they tap Google.
`useAuth` sends `redirectTo: window.location.href` — which now *includes* the
returnTo param. After the OAuth round-trip the browser lands back on that same
login URL with a session; the AuthGate fires (`user && inAuthGroup`) and
replaces to the sanitized returnTo. No changes to `useAuth.ts` needed.

## Non-goals

- **Intent resume** (auto-reopening the contribute sheet / re-casting the vote
  after login). Location-only. An `intent` param can layer on later.
- Preserving returnTo across the signup email-confirmation round-trip.
- Any visual change. The login/signup screens change zero pixels.

## Tests

New `__tests__/lib/loginRedirect.test.ts` (pure logic — no mocks needed):

- accepts `/character/123`, `/versus/team/abc?x=y`
- rejects: `undefined`, `''`, `https://evil.com`, `//evil.com`, `/`,
  `/(auth)/login`, array input takes first element
- `loginHref(null)` → `'/(auth)/login'`; `loginHref('/character/9')` → object
  with params

## Acceptance criteria

1. Logged out, on `/versus/team/<id>`, tap vote → login screen → email sign-in
   → back on `/versus/team/<id>`.
2. Same flow via Google OAuth on web → back on the team battle page.
3. Sign in from the top bar while browsing `/character/123` → return to it.
4. Sign in with no returnTo (direct visit to /login) → `/explore` (unchanged).
5. `yarn test:ci` green; `npx tsc --noEmit` clean.
6. A crafted `/login?returnTo=https://evil.com` (or `//evil.com`) lands on
   `/explore`, never off-site.
