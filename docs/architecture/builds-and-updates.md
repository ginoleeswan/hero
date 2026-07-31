# Builds & OTA updates

> How a Mythique binary gets on a device, and how new JavaScript reaches a
> binary that's already there. Read this before touching `eas.json`, the
> `updates` / `runtimeVersion` block in `app.config.ts`, or the EAS Update
> workflow.

## Mental model

There are two independent things, and conflating them is the usual source of
confusion:

- **A build** is native. It's compiled by EAS, installed once, and contains the
  native runtime — every library with native code, the config plugins, the
  icon, the bundle identifier. Changing any of those requires a new build.
- **An update** is just JavaScript (plus assets). `eas update` bundles the app's
  JS and publishes it to EAS; an installed build downloads it and runs it
  instead of the JS it shipped with. No reinstall, no store review.

The dev build (`Mythique (Dev)`, bundle id `com.ginoswanepoel.mythique.dev`) is
an `expo-dev-client` build. Its launcher can load JS from three places: a local
`yarn start` dev server, a bundled fallback, or **any EAS Update compatible with
it** — that last one is the Updates tab, and it's what makes a version openable
without your laptop being on the same Wi-Fi.

## The wiring

| Piece | Where | Value |
| --- | --- | --- |
| Update endpoint | `app.config.ts` → `updates.url` | `https://u.expo.dev/129c7437-…` |
| Project id | `app.config.ts` → `extra.eas.projectId` | same id |
| Runtime version | `app.config.ts` → `runtimeVersion.policy` | `appVersion` — currently `1.0.0` |
| Build profiles | `eas.json` → `build.*` | `development`, `development:simulator`, `preview`, `production` |
| Publish lane (CI) | `.github/workflows/eas-update.yml` | dev variant → EAS branch `development` |
| Publish lane (local) | `yarn update:dev` | same, from your working tree |

**Branches vs channels.** An update is published to an EAS *branch*. A build
subscribes to a *channel*, and a channel points at a branch. Store builds only
ever see their channel's branch, which is what makes releases safe:

| Profile | Channel | Who follows it |
| --- | --- | --- |
| `development` / `development:simulator` | `development` | dev builds |
| `preview` | `preview` | internal testers |
| `production` | `default` | App Store installs |

The dev launcher's Updates tab is the exception: it lists the project's updates
directly, filtered by runtime compatibility rather than by channel. That's why
you can open a feature branch's update from a dev build that was never built
against it.

## Opening a version on the dev build

1. Publish one — either push to `main` (CI does it), or run the **EAS Update
   (dev)** workflow from the Actions tab against any branch, or run
   `yarn update:dev` locally.
2. Open **Mythique (Dev)** → **Updates** tab.
3. Make sure you're signed into the Expo account that owns the project (the
   avatar top-right) — the list is empty when signed out.
4. Tap the entry. The build downloads that JS and relaunches into it.
5. To get back to normal, force-quit and reopen, or use the launcher's Home tab
   to point at a dev server again.

"No updates available" means one of: nothing has been published yet, you're
signed out, or every published update is runtime-incompatible — toggle
**Compatible only** off to tell the last case apart from the first two.

## Setup this needs (one time)

The CI lane is inert until these repository secrets exist. It self-skips with a
warning rather than failing CI red, so an unconfigured repo stays green.

| Secret | Why |
| --- | --- |
| `EXPO_TOKEN` | Auth for `eas-cli`. expo.dev → Account settings → Access tokens. |
| `EXPO_PUBLIC_SUPABASE_URL` | Inlined by Metro. Required — the job fails loudly without it. |
| `EXPO_PUBLIC_SUPABASE_KEY` | Same. |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google sign-in; optional, degrades that button. |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Same. |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional — empty means reporting off. |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | Optional — empty hides the web-push toggle. |

Locally, `yarn update:dev` picks these up from `.env.local` the same way
`yarn start` does.

## Traps

- **`EXPO_PUBLIC_*` are baked in at bundle time.** An update published without
  them installs perfectly and then can't reach Supabase — a broken version
  sitting in the launcher list looking legitimate. The workflow hard-fails on
  the two Supabase vars for exactly this reason; don't relax that check.
- **Runtime version is the app version.** With `policy: 'appVersion'`, every
  update is stamped `1.0.0` and only builds also stamped `1.0.0` can load it.
  Bump `version` in `app.config.ts` and every already-installed build stops
  seeing new updates until it's rebuilt. That's the intended safety behaviour —
  just don't be surprised by it.
- **Native changes can't ship OTA.** Adding a library with native code, editing
  a config plugin, changing the icon or bundle id, or bumping the Expo SDK all
  need `eas build`. An OTA update that assumes a native module the installed
  binary lacks will crash on launch.
- **Channels are baked in at build time.** `channel: "development"` on the dev
  profiles applies to builds made *after* that change; a dev build installed
  before it has no channel and won't auto-fetch. Opening updates manually from
  the Updates tab still works — the channel only matters for automatic delivery.
- **`development:simulator` has no `APP_VARIANT`**, so it builds with the
  production name and bundle id (`Mythique`, `com.ginoswanepoel.mythique`).
  Left as-is deliberately: adding it would change the bundle id and orphan any
  simulator build already installed.
- **Nothing publishes to `preview` or `default` automatically.** Shipping to
  channels that real installs follow is a release decision, not a push side
  effect. Do it deliberately from the CLI when the time comes.
- **`--environment` is required on SDK 55+.** `eas update` needs
  `--environment development|preview|production` to know which server-side EAS
  environment variables to load. Both the script and the workflow pass it.
- **Updates are published iOS-only, and that's load-bearing.** `android/` is a
  committed prebuild (custom icon, splash, env-var `applicationId`), which makes
  this a *bare* project for Android — and bare projects can't use
  `runtimeVersion` policies. `eas update` resolves a runtime version for every
  targeted platform, so an unscoped publish dies with `You're currently using
  the bare workflow, where runtime version policies are not supported`, after
  bundling and uploading. `--platform ios` sidesteps it: iOS has no tracked
  `ios/` dir, so it stays managed and `appVersion` resolves normally. Nothing is
  lost today — there has never been an Android EAS build, and
  `android/app/src/main/AndroidManifest.xml` carries no `expo-updates`
  meta-data, so no Android binary could consume an update anyway. **The day
  Android ships**, drop `--platform ios` and replace the policy with a literal
  string (`runtimeVersion: '1.0.0'`) in `app.config.ts`, bumped by hand from
  then on — or stop tracking `android/` and let prebuild regenerate it.

## History

No prior design spec — the update lane was wired up directly. `eas.json` and
the `updates` block in `app.config.ts` predate it; only the `development`
channel, `yarn update:dev`, and the workflow are new.
