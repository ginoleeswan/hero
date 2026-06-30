# design-sync NOTES — Mythique (pilot)

This repo is an **Expo / React Native app**, not a conventional design-system package.
The sync is therefore **off-script**: it presents a synthetic package to the
converter whose `dist` is a hand-built `react-native-web` bundle of a curated
12-component pilot. Read this before any re-sync.

## What's synced (the pilot, 12 components)

StatBar · VsBadge · SocialDivider · HeroLogo · LightningBolt · DotGrid ·
PaperSurface · GettingStartedCard · HeroImage · ThumbCard · SkeletonBlock · FilterChips

Project: **Mythique** — https://claude.ai/design/p/ec412569-6e7f-4aec-ad37-2da330de4982
Global: `window.Mythique`. All components scoped to Tier-A (prop-driven, low data/native coupling).

## The off-script pipeline (how a re-sync rebuilds)

1. **Pre-bundle the dist** (the converter cannot bundle `react-native` itself):
   ```sh
   ln -sfn ../.ds-sync/node_modules .design-sync/node_modules   # once per clone (fork symlink, gitignored)
   node .design-sync/build/build-dist.mjs                        # → .ds-pkg/dist/index.mjs
   ```
   `build-dist.mjs` + `dist-entry.tsx` (committed under `.design-sync/build/`) are
   the real source of the bundle: esbuild with `react-native`→`react-native-web`
   alias, `react`/`react-dom` external (converter shims them), `.web.*` resolve
   order + `browser` mainFields, `.js`→`jsx` loader (for `@expo/vector-icons`),
   ttf/png as dataurl. Two banners/footers matter:
   - **banner**: polyfills `global` and `process` (RNW/expo read them at runtime).
   - **footer**: renames RNW's injected `<style id="react-native-stylesheet">`
     to `id="mythique-rn-stylesheet"`. Without this the preview harness's
     `[id^="r"]` root selector matches that empty `<style>` first and reports
     EVERY component as "root empty". Do not remove it.
2. **The synthetic package** lives at `.ds-pkg/` (gitignored): `package.json`
   (name `mythique-ds`, `module: dist/index.mjs`), `dist/index.mjs` (step 1),
   and `fonts/` (5 ttf + `mythique-fonts.css`).
3. **Run the converter**:
   ```sh
   node .ds-sync/package-build.mjs --config .design-sync/config.json \
     --node-modules ./node_modules --entry ./.ds-pkg/dist/index.mjs --out ./ds-bundle
   node .ds-sync/package-validate.mjs ./ds-bundle
   ```
   Component list comes from `cfg.componentSrcMap` (no `.d.ts` in the synthetic
   pkg → discovery would be empty otherwise); props from `cfg.dtsPropsFor`;
   groups + per-component docs from `cfg.docsDir` (`.design-sync/docs/<Name>.md`,
   `category:` frontmatter sets the group — works only because no `srcDir` is set,
   so all groups default to `general` and the doc category takes precedence).

## Toolchain pins

- **playwright 1.58.0** (installed in `.ds-sync/node_modules`) pins **chromium-1208**,
  which is in the machine cache (`~/Library/Caches/ms-playwright/`). A different
  cache build needs a matching playwright version (see base SKILL §4.1).

## Known render warns (triaged, not new)

- `[CSS_RUNTIME]` — expected. The bundle is self-styling (RNW injects CSS at
  runtime); `styles.css` only `@import`s `fonts/fonts.css`. Not a failure.

## Per-component preview gotchas

- **HeroImage / ThumbCard**: previews use **non-numeric** ids (`demo-warden`…).
  Numeric ids make `heroImageSource` build a CDN URL (`<CDN>/<id>.jpg`); expo-image
  then retries the 404 and `networkidle` never settles → validate timeout. Keep
  ids non-numeric so the monogram fallback renders with zero network.
- **PaperSurface / WithLip**: give the surface an explicit `height` (not `flex:1`)
  inside the dark wrapper, or the paper collapses and the dark bg bleeds through.
- **cardMode: column** is set in `cfg.overrides` for StatBar, SocialDivider,
  SkeletonBlock, GettingStartedCard (they render wider than a grid cell).
- Previews use plain `<div>` for layout wrappers — NOT `react-native`'s `View`
  (a preview `import 'react-native'` would resolve to the native package and break).

## Re-sync risks (what can silently go stale)

- **The dist is a frozen snapshot.** Editing any of the 12 source components in
  `src/` does NOT update the sync until `build-dist.mjs` is re-run. Always
  re-run step 1 before the converter if source changed.
- **`.ds-pkg/` and `.ds-sync/` are gitignored** and regenerated; a fresh clone
  must re-stage `.ds-sync/` (copy from the skill), `npm i` its deps incl.
  `playwright@1.58`, recreate the fork symlink, and re-run `build-dist.mjs`.
- **Adding a component** = 5 edits: add the export to `dist-entry.tsx`; add it to
  `componentSrcMap` + `dtsPropsFor` in `config.json`; add `.design-sync/docs/<Name>.md`
  (with `category:`); add `.design-sync/previews/<Name>.tsx`. Then rebuild dist + converter.
- **Props in `dtsPropsFor` are hand-transcribed** from source interfaces — they
  can drift from the real component API. Re-check against `src/` on a re-sync.
- Components beyond this pilot that touch `lib/db`/`expo-router`/`react-query`
  were intentionally excluded (they need data/provider isolation). Expanding the
  scope means handling that coupling (providers/fixtures), not just adding exports.
