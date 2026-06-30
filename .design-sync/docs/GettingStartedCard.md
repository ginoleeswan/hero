---
category: Cards
---

Onboarding checklist card for signed-in users — a titled card with a progress bar, a percent ring, and a row per step (Ionicons glyph, label, done/▸ affordance). Renders `null` once every step is `done`, so it quietly disappears for established users. Each step: `{ id, icon, label, done, onPress }`.

```tsx
<GettingStartedCard steps={[
  { id: 'save', icon: 'heart', label: 'Save a hero', done: true, onPress },
  { id: 'vote', icon: 'flash', label: 'Vote in the Arena', done: false, onPress },
]} />
```
