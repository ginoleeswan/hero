/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react-native';
import { useWebDocumentScroll } from '../../src/hooks/useWebDocumentScroll';

// expo-router's usePathname — the reset-to-top effect only needs a stable value.
jest.mock('expo-router', () => ({ usePathname: () => '/explore' }));

const BASELINE_BG = '#0b1820';

describe('useWebDocumentScroll', () => {
  beforeEach(() => {
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    window.scrollTo = jest.fn();
  });

  it('switches the document to overflow:visible while mounted', () => {
    renderHook(() => useWebDocumentScroll('#f5ebdc'));
    expect(document.body.style.overflow).toBe('visible');
    expect(document.body.style.backgroundColor).toBe('rgb(245, 235, 220)');
  });

  // The regression: navigating between two document-scroll screens kept both
  // mounted briefly. The outgoing screen's cleanup must NOT tear the mode down
  // while another screen still needs it — otherwise body reverts to the reset's
  // overflow:hidden and strands the page (and the fixed header) mid-scroll.
  it('keeps overflow:visible when one of two overlapping screens unmounts', () => {
    const a = renderHook(() => useWebDocumentScroll('#0b1820')); // explore
    const b = renderHook(() => useWebDocumentScroll('#f5ebdc')); // search
    expect(document.body.style.overflow).toBe('visible');

    a.unmount(); // explore leaves, search still mounted
    expect(document.body.style.overflow).toBe('visible');

    b.unmount(); // last doc-scroll screen leaves → tear down to baseline
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.backgroundColor).toBe('rgb(11, 24, 32)');
  });

  it('restores the deep-navy baseline once the last screen unmounts', () => {
    const { unmount } = renderHook(() => useWebDocumentScroll('#f5ebdc'));
    unmount();
    expect(document.documentElement.style.backgroundColor).toBe('rgb(11, 24, 32)');
    expect(document.body.style.backgroundColor).toBe('rgb(11, 24, 32)');
  });
});
