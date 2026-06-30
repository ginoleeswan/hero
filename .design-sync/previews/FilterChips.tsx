import { FilterChips } from 'mythique-ds';
const noop = () => {};

export const Publishers = () => (
  <div style={{ padding: 20, background: '#0b1820' }}>
    <FilterChips
      value="all"
      onChange={noop}
      options={[
        { value: 'all', label: 'All' },
        { value: 'dc', label: 'DC' },
        { value: 'marvel', label: 'Marvel' },
        { value: 'indie', label: 'Indie' },
      ]}
    />
  </div>
);

export const Alignment = () => (
  <div style={{ padding: 20, background: '#0b1820' }}>
    <FilterChips
      value="hero"
      onChange={noop}
      options={[
        { value: 'hero', label: 'Heroes' },
        { value: 'villain', label: 'Villains' },
      ]}
    />
  </div>
);
