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
   `yarn update:dev` locally. The Actions-tab route only exists once
   `eas-update.yml` has landed on `main` — see the trap below.
2. Open **Mythique (Dev)** → **Updates** tab.
3. Make sure you're signed into the Expo account that owns the project (the
   avatar top-right) — the list is empty when signed out.
4. Tap the entry. The build downloads that JS and relaunches into it.
5. To get back to normal, force-quit and reopen, or use the launcher's Home tab
   to point at a dev server again.

"No updates available" means one of: nothing has been published yet, you're
signed out, or every published update is runtime-incompatible — toggle
**Compatible only** off to tell the last case apart from the first two.

## How an update actually reaches a running app

The launcher route above is the manual one. For a build that follows a channel,
delivery is automatic — but not as immediate as people expect, which is why
`src/hooks/useOtaUpdate.ts` exists.

Out of the box, expo-updates checks **once, at launch**, downloads in the
background, and applies what it downloaded on the **next** launch. So an update
published while someone has the app open reaches them two cold starts later,
with nothing on screen to say so. Before this hook, nothing in the app called
any expo-updates API at all.

The hook adds the two missing halves:

- **Re-check on foreground**, throttled to once a minute — otherwise a session
  that stays alive for days never learns about anything published after it
  started, and an unthrottled version would hit the manifest endpoint every time
  the user flicked back from Messages.
- **Offer the restart instead of taking it.** `UpdateReadyPill` shows "New
  version — restart" and waits. The expo-updates docs example calls
  `reloadAsync()` the moment `isUpdatePending` flips; doing that restarts the
  app under whatever the user was in the middle of, which reads as a crash.

`Updates.isEnabled` is false in Expo Go and when running off a dev server, so
the prompt can't appear in either — it only means something in an installed
build. There's no web equivalent, so the pill is mounted in `app/_layout.tsx`
only and deliberately absent from `_layout.web.tsx`.

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

**Repository secrets are not what ends up in the bundle.** Because both lanes
pass `--environment development`, the values Metro inlines come from the
**EAS environment** of that name, not from `.env.local` and not from the GitHub
secrets above. `.env.local` is gitignored, so it never reaches CI — and it does
not reach an `--environment` publish either, even locally. The GitHub secrets
remain useful as the workflow's fail-fast gate; they are not the source.

So the *actual* requirement is that the `development` EAS environment is
populated:

```sh
eas env:list --environment development
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value '…' \
  --environment development --visibility plaintext --type string --scope project
```

`eas env:set` upserts, so there is no `--force` flag. Use `plaintext` for the
Supabase URL and `sensitive` for the keys, mirroring `production`.

## Traps

- **`EXPO_PUBLIC_*` are baked in at bundle time.** An update published without
  them installs perfectly and then can't reach Supabase — a broken version
  sitting in the launcher list looking legitimate. The workflow hard-fails on
  the two Supabase vars for exactly this reason; don't relax that check. But
  note what that check actually proves: only that the *GitHub secrets* exist,
  not that the bundle got them. See the next trap.
- **Only `production` had EAS environment variables — this bit once.** The first
  updates published fine and then threw `supabaseUrl is required` on launch,
  because `eas env:list --environment development` was empty while `production`
  had the full set (which is why store builds were unaffected). `development` is
  populated now; **`preview` is still empty**, so the first publish to it will
  fail the same way. Verify a bundle rather than trusting the publish succeeded:

  ```sh
  grep -a -o -E 'https://[a-z0-9]{15,}\.supabase\.co' dist/_expo/static/js/ios/*.hbc
  ```

  One hit means it's inlined; no hits means you just shipped a broken version.
  Beware a bare `grep supabase.co` — the bundle's string table contains an
  unrelated `*.supabase.content_typeof` fragment that matches it.
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
- **Declaring a channel in `eas.json` does not create it.** The channel object
  only comes into being when a build using it runs, or when you create it by
  hand. Until then the manifest endpoint 404s for that channel —
  `There is no channel named development for the app with ID …` — even though
  updates are published and the branch exists. `default` was the only channel
  here for a while for exactly this reason. Fixed once with:

  ```sh
  eas channel:create development   # auto-links to the same-named branch
  ```

  Check with `eas channel:list`, which also shows which branch each points at.
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
- **`workflow_dispatch` needs the file on the default branch.** GitHub only
  registers a manually-dispatchable workflow from `main`; until `eas-update.yml`
  is merged there, the workflow doesn't exist as far as the API is concerned —
  `gh workflow run eas-update.yml --ref some-branch` returns `HTTP 404: workflow
  eas-update.yml not found on the default branch`, and no Run-workflow button
  appears. Once it's on `main`, dispatching it against *any* ref works as
  described above. Until then, `yarn update:dev` is the only way to publish.
- **Sentry's source-map upload runs inside the Xcode build, and it is not
  configured.** `'@sentry/react-native/expo'` is declared in `app.config.ts`
  with no options, so the generated `sentry.properties` carries no org — and no
  `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` exists in any EAS
  environment. The build dies in **Run fastlane** with `An organization ID or
  slug is required (provide with --org)`. This sat undetected because Sentry
  landed after the last successful build; the first build to run it was the
  first to fail on it. The dev profiles now set
  `SENTRY_DISABLE_AUTO_UPLOAD=true` — a dev build has no use for uploaded source
  maps, and runtime reporting is unaffected (that's driven by
  `EXPO_PUBLIC_SENTRY_DSN`, which is also unset, so the SDK no-ops). **`preview`
  and `production` are still broken**: don't disable the upload there — it's the
  whole point of shipping Sentry — populate the three `SENTRY_*` variables in
  those environments, or pass `organization`/`project` to the plugin.
- **Don't let the EAS builder pick its own yarn.** The `eas-build-pre-install`
  script in `package.json` used to be `corepack enable && yarn set version 4`,
  and `set version 4` means *latest 4.x*. The day Yarn 4.18.0 shipped, every
  build started dying in **Install dependencies** with `YN0028: The lockfile
  would have been modified by this install, which is explicitly forbidden` — a
  green repo breaking on an upstream release, with no commit to blame. The diff
  it printed was only builtin-patch hashes (`resolve@patch:…&hash=c3c19d` →
  `&hash=9bd1a5`), which is the tell: those are derived from the Yarn version,
  so a hash-only lockfile diff means the wrong Yarn is running, not a stale
  lockfile. The hook is now just `corepack enable`; corepack reads
  `packageManager: "yarn@4.15.0"` and provisions exactly that, matching
  `.yarnrc.yml`'s tracked `yarnPath`. Never reintroduce a floating `set version`
  — pin bumps belong in `packageManager` with a regenerated lockfile.
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
