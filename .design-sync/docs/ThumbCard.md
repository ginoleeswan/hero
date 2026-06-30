---
category: Cards
---

Compact tappable hero thumbnail — a portrait (via HeroImage, with monogram fallback) under a bottom-up navy gradient with the hero name. Press-scales on tap. Feed it a `{ id, name, image_url, portrait_url }` item and an `onPress`.

```tsx
<View style={{ width: 120, height: 160 }}>
  <ThumbCard item={{ id, name: 'Night Warden', image_url: null, portrait_url: null }} onPress={go} />
</View>
```
