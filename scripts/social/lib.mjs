// Shared data + asset layer for the Mythique social pipelines (reels + carousels).
//
// Reads use the service-role key when present in .env.local (local-only batch
// scripts; the anon role's 3s statement_timeout starves heavy reads) and fall
// back to the public key. Same read paths as the app either way.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_DIR = join(ROOT, 'out', 'social');
export const STAT_KEYS = ['intelligence', 'strength', 'speed', 'durability', 'power', 'combat'];

// Curated marquee rivalries — the ones people show up to argue about. Filled out
// with random popular pairs. Names are resolved against the heroes table.
export const RIVALRIES = [
  ['Goku', 'Superman'],
  ['Batman', 'Iron Man'],
  ['Hulk', 'Superman'],
  ['Thanos', 'Darkseid'],
  ['Naruto', 'Ichigo'],
  ['Spider-Man', 'Batman'],
  ['Thor', 'Superman'],
  ['Wolverine', 'Deadpool'],
  ['Saitama', 'Goku'],
  ['Doctor Strange', 'Zatanna'],
  ['Flash', 'Quicksilver'],
  ['Joker', 'Green Goblin'],
];

const MIN_VOTES = 40; // people actually engaged with it
const MAX_SPREAD = 18; // |pct - 50| <= this => close/controversial => gets talking
const FAME_POOL = 160; // sample random pairs from the top-N most famous
const HERO_SELECT =
  'id,name,publisher,portrait_url,image_url,image_md_url,fame_score,gender,alignment,' +
  STAT_KEYS.join(',');
// Strict fame ordering: fame_score bands can tie (esp. tier plateaus), so break
// ties by the continuous popularity signals, then id, for a stable countdown.
const FAME_ORDER =
  'fame_score.desc.nullslast,wikidata_sitelinks.desc.nullslast,powerstats_total.desc.nullslast,id.asc';
// Real people (historical figures, politicians, celebrities) are catalogued as
// 'Non-Fictional' but must NEVER surface in generated posts — assigning them
// power stats, an alignment, or an AI-written bio is a publicity/defamation risk.
// They sit at fame <= 13 so the fame gates exclude them in practice today, but
// keep it explicit so a future re-rating or signal change can't leak them in.
export const REAL_PERSON_FILTER = '&publisher=not.in.("Non-Fictional")';
const q = (s) => encodeURIComponent(s);

export function loadEnv() {
  const envPath = join(ROOT, '.env.local');
  const out = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || out.EXPO_PUBLIC_SUPABASE_URL;
  // Prefer the service-role key when available (local-only scripts): the anon
  // role carries the app's 3s statement_timeout, and the batch generators'
  // heavier reads (13-column fame-ordered selects) dice-roll against that
  // cliff (57014) — minutes of retries for no reason. Reads are identical.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    out.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_KEY ||
    out.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) {
    console.error(
      'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY (checked .env.local and env).',
    );
    process.exit(1);
  }
  return { url, key };
}

