import { DotGrid } from 'mythique-ds';

export const OnNavy = () => (
  <div
    style={{
      position: 'relative',
      width: 320,
      height: 140,
      background: '#293C43',
      borderRadius: 12,
      overflow: 'hidden',
    }}
  >
    <DotGrid />
  </div>
);

export const Dense = () => (
  <div
    style={{
      position: 'relative',
      width: 320,
      height: 140,
      background: '#0b1820',
      borderRadius: 12,
      overflow: 'hidden',
    }}
  >
    <DotGrid color="rgba(231,115,51,0.25)" spacing={14} radius={1.5} />
  </div>
);
