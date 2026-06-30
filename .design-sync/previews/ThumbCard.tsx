import { ThumbCard } from 'mythique-ds';
const noop = () => {};
const box = { position: 'relative', width: 130, height: 175 } as const;

export const Grid = () => (
  <div
    style={{ display: 'flex', flexDirection: 'row', gap: 14, padding: 16, background: '#f5ebdc' }}
  >
    <div style={box}>
      <ThumbCard
        item={{ id: 'demo-warden', name: 'Night Warden', image_url: null, portrait_url: null }}
        onPress={noop}
      />
    </div>
    <div style={box}>
      <ThumbCard
        item={{ id: 'demo-flare', name: 'Solar Flare', image_url: null, portrait_url: null }}
        onPress={noop}
      />
    </div>
    <div style={box}>
      <ThumbCard
        item={{ id: 'demo-vow', name: 'Iron Vow', image_url: null, portrait_url: null }}
        onPress={noop}
      />
    </div>
  </div>
);
