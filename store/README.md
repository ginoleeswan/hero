# store/

Everything for the App Store listing. Two directories, and the difference
between them is the whole point.

| Path                | In git | What it is                                                          |
| ------------------- | ------ | ------------------------------------------------------------------- |
| `captures/`         | yes    | Raw simulator screenshots, driven by hand. **Source.**              |
| `screenshots/`      | no     | Branded App Store frames, generated from `captures/`. **Output.**   |
| `metadata.md`       | yes    | The listing copy, with Apple's field limits enforced.               |

## Why `screenshots/` is not committed

It is derived, and 25 MB of derived PNG is not worth versioning. Regenerating
was measured rather than assumed: 5 of 8 files came back byte-identical and
the other 3 differed by a **maximum of 1/255 on a single channel** — PNG and
antialiasing rounding, invisible at any size.

`captures/` stays in git precisely because it is NOT reproducible. Each one is
a simulator driven to a specific screen, in a specific scroll position, with
the dev-client's own chrome kept out of frame. Losing those means redoing that
work; losing `screenshots/` means running one command.

## Regenerate

```sh
node scripts/social/store-screens.mjs
```

Both device sets, straight from `captures/`. Add `--device ipad13` or
`--device iphone69` to do one.

Output sizes are Apple's exact slots — iPhone 6.9" at 1320x2868 and iPad 13"
at 2064x2752 — and the script refuses to write a frame whose headline wraps
past the lines its device declares, because that would put the gold seam
through the type.

## Check the copy before pasting it

```sh
yarn check:store-copy
```

Counts every field in `metadata.md` against Apple's limit the way Apple counts
it, and rejects em dashes. Both rules were added after they caught real
problems: promotional text at 172 against a 170 ceiling, and six em dashes in
the first description draft.

## New captures

Drive the simulator to the screen, then save the PNG over the matching file in
`captures/<device>/`. Names are matched by `SLOTS` in the generator
(`arena`, `explore`, `character`, `rightnow`).

Two things will get a build rejected or look broken, and both have happened:

- **The dev client's blue "Refreshing…" banner.** It reappears on every JS
  reload. Take the shot after it clears.
- **Anything that is not the app**, including the expo-dev-client launcher
  gear. App Review requires screenshots to depict the real app.
