---
category: Stats
---

Horizontal labelled stat bar — an uppercase label, a numeric value tinted with `color`, and a proportional fill track. `value` is parsed as an integer and clamped to 0–100 for the fill width. Use one per attribute (Strength, Intelligence, Speed…), tinting each with a `COLORS` hue.

```tsx
<StatBar label="Strength" value="83" color="#E77333" />
```
