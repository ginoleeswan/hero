---
category: Controls
---

Apple-style segmented filter row — a single-select pill group. The chip whose `value` equals the current `value` is highlighted. Generic over a string-union value, used for facets like publisher scope or alignment. Provide `options` (`{ value, label }[]`), the selected `value`, and `onChange`.

```tsx
<FilterChips value={scope} onChange={setScope}
  options={[{ value: 'all', label: 'All' }, { value: 'dc', label: 'DC' }, { value: 'marvel', label: 'Marvel' }]} />
```
