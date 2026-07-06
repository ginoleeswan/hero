// Dynamic 1200×630 Open Graph card renderer (@vercel/og / satori).
//   /api/og?hero=<id>   — character card (portrait + name + universe)
//   /api/og?a=<id>&b=<id> — VS card (both portraits, head to head)
//   /api/og (no params) — site-wide brand card (snapshotted to public/og.png
//                         by scripts/fetch-og-site.mjs)
//
// Runs on the Edge runtime: standalone @vercel/og functions must be Edge for
// Vercel to bundle the underlying satori/resvg WASM — on the Node runtime the
// renderer fails to initialise. Fonts are therefore loaded via URL imports
// (traced + inlined by the bundler) rather than node:fs, which Edge lacks.
//
// Any failure falls back to a redirect to the static brand card (public/og.png)
// so a share link never yields a broken image.
import { ImageResponse } from '@vercel/og';
// Pure-data palette (no RN imports) so the edge route shares the exact brand
// tokens instead of re-hardcoding a set that drifts from the in-app posters.
import { COLORS, SHARE_CARD, shareCardBgCss } from '../src/constants/colors';
import { MARK_ASPECT, mythiqueMarkDataUri } from '../src/constants/brandMark';
import { cardTextureDataUri } from '../src/constants/cardTexture';

export const config = { runtime: 'edge' };

const INK = SHARE_CARD.ink;
const BEIGE = COLORS.beige;
const GOLD = SHARE_CARD.accent;
const MUTED = '#9db4c4';
const BG = shareCardBgCss(); // the shared vertical vignette, matches the posters
const MARK_GOLD = mythiqueMarkDataUri(GOLD);
const TEXTURE_URI = cardTextureDataUri(1200, 630, GOLD);

// The printed-comic overlay (glow + halftone), sitting under all card content.
const textureLayer = (
  <img
    src={TEXTURE_URI}
    width={1200}
    height={630}
    alt=""
    style={{ position: 'absolute', top: 0, left: 0 }}
  />
);

// The mask emblem, sized by height (it's a wide mark). Gold — the accent that
// tops every wordmark lockup.
const markImg = (h: number) => (
  <img
    src={MARK_GOLD}
    width={Math.round(h * MARK_ASPECT)}
    height={h}
    alt=""
    style={{ display: 'flex' }}
  />
);

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

type OgHero = {
  id: string;
  name: string;
  publisher: string | null;
  portrait_url: string | null;
  image_url: string | null;
};

async function fetchHero(id: string): Promise<OgHero | null> {
  const url = `${SUPABASE_URL}/rest/v1/heroes?id=eq.${encodeURIComponent(
    id,
  )}&select=id,name,publisher,portrait_url,image_url`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
  if (!r.ok) return null;
  const rows = (await r.json()) as OgHero[];
  return rows[0] ?? null;
}

// Live catalogue size, floored to a round thousand ("34,000+"). Falls back to a
// safe rounded figure so the brand card never blocks on this.
async function heroCountLabel(): Promise<string> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/heroes?select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Prefer: 'count=exact', Range: '0-0' },
    });
    const cr = r.headers.get('content-range');
    const n = cr ? parseInt(cr.split('/')[1], 10) : NaN;
    if (Number.isFinite(n)) return `${(Math.floor(n / 1000) * 1000).toLocaleString()}+`;
  } catch {
    /* fall through */
  }
  return '34,000+';
}