export function makeSb({ url, key }) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  return {
    url,
    headers,
    // Cold queries intermittently 500 (statement_timeout on a cold plan) and a
    // loaded DB can hang a socket — retry with backoff + a per-attempt abort
    // timeout so batch generators neither die on the first fetch nor stall
    // forever. 4xx fails fast (won't heal on retry).
    async rest(path) {
      let last;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise((res) => setTimeout(res, 1500 * attempt));
        try {
          const r = await fetch(`${url}/rest/v1/${path}`, {
            headers,
            signal: AbortSignal.timeout(15000),
          });
          if (r.ok) return r.json();
          last = r.status;
          if (r.status < 500) break;
        } catch (e) {
          last = e?.name === 'TimeoutError' ? 'timeout' : (e?.message ?? 'network');
        }
      }
      throw new Error(`REST ${path} -> ${last}`);
    },
    async rpc(fn, body) {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`RPC ${fn} -> ${r.status}`);
      return r.json();
    },
    async invoke(fn, body) {
      const r = await fetch(`${url}/functions/v1/${fn}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`fn ${fn} -> ${r.status}`);
      return r.json();
    },
  };
}

export const statWins = (a, b) => {
  let wa = 0,
    wb = 0;
  for (const k of STAT_KEYS) {
    if ((a[k] ?? 0) > (b[k] ?? 0)) wa++;
    else if ((b[k] ?? 0) > (a[k] ?? 0)) wb++;
  }
  return [wa, wb];
};

export async function heroByName(sb, name) {
  const rows = await sb.rest(`heroes?name=eq.${q(name)}&select=${HERO_SELECT}&limit=1`);
  return rows[0] || null;
}

// Extended profile fields for character-showcase (bio) carousels.
const HERO_FULL =
  HERO_SELECT +
  ',full_name,first_appearance,alignment,race,occupation,aliases,place_of_birth,group_affiliation,powers,movie_count,issue_count,wikidata_sitelinks';
export async function heroFullByName(sb, name) {
  const rows = await sb.rest(`heroes?name=eq.${q(name)}&select=${HERO_FULL}&limit=1`);
  return rows[0] || null;
}
// Random popular characters for bio showcases.
export async function popularHeroes(sb, n) {
  return sb.rest(`heroes?select=${HERO_FULL}${REAL_PERSON_FILTER}&order=${FAME_ORDER}&limit=${n}`);
}

// Relationship graph (enemies / allies), family, and key/value enrichment facts.
export async function getRelated(sb, id, kind, limit = 6, sameUniverse = false) {
  try {
    return await sb.rpc('get_related_heroes', {
      p_hero_id: id,
      p_kind: kind,
      p_limit: limit,
      p_same_universe: sameUniverse,
    });
  } catch {
    return [];
  }
}
export async function getFamily(sb, id, limit = 6) {
  try {
    return await sb.rpc('get_family_opponents', { p_hero_id: id, p_limit: limit });
  } catch {
    return [];
  }
}
export async function getFact(sb, id, key) {
  try {
    const r = await sb.rest(`hero_facts?hero_id=eq.${id}&key=eq.${q(key)}&select=value&limit=1`);
    return r[0]?.value ?? null;
  } catch {
    return null;
  }
}
export const famousPool = (sb) =>
  sb.rest(
    `heroes?select=${HERO_SELECT}${REAL_PERSON_FILTER}&order=${FAME_ORDER}&limit=${FAME_POOL}`,
  );

// A matchup is postable if it has a real, close-ish vote split.
export async function evaluate(sb, a, b) {
  const [ka, kb] = a.id <= b.id ? [a, b] : [b, a]; // tally normalizes smaller id as A
  let tally;
  try {
    tally = await sb.rpc('get_matchup_tally', { p_a: ka.id, p_b: kb.id });
  } catch {
    return null;
  }
  const total = tally.total ?? 0;
  if (total < MIN_VOTES) return null;
  const pctKa = Math.round((tally.votes_a / total) * 100);
  if (Math.abs(pctKa - 50) > MAX_SPREAD) return null;
  return {
    ka,
    kb,
    votesA: tally.votes_a,
    votesB: tally.votes_b,
    total,
    pctA: pctKa,
    pctB: 100 - pctKa,
  };
}

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = ((i + 1) * 2654435761) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export async function selectMatchups(sb, count) {
  const picks = [];
  const seen = new Set();
  const key = (a, b) => [a, b].sort().join(':');
  for (const [na, nb] of shuffle([...RIVALRIES])) {
    if (picks.length >= count) break;
    const a = await heroByName(sb, na),
      b = await heroByName(sb, nb);
    if (!a || !b || seen.has(key(a.id, b.id))) continue;
    const ev = await evaluate(sb, a, b);
    if (ev) {
      seen.add(key(a.id, b.id));
      picks.push(ev);
    }
  }
  if (picks.length < count) {
    const pool = await famousPool(sb);
    let attempts = 0;
    while (picks.length < count && attempts < 400) {
      attempts++;
      const a = pool[Math.floor((attempts * 2654435761) % pool.length)];
      const b = pool[Math.floor((attempts * 40503) % pool.length)];
      if (!a || !b || a.id === b.id || seen.has(key(a.id, b.id))) continue;
      if (a.publisher && a.publisher === b.publisher) continue; // cross-universe = more argument
      const ev = await evaluate(sb, a, b);
      if (ev) {
        seen.add(key(a.id, b.id));
        picks.push(ev);
      }
    }
  }
  return picks;
}

export async function resolveManual(sb, spec) {
  const [na, nb] = spec.split(',').map((s) => s.trim());
  const a = await heroByName(sb, na),
    b = await heroByName(sb, nb);
  if (!a || !b) {
    console.error('Could not find one of:', na, nb);
    process.exit(1);
  }
  const ev = await evaluate(sb, a, b);
  if (ev) return ev;
  console.warn('Note: that matchup has few/no votes; the fan bar may be empty.');
  const [ka, kb] = a.id <= b.id ? [a, b] : [b, a];
  return { ka, kb, votesA: 0, votesB: 0, total: 0, pctA: 50, pctB: 50 };
}

// Fills a selection out with everything a template needs to render.
export async function hydrate(sb, sel) {
  const [wa, wb] = statWins(sel.ka, sel.kb);
  const winner = wa >= wb ? 'a' : 'b';
  let verdict = '';
  try {
    const r = await sb.invoke('generate-verdict', {
      heroAId: sel.ka.id,
      heroBId: sel.kb.id,
      heroA: sel.ka.name,
      heroB: sel.kb.name,
      winsA: wa,
      winsB: wb,
      statsA: Object.fromEntries(STAT_KEYS.map((k) => [k, sel.ka[k] ?? 0])),
      statsB: Object.fromEntries(STAT_KEYS.map((k) => [k, sel.kb[k] ?? 0])),
    });
    verdict = r.verdict || '';
  } catch (e) {
    console.warn('verdict fetch failed:', e.message);
  }
  const [portraitA, portraitB] = await Promise.all([
    portraitDataUri(sel.ka),
    portraitDataUri(sel.kb),
  ]);
  return {
    ka: sel.ka,
    kb: sel.kb,
    winner,
    verdict,
    voteA: sel.pctA,
    voteB: sel.pctB,
    portraitA,
    portraitB,
  };
}

// ── Deep links ───────────────────────────────────────────────────────────────
//
// Measured 2026-08-16, and the reason this exists: of 2,466 sessions that
// arrived from TikTok, 2,464 landed on `/` or `/explore`. Two reached a content
// page. Every generator below was writing the bare string "mythique.app" into
// its caption, so a viewer who had just watched thirty seconds about one
// character tapped through to a general magazine feed with no relationship to
// what they had been watching — and left at 1.1 pages per session. The visitors
// who DO reach a character page read 4.3 of them. The content converts; the
// door does not.
//
// So a post links to its own subject. The destination pages already exist; this
// was never a missing feature, only a missing href.
//
// utm_content carries the subject's id so the landing surface can put it first
// even when the deep link itself gets stripped — TikTok's in-app browser and
// link-shortening both do that — and so `session_attribution`, which already has
// the column and has been recording `campaign=untitled` for 1,626 sessions, can
// finally say which post earned a visit.
export const ORIGIN = 'https://mythique.app';

/**
 * A post's destination: an absolute URL to the thing the post is ABOUT.
 *
 * `path` is a route path with no leading origin ('character/cv-123'). Ids are
 * expected to be encoded already by the caller when they contain a colon —
 * `title/tmdb:1` must arrive as `title/tmdb%3A1` — because only the caller knows
 * which segment is an id.
 */
export function postUrl(path, { campaign = 'organic', content, source = 'tiktok' } = {}) {
  const clean = String(path ?? '').replace(/^\/+/, '');
  const p = new URLSearchParams({
    utm_source: source,
    utm_medium: 'social',
    utm_campaign: campaign,
  });
  if (content) p.set('utm_content', String(content));
  return `${ORIGIN}${clean ? `/${clean}` : ''}?${p.toString()}`;
}

export const slugFor = (sel) =>
  `${sel.ka.name}-vs-${sel.kb.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ---- assets ----
const b64 = (p) => readFileSync(p).toString('base64');
export function fonts() {
  return {
    R: b64(
      join(ROOT, 'node_modules/@expo-google-fonts/righteous/400Regular/Righteous_400Regular.ttf'),
    ),
    F: b64(join(ROOT, 'assets/fonts/Flame-Bold.ttf')),
    FR: b64(join(ROOT, 'assets/fonts/Flame-Regular.ttf')),
    S: b64(join(ROOT, 'assets/fonts/FlameSans-Regular.ttf')),
  };
}
export async function imgDataUri(src) {
  if (!src) return null;
  try {
    const r = await fetch(src);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const mime = src.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}
export const portraitDataUri = (hero) =>
  imgDataUri(hero.portrait_url || hero.image_url || hero.image_md_url);

export const COLORS = {
  O: '#e8823a',
  T: '#37a3c4',
  GOLD: '#e0a83e',
  CREAM: '#f5ebdc',
  NAVY: '#06121a',
};
export const grainUri = () =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}`;
export const fontFace = (F) =>
  `@font-face{font-family:'R';src:url(data:font/ttf;base64,${F.R});}@font-face{font-family:'F';src:url(data:font/ttf;base64,${F.F});}@font-face{font-family:'FR';src:url(data:font/ttf;base64,${F.FR});}@font-face{font-family:'S';src:url(data:font/ttf;base64,${F.S});}`;

// Shared 1080x1350 carousel slide shell (navy brand background + footer). Default
// text is the regular Flame weight ('FR'); use class="pop" for the loud, bold
// numbers only. Callers supply `inner` (absolutely-positioned content).
export const slideCss = (F) => {
  const { O, T, GOLD, CREAM, NAVY } = COLORS;
  return `${fontFace(F)}
*{margin:0;padding:0;box-sizing:border-box;}html,body{width:1080px;height:1350px;overflow:hidden;background:${NAVY};font-family:'FR';color:${CREAM};}
.page{position:relative;width:1080px;height:1350px;overflow:hidden;background:radial-gradient(60% 44% at 50% 32%, rgba(224,168,62,.12), transparent 62%), radial-gradient(120% 90% at 50% 8%, #12242f, ${NAVY} 72%);}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle, rgba(224,168,62,.10) 1.3px, transparent 1.9px);background-size:30px;-webkit-mask-image:radial-gradient(130% 100% at 50% 40%, transparent 42%, #000);opacity:.55;}
.grain{position:absolute;inset:0;background-image:url("${grainUri()}");background-size:340px;opacity:.05;mix-blend-mode:overlay;}
.foot{position:absolute;bottom:46px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:16px;opacity:.9;}
.foot .wm{font-family:'R';font-size:40px;color:${CREAM};}.foot .at{font-family:'FR';font-size:26px;color:${GOLD};letter-spacing:1px;}
.g{color:${GOLD};}.o{color:${O};}.t{color:${T};}
.sqc{position:relative;border-radius:23%/17%;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.6);}
.sqc img{width:100%;height:100%;object-fit:cover;}.sqc img.flip{transform:scaleX(-1);}.sqc .glare{position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.13),transparent 40%);}
.stroke{-webkit-text-stroke:3px ${NAVY};paint-order:stroke fill;}
.pop{font-family:'F';-webkit-text-stroke:7px ${NAVY};paint-order:stroke fill;}
/* centered content band: fills the space between the top margin and the footer,
   vertically centred, so info slides never leave dead space at the bottom */
.body{position:absolute;left:0;right:0;top:64px;bottom:168px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 60px;text-align:center;}
.h1{font-size:64px;letter-spacing:5px;color:${GOLD};margin:0 0 60px 0;-webkit-text-stroke:3px ${NAVY};paint-order:stroke fill;}
.full{width:100%;}`;
};
export const slide = (F, inner, extra = '') =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${slideCss(F)}${extra}</style></head><body><div class="page"><div class="dots"></div><div class="grain"></div>${inner}<div class="foot"><span class="wm">mythique</span><span class="at">@mythiqueapp</span></div></div></body></html>`;

async function launchChrome() {
  const pw = await import('playwright-core');
  const opts = process.env.PW_CHROME
    ? { executablePath: process.env.PW_CHROME }
    : { channel: 'chrome' };
  return pw.chromium.launch({ ...opts, args: ['--no-sandbox'] });
}

// Screenshot a full-page HTML to PNG (for carousel slides).
export async function renderPng(html, outPath, width, height) {
  const browser = await launchChrome();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath });
  await browser.close();
}

