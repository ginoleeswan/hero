import { PaperSurface } from 'mythique-ds';

export const Flat = () => (
  <div style={{ width: 320, height: 160 }}>
    <PaperSurface style={{ flex: 1, padding: 20 }}>
      <div style={{ fontFamily: 'Flame-Regular', fontSize: 22, color: '#293C43' }}>Library</div>
      <div style={{ fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#6b6b6b', marginTop: 6 }}>
        Printed-paper canvas with a halftone ink-dot texture.
      </div>
    </PaperSurface>
  </div>
);

export const WithLip = () => (
  <div style={{ width: 320, background: '#0b1820', paddingTop: 18 }}>
    <PaperSurface lip style={{ height: 150, padding: 20 }}>
      <div style={{ fontFamily: 'Flame-Regular', fontSize: 22, color: '#293C43' }}>Featured</div>
      <div style={{ fontFamily: 'Nunito_400Regular', fontSize: 13, color: '#6b6b6b', marginTop: 6 }}>
        The rounded lip + top-light forms the seam out of the dark stage above.
      </div>
    </PaperSurface>
  </div>
);
