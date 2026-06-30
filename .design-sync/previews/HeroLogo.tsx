import { HeroLogo } from 'mythique-ds';

export const Wordmark = () => (
  <div style={{ padding: 28, background: '#f5ebdc' }}>
    <HeroLogo iconSize={30} fontSize={26} />
  </div>
);

export const OnDark = () => (
  <div style={{ padding: 28, background: '#0b1820' }}>
    <HeroLogo iconSize={30} fontSize={26} color="#f5ebdc" iconColor="#E77333" />
  </div>
);

export const IconOnly = () => (
  <div style={{ padding: 28, background: '#f5ebdc' }}>
    <HeroLogo iconOnly iconSize={40} />
  </div>
);
