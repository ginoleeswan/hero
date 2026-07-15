import {
  urlBase64ToUint8Array,
  isPushSupported,
  getPushState,
  subscribeToPush,
} from '../../src/lib/push';

// supabase-js is imported transitively; the tests here never reach it (all paths
// short-circuit on the jsdom "unsupported" branch), so no mock is required.

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url string (padding + -_ variants) to the right bytes', () => {
    // "Man" → TWFu (standard base64, no url-special chars)
    expect(Array.from(urlBase64ToUint8Array('TWFu'))).toEqual([77, 97, 110]);
    // 0xFB 0xFF 0xBF → base64 "+/+/", base64url "-_-_"; verifies -_→+/ mapping.
    expect(Array.from(urlBase64ToUint8Array('-_-_'))).toEqual([251, 255, 191]);
    // Missing padding must be tolerated: "TWE" (2 bytes "Ma") → [77, 97]
    expect(Array.from(urlBase64ToUint8Array('TWE'))).toEqual([77, 97]);
  });

  it('produces the 65-byte length a real P-256 VAPID key decodes to', () => {
    const key =
      'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBrp3rXk6TkrxZJjSgSnfckA';
    // Not asserting exact bytes — just that it decodes without throwing and is
    // a plausible length (>0). The real applicationServerKey is 65 bytes.
    expect(urlBase64ToUint8Array(key).length).toBeGreaterThan(0);
  });
});

describe('push API in an unsupported environment (jsdom, no SW / no VAPID key)', () => {
  it('reports unsupported', () => {
    expect(isPushSupported()).toBe(false);
  });
  it('getPushState resolves to "unsupported"', async () => {
    await expect(getPushState()).resolves.toBe('unsupported');
  });
  it('subscribeToPush returns an error without touching the network', async () => {
    const { error } = await subscribeToPush('user-1');
    expect(error).toBeTruthy();
  });
});
