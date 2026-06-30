---
category: Layout
---

A beige "printed paper" surface — a halftone ink-dot texture over the app's `beige` canvas so a zone reads as comic stock, not a flat fill. Wrap content as `children`. Pass `lip` for the rounded top edge + top-light that forms the seam below a dark stage.

```tsx
<PaperSurface lip>
  <YourContent />
</PaperSurface>
```
