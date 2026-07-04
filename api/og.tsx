// Dynamic 1200×630 Open Graph card renderer (@vercel/og / satori).
//   /api/og?hero=<id>   — character card (portrait + name + universe)
//   /api/og?a=<id>&b=<id> — VS card (both portraits, tale of the tape)
//   /api/og (no params) — site-wide brand card (snapshotted to public/og.png
//                         by scripts/fetch-og-site.mjs)
// Fonts are read from assets/fonts (shipped via includeFiles in vercel.json).
// Any failure falls back to the brand card — never a broken image.
import { ImageResponse } from '@vercel/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const NAVY = '#0b1820';
const BEIGE = '#f5ebdc';
const GOLD = '#e0a83e';

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

function font(file: string) {
  return readFileSync(join(process.cwd(), 'assets', 'fonts', file));
}

let fonts: { name: string; data: Buffer; style: 'normal' }[] | null = null;
function getFonts() {
  fonts ??= [
    { name: 'Flame', data: font('Flame-Regular.ttf'), style: 'normal' },
    { name: 'FlameSans', data: font('FlameSans-Regular.ttf'), style: 'normal' },
  ];
  return fonts;
}

const wordmark = (size = 30) => (
  <div
    style={{ display: 'flex', fontFamily: 'Flame', fontSize: size, color: GOLD, letterSpacing: 6 }}
  >
    MYTHIQUE
  </div>
);

function siteCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(160deg, ${NAVY} 60%, #14283a)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontFamily: 'Flame',
          fontSize: 130,
          color: BEIGE,
          letterSpacing: 10,
        }}
      >
        MYTHIQUE
      </div>
      <div
        style={{
          display: 'flex',
          fontFamily: 'FlameSans',
          fontSize: 40,
          color: GOLD,
          marginTop: 18,
        }}
      >
        Every universe. Every icon.
      </div>
    </div>
  );
}

function portraitImg(src: string, width: number) {
  // satori element, not a DOM <img>
  return <img src={src} width={width} height={630} style={{ objectFit: 'cover' }} alt="" />;
}

function characterCard(hero: OgHero, img: string | null) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: `linear-gradient(160deg, ${NAVY} 55%, #14283a)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 72px',
        }}
      >
        {wordmark()}
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
              color: '#9db4c4',
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
      {img ? portraitImg(img, 440) : null}
    </div>
  );
}

function vsCard(a: OgHero, b: OgHero, imgA: string | null, imgB: string | null) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: `linear-gradient(90deg, ${NAVY}, #1d1426 50%, ${NAVY})`,
      }}
    >
      {imgA ? portraitImg(imgA, 360) : <div style={{ display: 'flex', width: 360 }} />}
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
            color: '#9db4c4',
            marginTop: 26,
          }}
        >
          Who wins? Vote on Mythique
        </div>
      </div>
      {imgB ? portraitImg(imgB, 360) : <div style={{ display: 'flex', width: 360 }} />}
    </div>
  );
}

const art = (h: OgHero) => h.portrait_url || h.image_url;

export default async function handler(req: Request) {
  let card = siteCard();
  try {
    const { searchParams } = new URL(req.url);
    const heroId = searchParams.get('hero');
    const aId = searchParams.get('a');
    const bId = searchParams.get('b');
    if (heroId) {
      const hero = await fetchHero(heroId);
      if (hero) card = characterCard(hero, art(hero));
    } else if (aId && bId) {
      const [a, b] = await Promise.all([fetchHero(aId), fetchHero(bId)]);
      if (a && b) card = vsCard(a, b, art(a), art(b));
    }
  } catch {
    // brand card fallback
  }
  return new ImageResponse(card, {
    width: 1200,
    height: 630,
    fonts: getFonts(),
    headers: {
      'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
