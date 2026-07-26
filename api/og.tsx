// Dynamic 1200×630 Open Graph card renderer (@vercel/og / satori).
//   /api/og?hero=<id>   — character card (portrait + name + universe)
//   /api/og?a=<id>&b=<id> — VS card (both portraits, head to head)
//   /api/og?type=universe&hero=<id> — universe poster (the character's world:
//                         nemeses, allies, teammates and bloodline as faces)
//   /api/og?type=debate&a=<id>&b=<id> — daily-debate card (portraits, live
//                         split bar, top take, wordmark) — the asset scripts/
//                         social/daily-debate.mjs fetches for the growth loop
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

type DebateTally = { votesA: number; votesB: number; total: number };
type DebateTopTake = { body: string; displayName: string | null } | null;

// Live split via the v2 tally RPC (anon-granted; unions authed + anon votes).
// A voter key isn't needed here — we only read the aggregate counts, not
// `my_pick` — so it's passed null.
async function fetchTally(aId: string, bId: string): Promise<DebateTally> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_matchup_tally_v2`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_a: aId, p_b: bId, p_voter_key: null }),
    });
    if (!r.ok) return { votesA: 0, votesB: 0, total: 0 };
    const j = (await r.json()) as { votes_a?: number; votes_b?: number; total?: number };
    return { votesA: j.votes_a ?? 0, votesB: j.votes_b ?? 0, total: j.total ?? 0 };
  } catch {
    return { votesA: 0, votesB: 0, total: 0 };
  }
}

// The current top take for the pair (live agree-count order — not the frozen
// `daily_debate.top_take_id`, which is only set once resolve_daily_debate()
// has run for a past date). Attribution is best-effort: user_profiles is
// self-scoped RLS, so an anon read of display_name legitimately comes back
// empty — the card falls back to an unattributed quote in that case.
async function fetchTopTake(aId: string, bId: string): Promise<DebateTopTake> {
  const lo = aId <= bId ? aId : bId;
  const hi = aId <= bId ? bId : aId;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/matchup_takes?hero_a_id=eq.${encodeURIComponent(lo)}` +
      `&hero_b_id=eq.${encodeURIComponent(hi)}&status=eq.visible` +
      `&order=agree_count.desc,created_at.asc&limit=1&select=body,user_id`;
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) return null;
    const rows = (await r.json()) as { body: string; user_id: string }[];
    const take = rows[0];
    if (!take) return null;
    let displayName: string | null = null;
    try {
      const pr = await fetch(
        `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${encodeURIComponent(
          take.user_id,
        )}&select=display_name`,
        { headers: { apikey: SUPABASE_KEY } },
      );
      if (pr.ok) {
        const prows = (await pr.json()) as { display_name: string | null }[];
        displayName = prows[0]?.display_name ?? null;
      }
    } catch {
      /* attribution is optional */
    }
    return { body: take.body, displayName };
  } catch {
    return null;
  }
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
      <img
        src={bust}
        height={720}
        alt=""
        style={{ position: 'absolute', right: -18, bottom: -48 }}
      />
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
      {corner({
        top: 30,
        left: 30,
        borderTop: `2px solid ${BRACKET}`,
        borderLeft: `2px solid ${BRACKET}`,
      })}
      {corner({
        top: 30,
        right: 30,
        borderTop: `2px solid ${BRACKET}`,
        borderRight: `2px solid ${BRACKET}`,
      })}
      {corner({
        bottom: 30,
        left: 30,
        borderBottom: `2px solid ${BRACKET}`,
        borderLeft: `2px solid ${BRACKET}`,
      })}
      {corner({
        bottom: 30,
        right: 30,
        borderBottom: `2px solid ${BRACKET}`,
        borderRight: `2px solid ${BRACKET}`,
      })}

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
        <div
          style={{
            display: 'flex',
            fontFamily: 'Righteous',
            fontSize: 116,
            color: BEIGE,
            marginTop: 12,
          }}
        >
          mythique
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'FlameSans',
            fontSize: 40,
            color: BEIGE,
            marginTop: 8,
          }}
        >
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
          <div
            style={{ width: 1, height: 24, background: BRACKET, marginLeft: 18, marginRight: 18 }}
          />
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

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// Live crowd split — a two-tone bar in the same sideA/sideB semantic accents
// the in-app share card uses for "competitive data, never branding".
function splitBar(pctA: number, pctB: number, width = 400) {
  const wA = Math.max(0, Math.min(width, Math.round((width * pctA) / 100)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, marginTop: 24 }}>
      <div
        style={{
          display: 'flex',
          width,
          height: 14,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'rgba(245,235,220,0.14)',
        }}
      >
        <div style={{ display: 'flex', width: wA, height: 14, background: SHARE_CARD.sideA }} />
        <div
          style={{ display: 'flex', width: width - wA, height: 14, background: SHARE_CARD.sideB }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', width, marginTop: 10 }}>
        <div
          style={{
            display: 'flex',
            fontFamily: 'FlameSans',
            fontSize: 22,
            color: SHARE_CARD.sideA,
          }}
        >{`${pctA}%`}</div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'FlameSans',
            fontSize: 22,
            color: SHARE_CARD.sideB,
          }}
        >{`${pctB}%`}</div>
      </div>
    </div>
  );
}

