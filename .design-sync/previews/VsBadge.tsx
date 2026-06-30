import { VsBadge } from 'mythique-ds';

export const Solid = () => (
  <div style={{ padding: 28, background: '#f5ebdc' }}>
    <VsBadge variant="solid" size={56} />
  </div>
);

export const Glass = () => (
  <div style={{ padding: 28, background: '#0b1820' }}>
    <VsBadge variant="glass" size={56} />
  </div>
);

export const Sizes = () => (
  <div
    style={{
      padding: 28,
      background: '#f5ebdc',
      display: 'flex',
      flexDirection: 'row',
      gap: 16,
      alignItems: 'center',
    }}
  >
    <VsBadge variant="solid" size={32} />
    <VsBadge variant="solid" size={46} />
    <VsBadge variant="solid" size={64} />
  </div>
);
