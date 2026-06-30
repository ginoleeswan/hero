---
category: Media
---

Drop-in replacement for the hero portrait `<Image>` used across cards, banners and rails. Renders the portrait when one exists; otherwise falls back to a coloured **monogram** (initials) derived from `name` — so it is never empty even without a URL. Fill a positioned box with `style={StyleSheet.absoluteFill}`. Supports `blurhash` LQIP and `blurRadius`.

```tsx
<View style={{ width: 120, height: 160 }}>
  <HeroImage id={hero.id} name={hero.name} imageUrl={hero.image_url}
    portraitUrl={hero.portrait_url} style={StyleSheet.absoluteFill} contentFit="cover" />
</View>
```