// The daily-debate card: both portraits bleeding in from the edges, the live
// crowd split, and (when one exists) the current top take — the growth-loop
// asset scripts/social/daily-debate.mjs posts once a day.
function debateCard(
  a: OgHero,
  b: OgHero,
  imgA: string | null,
  imgB: string | null,
  tally: DebateTally,
  topTake: DebateTopTake,
) {
  const pctA = tally.total > 0 ? Math.round((tally.votesA / tally.total) * 100) : 50;
  const pctB = 100 - pctA;
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
      {imgA ? portraitImg(imgA, 330, 'right') : <div style={{ display: 'flex', width: 330 }} />}
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 20px',
        }}
      >
        {wordmark(20)}
        <div
          style={{
            display: 'flex',
            fontFamily: 'FlameSans',
            fontSize: 20,
            letterSpacing: 3,
            color: GOLD,
            marginTop: 18,
          }}
        >
          TODAY&apos;S DEBATE
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Flame',
            fontSize: 42,
            color: BEIGE,
            marginTop: 14,
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
            fontSize: 48,
            color: GOLD,
            margin: '2px 0',
          }}
        >
          VS
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'Flame',
            fontSize: 42,
            color: BEIGE,
            textAlign: 'center',
            lineHeight: 1.22,
          }}
        >
          {b.name}
        </div>
        {splitBar(pctA, pctB)}
        {topTake ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 24,
              maxWidth: 440,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: 'FlameSans',
                fontSize: 21,
                color: BEIGE,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              {`"${truncate(topTake.body, 96)}"`}
            </div>
            <div
              style={{
                display: 'flex',
                fontFamily: 'FlameSans',
                fontSize: 17,
                color: MUTED,
                marginTop: 8,
              }}
            >
              {`— ${topTake.displayName ?? 'a fan'}`}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              fontFamily: 'FlameSans',
              fontSize: 22,
              color: MUTED,
              marginTop: 24,
            }}
          >
            Who wins? Vote on Mythique
          </div>
        )}
      </div>
      {imgB ? (
        portraitImg(imgB, 330, 'left', true)
      ) : (
        <div style={{ display: 'flex', width: 330 }} />
      )}
    </div>
  );
}

type OgMember = { id: string; name: string; avatar_url: string | null };
type OgFaction = { label: string; colour: string; members: OgMember[] };

// The four factions in the same fixed order the scene draws them, so the poster
// and the live page agree about what a character's world is made of.
const FACTIONS: { key: string; label: string; colour: string }[] = [
  { key: 'enemy', label: 'Nemeses', colour: COLORS.red },
  { key: 'ally', label: 'Allies', colour: COLORS.green },
  { key: 'teammate', label: 'Teammates', colour: COLORS.blue },
  { key: 'family', label: 'Bloodline', colour: COLORS.purple },
];

type OgUniverse = { factions: OgFaction[]; total: number };