// Record an animated HTML page to mp4 (for reels). Requires ffmpeg.
export async function renderVideo(html, outMp4, workDir, waitMs = 13300) {
  const { execFileSync } = await import('node:child_process');
  const browser = await launchChrome();
  // Playwright's recorder is a capped-bitrate VP8 test tool — recorded 1:1 it
  // smears fine text (~2Mbps). Supersample: CSS-zoom the page 2x so the layout
  // genuinely fills a 2160x3840 viewport (the recorder captures CSS pixels —
  // deviceScaleFactor is ignored), record at that size, then downscale to
  // 1080x1920 with lanczos at crf 18. The downscale averages 4 source pixels
  // per output pixel, recovering the edges the recorder blurred.
  const ctx = await browser.newContext({
    viewport: { width: 2160, height: 3840 },
    recordVideo: { dir: workDir, size: { width: 2160, height: 3840 } },
  });
  const page = await ctx.newPage();
  const zoomed = html.replace('</head>', '<style>html{zoom:2}</style></head>');
  await page.setContent(zoomed, { waitUntil: 'networkidle' });
  await page.waitForTimeout(waitMs);
  await page.close();
  await ctx.close();
  await browser.close();
  const webm = join(
    workDir,
    readdirSync(workDir).find((f) => f.endsWith('.webm')),
  );
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  execFileSync(
    ffmpeg,
    [
      '-y',
      '-i',
      webm,
      '-vf',
      'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '18',
      '-movflags',
      '+faststart',
      outMp4,
    ],
    { stdio: 'ignore' },
  );
}