// Edge runtime has no node:fs — load the font bytes via URL imports so the
// bundler traces and inlines them. Cached across warm invocations.
let fontsPromise: Promise<{ name: string; data: ArrayBuffer; style: 'normal' }[]> | null = null;
function getFonts() {
  fontsPromise ??= Promise.all([
    fetch(new URL('../assets/fonts/Flame-Regular.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
    fetch(new URL('../assets/fonts/FlameSans-Regular.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
    fetch(new URL('../assets/fonts/Righteous-Regular.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
  ]).then(([flame, flameSans, righteous]) => [
    { name: 'Flame', data: flame, style: 'normal' as const },
    { name: 'FlameSans', data: flameSans, style: 'normal' as const },
    { name: 'Righteous', data: righteous, style: 'normal' as const },
  ]);
  return fontsPromise;
}

// The wordmark lockup — the gold mask emblem stacked over the lowercase Righteous
// wordmark in beige. Quiet identity that never competes with the Flame display type.
const wordmark = (size = 34, center = true) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: center ? 'center' : 'flex-start',
      gap: Math.round(size * 0.26),
    }}
  >
    {markImg(Math.round(size * 0.92))}
    <div style={{ display: 'flex', fontFamily: 'Righteous', fontSize: size, color: BEIGE }}>
      mythique
    </div>
  </div>
);

// Comic corner-brackets — a thin gold frame that reads as a trading-card / dossier
// crop mark. Each corner is a 48px L drawn from two borders.
const BRACKET = 'rgba(206,155,51,0.5)';
const corner = (edge: Record<string, unknown>) => (
  <div style={{ position: 'absolute', width: 48, height: 48, ...edge }} />
);

// The site-wide brand card: the app's own masked mascot bleeding off the right,
// the wordmark lockup + stats pill on the left. `origin` locates the bust asset.
function siteCard(origin: string, chars: string) {
  const bust = `${origin}/brand/mascot-bust.png`;
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        background: BG,
      }}
    >
      {textureLayer}
      {/* Mascot bust, bleeding off the right and bottom. */}
      <img src={bust} height={720} alt="" style={{ position: 'absolute', right: -18, bottom: -48 }} />
      {/* Full-bleed left wash — anchors the text with no hard edge. */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `linear-gradient(90deg, rgba(11,24,32,0.92) 0%, rgba(11,24,32,0.5) 34%, rgba(11,24,32,0) 60%)`,
        }}
      />
      {corner({ top: 30, left: 30, borderTop: `2px solid ${BRACKET}`, borderLeft: `2px solid ${BRACKET}` })}
      {corner({ top: 30, right: 30, borderTop: `2px solid ${BRACKET}`, borderRight: `2px solid ${BRACKET}` })}
      {corner({ bottom: 30, left: 30, borderBottom: `2px solid ${BRACKET}`, borderLeft: `2px solid ${BRACKET}` })}
      {corner({ bottom: 30, right: 30, borderBottom: `2px solid ${BRACKET}`, borderRight: `2px solid ${BRACKET}` })}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingLeft: 76,
          paddingRight: 24,
          maxWidth: 860,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'FlameSans',
            fontSize: 22,
            letterSpacing: 3,
            color: GOLD,
            whiteSpace: 'nowrap',
          }}
        >
          THE HERO & VILLAIN ENCYCLOPEDIA
        </div>
        <div style={{ display: 'flex', fontFamily: 'Righteous', fontSize: 116, color: BEIGE, marginTop: 12 }}>
          mythique
        </div>
        <div style={{ display: 'flex', fontFamily: 'FlameSans', fontSize: 40, color: BEIGE, marginTop: 8 }}>
          Every universe. Every icon.
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 36,
            padding: '13px 28px',
            borderRadius: 999,
            border: `2px solid ${BRACKET}`,
            background: 'rgba(245,235,220,0.04)',
            fontFamily: 'FlameSans',
            fontSize: 23,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: GOLD, letterSpacing: 2 }}>WHO WOULD WIN?</span>
          <div style={{ width: 1, height: 24, background: BRACKET, marginLeft: 18, marginRight: 18 }} />
          <span style={{ color: MUTED }}>{`${chars} CHARACTERS`}</span>
        </div>
      </div>
    </div>
  );
}