async function fetchUniverse(heroId: string): Promise<OgUniverse | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_hero_neighborhood`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_hero_id: heroId, p_limit: 24 }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      nodes: (OgMember & { is_subject: boolean })[];
      edges: { from: string; to: string; kind: string }[];
    };
    const nodes = data?.nodes ?? [];
    const edges = data?.edges ?? [];
    if (nodes.length < 2) return null;

    const kindOf = (id: string) =>
      edges.find((e) => (e.from === heroId && e.to === id) || (e.to === heroId && e.from === id))
        ?.kind ?? null;

    const factions = FACTIONS.map(({ key, label, colour }) => ({
      label,
      colour,
      members: nodes
        .filter((n) => !n.is_subject && kindOf(n.id) === key)
        // Faces first: a poster of cut-out heads is the point, and an initials
        // disc is a stand-in, so any character who has real art earns the slot.
        .sort((a, b) => Number(Boolean(b.avatar_url)) - Number(Boolean(a.avatar_url))),
    })).filter((f) => f.members.length > 0);

    return { factions, total: nodes.length - 1 };
  } catch {
    return null;
  }
}

// Avatars are transparent cut-outs made to sit on any background, so they need
// no plate — the head IS the mark, exactly as in the app.
const avatarSrc = (url: string) =>
  url.includes('/upload/') ? url.replace('/upload/', '/upload/w_128/') : url;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

const memberHead = (m: OgMember, size: number) =>
  m.avatar_url ? (
    <img
      key={m.id}
      src={avatarSrc(m.avatar_url)}
      width={size}
      height={size}
      alt=""
      style={{ display: 'flex' }}
    />
  ) : (
    <div
      key={m.id}
      style={{
        display: 'flex',
        width: size,
        height: size,
        borderRadius: size,
        background: 'rgba(245,235,220,0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'FlameSans',
        fontSize: Math.round(size * 0.3),
        color: MUTED,
      }}
    >
      {initials(m.name)}
    </div>
  );

/**
 * The character's world as a poster.
 *
 * The live scene is the best-looking thing in the app and, until this existed,
 * could only leave it as a screenshot. Rather than trying to reproduce the 3D
 * constellation in a static renderer — satori has no canvas and no transforms
 * worth the name — this states the same fact in print: who the character's
 * world is made of, grouped and named, as faces.
 */
function universeCard(hero: OgHero, img: string | null, uni: OgUniverse) {
  const rows = uni.factions.slice(0, 4);
  // Heads shrink as the poster fills, so four busy factions never overflow.
  const size = rows.length >= 4 ? 62 : 72;
  const perRow = 7;
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
      {img ? portraitImg(img, 360, 'right') : null}
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 64px 0 48px',
        }}
      >
        {wordmark(26, false)}
        <div
          style={{
            display: 'flex',
            fontFamily: 'Flame',
            fontSize: 58,
            color: BEIGE,
            lineHeight: 1.22,
            marginTop: 14,
          }}
        >
          {hero.name}&#8217;s universe
        </div>
        <div
          style={{
            display: 'flex',
            fontFamily: 'FlameSans',
            fontSize: 22,
            color: GOLD,
            marginTop: 6,
          }}
        >
          {hero.publisher ? `${hero.publisher} · ` : ''}
          {uni.total} connections
        </div>

        {rows.map((f) => (
          <div key={f.label} style={{ display: 'flex', flexDirection: 'column', marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  background: f.colour,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'FlameSans',
                  fontSize: 16,
                  letterSpacing: 2,
                  color: f.colour,
                }}
              >
                {f.label.toUpperCase()} · {f.members.length}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              {f.members.slice(0, perRow).map((m) => memberHead(m, size))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Ask Cloudinary for a card-sized derivative instead of the original.
 *
 * The stored portraits are full-resolution — Wonder Woman's is 623KB — and
 * satori has to fetch and decode every image inline while it streams the
 * response. At that size the render dies partway through, and because the
 * function has already emitted `200 image/png`, the failure surfaces as an
 * EMPTY body rather than reaching the catch that redirects to the static
 * brand card. Every character and VS unfurl was serving a blank image.
 *
 * Cards are 1200x630 and no portrait occupies more than 440 of it, so 720px
 * is generous. Non-Cloudinary sources pass through untouched.
 */
const sized = (url: string, w = 720) =>
  url.includes('/upload/') ? url.replace('/upload/', `/upload/w_${w},q_auto/`) : url;

const art = (h: OgHero) => {
  const u = h.portrait_url || h.image_url;
  return u ? sized(u) : null;
};

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const { origin, searchParams } = url;
    const heroId = searchParams.get('hero');
    const aId = searchParams.get('a');
    const bId = searchParams.get('b');
    const type = searchParams.get('type');
    const isDebate = type === 'debate';
    let card;
    if (type === 'universe' && heroId) {
      const [hero, uni] = await Promise.all([fetchHero(heroId), fetchUniverse(heroId)]);
      // A character with no mapped world falls through to their normal card
      // rather than shipping an empty poster.
      if (hero && uni) card = universeCard(hero, art(hero), uni);
      else if (hero) card = characterCard(hero, art(hero));
    } else if (heroId) {
      const hero = await fetchHero(heroId);
      if (hero) card = characterCard(hero, art(hero));
    } else if (isDebate && aId && bId) {
      const [a, b] = await Promise.all([fetchHero(aId), fetchHero(bId)]);
      if (a && b) {
        const [tally, topTake] = await Promise.all([
          fetchTally(a.id, b.id),
          fetchTopTake(a.id, b.id),
        ]);
        card = debateCard(a, b, art(a), art(b), tally, topTake);
      }
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
