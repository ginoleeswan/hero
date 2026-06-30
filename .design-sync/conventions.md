# Mythique design system — how to build with it

Mythique is a superhero/villain encyclopedia. Its components are **React Native** components compiled for the web via **react-native-web**, exposed on `window.Mythique`. They render real RN primitives in the browser — there is **no CSS class system**.

## Setup & wrapping

- No provider or theme wrapper is required for these components — import and render directly.
- Components **self-style**: react-native-web injects their styles into the document at runtime. You do not import a component stylesheet; just render the component.
- The **brand fonts ship in `styles.css`** (`@import` of `fonts/fonts.css`). Keep `styles.css` linked so headings/labels use the real faces instead of a fallback.

## The styling idiom — props & RN style objects, NOT classes

Do **not** write Tailwind/utility classes or `className` against these components — they won't resolve. Style through:

1. **Semantic props** the component exposes — colours are passed as hex strings, sizes as numbers. Examples: `<StatBar color="#E77333" />`, `<VsBadge variant="solid" size={56} />`, `<HeroLogo color="#f5ebdc" iconColor="#E77333" />`, `<DotGrid color="rgba(231,115,51,0.25)" spacing={14} />`.
2. **React Native `style` objects** (plain JS objects, never class names) for the few components that take a `style` prop (`HeroImage`, `ThumbCard`, `PaperSurface`, `SkeletonBlock`). Use RN style keys (`width`, `height`, `borderRadius`, and absolute-fill via `{ position:'absolute', top:0, left:0, right:0, bottom:0 }`).
3. For **your own layout glue around the components**, plain DOM + inline styles is fine.

### Brand palette (use these hexes)

`orange #E77333` · `navy #293C43` · `deepNavy #0b1820` · `beige #f5ebdc` (the base canvas) · `grey #A2A19B` · `red #B5302B` · `yellow #F9B222` · `green #63A936` · `blue #15A1AB` · `gold #b07d00`.

### Fonts (families that ship in `styles.css`)

`Flame-Regular` (display headings + numerals) · `FlameSans-Regular` (UI labels) · `Nunito_400Regular` / `Nunito_700Bold` (body) · `Righteous_400Regular`. Use `Flame-Regular` for display, never a fallback.

## Where the truth lives

- Each component's `components/<group>/<Name>/<Name>.d.ts` is its prop contract; the sibling `<Name>.prompt.md` shows canonical usage with a code example.
- `styles.css` and its `@import` closure (`fonts/fonts.css`) are the only styling that ships to rendered designs, plus the JS bundle's runtime-injected styles.
- Surfaces: light UI sits on `beige`; immersive/dark stages use `deepNavy`/`navy`. `PaperSurface` is the printed-paper canvas; `DotGrid` is a dark-surface texture.

## One idiomatic build snippet

```tsx
// A hero scorecard: dark stage with the wordmark, then a paper panel of stats.
<div style={{ background: '#0b1820', padding: 20 }}>
  <Mythique.HeroLogo color="#f5ebdc" iconColor="#E77333" />
  <div style={{ marginTop: 16, background: '#f5ebdc', borderRadius: 12, padding: 20 }}>
    <Mythique.StatBar label="Strength" value="83" color="#E77333" />
    <Mythique.StatBar label="Intelligence" value="64" color="#15A1AB" />
    <Mythique.StatBar label="Speed" value="91" color="#63A936" />
  </div>
</div>
```
