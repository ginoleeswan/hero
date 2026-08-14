import config from '../../app.config';
import { SPLASH_LOCKUP } from '../../src/constants/logo';

// The OS splash and BootStage draw the same lockup from two different places:
// the native config renders assets/splash.png, and the JS stage rebuilds it from
// SPLASH_LOCKUP. When those disagree the app visibly jumps at the handoff — the
// mark resizes and the wordmark moves — which is precisely what shipped once,
// guarded only by a comment. These assertions are that guard now.

function splashPluginOptions(): Record<string, unknown> {
  const entry = (config.plugins ?? []).find(
    (p): p is [string, Record<string, unknown>] =>
      Array.isArray(p) && p[0] === 'expo-splash-screen',
  );
  if (!entry) throw new Error('expo-splash-screen plugin not found in app.config.ts');
  return entry[1];
}

describe('splash lockup ↔ native config', () => {
  it("feeds the config the lockup's height, because the box it fits into is square", () => {
    // expo-splash-screen treats `imageWidth` as the side of a SQUARE box and the
    // storyboard aspect-fits into it. Our lockup is portrait, so the height is
    // the binding dimension: at `w` (300) the art rendered at 300/560 = 54%.
    expect(splashPluginOptions().imageWidth).toBe(SPLASH_LOCKUP.h);
  });

  it('keeps the lockup portrait, which is why the height binds at all', () => {
    // If the art ever became landscape, `imageWidth` would need to be `w` and
    // the test above would be wrong — so pin the assumption it rests on.
    expect(SPLASH_LOCKUP.h).toBeGreaterThan(SPLASH_LOCKUP.w);
  });

  it('keeps the mark and wordmark inside the lockup box', () => {
    expect(SPLASH_LOCKUP.markW).toBeLessThanOrEqual(SPLASH_LOCKUP.w);
    expect(SPLASH_LOCKUP.wordW).toBeLessThanOrEqual(SPLASH_LOCKUP.w);
    expect(SPLASH_LOCKUP.markCY).toBeLessThan(SPLASH_LOCKUP.h);
    expect(SPLASH_LOCKUP.wordCY).toBeLessThan(SPLASH_LOCKUP.h);
  });

  it('keeps the mark above the wordmark — the lockup is mark high, wordmark low', () => {
    expect(SPLASH_LOCKUP.markCY).toBeLessThan(SPLASH_LOCKUP.wordCY);
  });

  it('points the config at the asset the lockup numbers describe', () => {
    expect(splashPluginOptions().image).toBe('./assets/splash.png');
  });
});