// A portrait with its inner edge feathered into the card so it reads as key-art
// bleeding into the stage, not a rectangle pasted on top. `blend`: which edge
// dissolves toward the background.
function portraitImg(
  src: string,
  width: number,
  blend: 'left' | 'right' | 'none' = 'none',
  mirror = false,
) {
  const feather =
    blend === 'none'
      ? null
      : {
          position: 'absolute' as const,
          top: 0,
          bottom: 0,
          width: 150,
          [blend]: 0,
          background: `linear-gradient(${blend === 'left' ? '90deg' : '270deg'}, ${INK}, transparent)`,
        };
  return (
    <div style={{ display: 'flex', position: 'relative', width, height: 630 }}>
      <img
        src={src}
        width={width}
        height={630}
        style={{ objectFit: 'cover', transform: mirror ? 'scaleX(-1)' : 'none' }}
        alt=""
      />
      {feather ? <div style={feather} /> : null}
    </div>
  );
}

function characterCard(hero: OgHero, img: string | null) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        background: BG,
      }}
    >
      {textureLayer}
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 72px',
        }}
      >
        {wordmark(34, false)}
        <div
          style={{
            display: 'flex',
            fontFamily: 'Flame',
            fontSize: 92,
            color: BEIGE,
            lineHeight: 1.22,
            marginTop: 20,
          }}
        >
          {hero.name}
        </div>
        {hero.publisher ? (
          <div
            style={{
              display: 'flex',
              fontFamily: 'FlameSans',
              fontSize: 34,
              color: MUTED,
              marginTop: 12,
            }}
          >
            {hero.publisher}
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            fontFamily: 'FlameSans',
            fontSize: 26,
            color: GOLD,
            marginTop: 44,
          }}
        >
          Every universe. Every icon.
        </div>
      </div>
      {img ? portraitImg(img, 440, 'left') : null}
    </div>
  );
}

function vsCard(a: OgHero, b: OgHero, imgA: string | null, imgB: string | null) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        background: BG,
      }}
    >
      {textureLayer}
      {imgA ? portraitImg(imgA, 360, 'right') : <div style={{ display: 'flex', width: 360 }} />}
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
        }}
      >
        {wordmark(24)}
        <div
          style={{
            display: 'flex',
            fontFamily: 'Flame',
            fontSize: 52,
            color: BEIGE,
            marginTop: 26,
            textAlign: 'center',
            lineHeight: 1.22,
          }}
        >
          {a.name}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Flame',
            fontSize: 66,
            color: GOLD,
            margin: '6px 0',
          }}
        >
          VS
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Flame',
            fontSize: 52,
            color: BEIGE,
            textAlign: 'center',
            lineHeight: 1.22,
          }}
        >
          {b.name}
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'FlameSans',
            fontSize: 24,
            color: MUTED,
            marginTop: 26,
          }}
        >
          Who wins? Vote on Mythique
        </div>
      </div>
      {imgB ? (
        portraitImg(imgB, 360, 'left', true)
      ) : (
        <div style={{ display: 'flex', width: 360 }} />
      )}
    </div>
  );
}

const art = (h: OgHero) => h.portrait_url || h.image_url;

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const { origin, searchParams } = url;
    const heroId = searchParams.get('hero');
    const aId = searchParams.get('a');
    const bId = searchParams.get('b');
    let card;
    if (heroId) {
      const hero = await fetchHero(heroId);
      if (hero) card = characterCard(hero, art(hero));
    } else if (aId && bId) {
      const [a, b] = await Promise.all([fetchHero(aId), fetchHero(bId)]);
      if (a && b) card = vsCard(a, b, art(a), art(b));
    }
    // No (or unresolved) params → the site-wide brand card.
    if (!card) card = siteCard(origin, await heroCountLabel());
    return new ImageResponse(card, {
      width: 1200,
      height: 630,
      fonts: await getFonts(),
      headers: {
        'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    // Never emit a broken image — fall back to the static brand card.
    return Response.redirect(new URL('/og.png', req.url).toString(), 302);
  }
}
