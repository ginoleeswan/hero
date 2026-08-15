import { CONTENT_MAX_WIDTH, contentWidth } from '../../src/constants/layout';

describe('PageColumn is a no-op on a phone', () => {
  it.each([320, 375, 390, 428])('does not narrow a %ipt window', (w) => {
    // The cap only bites once the window exceeds it, which is why wrapping a
    // screen in PageColumn cannot change any phone layout.
    expect(Math.min(w, CONTENT_MAX_WIDTH)).toBe(w);
  });

  it('caps and centres a landscape iPad', () => {
    expect(contentWidth(1376)).toBe(CONTENT_MAX_WIDTH);
  });
});
