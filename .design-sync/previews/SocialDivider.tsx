import { SocialDivider } from 'mythique-ds';

export const Default = () => (
  <div style={{ width: 340, padding: 24, background: '#f5ebdc', borderRadius: 12 }}>
    <SocialDivider />
  </div>
);

export const CustomLabel = () => (
  <div style={{ width: 340, padding: 24, background: '#f5ebdc', borderRadius: 12 }}>
    <SocialDivider label="continue with" />
  </div>
);
