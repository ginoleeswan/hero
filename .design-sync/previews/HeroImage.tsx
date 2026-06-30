import { HeroImage } from 'mythique-ds';

const box = { position: 'relative', width: 130, height: 175, borderRadius: 12, overflow: 'hidden' } as const;
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

export const Monogram = () => (
  <div style={{ display: 'flex', flexDirection: 'row', gap: 14, padding: 16, background: '#f5ebdc' }}>
    <div style={box}><HeroImage id="demo-warden" name="Night Warden" imageUrl={null} portraitUrl={null} style={fill} contentFit="cover" /></div>
    <div style={box}><HeroImage id="demo-flare" name="Solar Flare" imageUrl={null} portraitUrl={null} style={fill} contentFit="cover" /></div>
    <div style={box}><HeroImage id="demo-vow" name="Iron Vow" imageUrl={null} portraitUrl={null} style={fill} contentFit="cover" /></div>
  </div>
);
