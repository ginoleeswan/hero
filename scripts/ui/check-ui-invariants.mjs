#!/usr/bin/env node
// UI invariants checker — the tripwire for rules that are invisible (or too
// easy to miss) when broken.
//
// Every rule here was a real, shipped bug found by hand. None of them changes
// how anything renders when violated, which is exactly why they came back
// repeatedly and why they belong in CI rather than in a reviewer's head:
//
//   1. TEXT CONTRAST — a colour below the 4.5:1 floor. The trap is that the
//      same alpha behaves completely differently per canvas: beige at 0.6a on
//      ink is 6.13:1, navy at 0.6a on beige is 3.33:1. `opacity` on a text
//      style composites identically and is easy to miss.
//   2. UNNAMED CONTROLS — a Pressable wrapping only an icon announces as an
//      unnamed button. The glyph name is not a label.
//   3. SMALL TARGETS — a styled control under 44pt with no hitSlop.
//   4. aria-label IN A SHARED FILE — a web-only prop React Native ignores
//      outright, so the control is unnamed on native while looking labelled.
//
// Deliberate exceptions are declared in ALLOW below, with a reason. An empty
// allowlist entry is not possible: if it needs an exception, it needs a reason.
//
// Run locally: yarn check:ui
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const FLOOR = 4.5;

// ── canvases ────────────────────────────────────────────────────────────────
const BEIGE = [0xf5, 0xeb, 0xdc];
const INK = [0x0b, 0x18, 0x20];

const lin = (c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => {
  const [hi, lo] = L(a) > L(b) ? [L(a), L(b)] : [L(b), L(a)];
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

/**
 * Which canvas is this ink meant for? A light ink is for the dark stage and a
 * dark ink is for paper — the direction is unambiguous even though the surface
 * isn't declared in the style.
 */
const canvasFor = (rgb) => (rgb[0] + rgb[1] + rgb[2] > 380 ? INK : BEIGE);

const parseColor = (raw) => {
  const s = raw.trim().replace(/^['"]|['"]$/g, '');
  let m = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (m) return [[0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)), 1];
  m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(s);
  if (m) return [[+m[1], +m[2], +m[3]], m[4] === undefined ? 1 : +m[4]];
  return null;
};

// ── deliberate exceptions ───────────────────────────────────────────────────
// `file:styleKeyOrLine` → why. Keep these few and keep the reasons real.
const ALLOW = {
  'app/(tabs)/explore.web.tsx:backdropName':
    'Colossal ghost watermark behind the feed — decorative type, exempt under WCAG 1.4.3.',
  'src/components/web/home/HomeFooter.tsx:wordmarkBackdrop':
    'Ghost wordmark behind the footer — decorative.',
  'src/components/web/home/ThisMonthInHistory.tsx:ghostNumeral':
    '210px ghost numeral behind the section — decorative.',
  // The canvas heuristic reads #E8543B as dark ink and measures it against
  // beige. It actually sits on the card's dark bottom scrim over a portrait,
  // where it is 4.94:1. A style cannot declare its surface, so this is the one
  // class the check has to be told about.
  'src/components/home/HallOfInfamy.tsx:feared':
    'Sits on the card’s dark scrim over the portrait — 4.94:1 against deep ink, not beige.',
  'src/components/web/home/HallOfInfamy.tsx:feared':
    'Sits on the card’s dark scrim over the portrait — 4.94:1 against deep ink, not beige.',
};

// ── file collection ─────────────────────────────────────────────────────────
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(full, out);
    } else if (e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
};

const rel = (f) => f.slice(ROOT.length + 1);
const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'app'))]
  .map(rel)
  // The admin command centre is an internal, full-ink tool — out of scope.
  .filter((f) => !f.includes('/admin/'))
  .sort();

const failures = [];
const fail = (file, line, rule, detail) => failures.push({ file, line, rule, detail });

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** Leaf style objects: `key: { ...no nested braces... }`. */
function* leaves(src) {
  for (const m of src.matchAll(/\b([A-Za-z_]\w*)\s*:\s*\{([^{}]*)\}/g)) {
    yield { key: m[1], body: m[2], line: lineOf(src, m.index) };
  }
}

/** Walk a JSX element opening at `i`, returning its attributes and children. */
function element(src, i) {
  let depth = 0;
  let close = -1;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) {
      close = j;
      break;
    }
  }
  if (close < 0) return null;
  const attrs = src.slice(i, close);
  if (src[close - 1] === '/') return { attrs, inner: '' };
  const tag = /^<(\w+)/.exec(src.slice(i))?.[1];
  if (!tag) return null;
  let d = 1;
  let j = close + 1;
  while (j < src.length && d > 0) {
    if (src.startsWith(`</${tag}`, j)) d--;
    else if (src.startsWith(`<${tag}`, j)) d++;
    j++;
  }
  return { attrs, inner: src.slice(close + 1, j - 1) };
}

const CONTROL = /<(Pressable|TouchableOpacity|AnimatedPressable|PressScale)\b/g;
const ICON = /<(Ionicons|MaterialCommunityIcons|MaterialIcons|Feather|FontAwesome\w*|SymbolView)\b/;
const HAS_TEXT = /<Text\b/;
// A capitalized CUSTOM component inside the control (IssueInfo, HeroImage…)
// almost certainly renders text of its own — "wraps only an icon" must mean
// ONLY an icon, or a modal wrapper whose content lives one component down
// gets flagged as an unnamed icon button.
const HAS_COMPONENT =
  /<(?!(?:Ionicons|MaterialCommunityIcons|MaterialIcons|Feather|FontAwesome\w*|SymbolView|View|ScrollView|Image|ImageBackground|LinearGradient|Animated|Svg|Path|Rect|Circle|Defs|Stop|RadialGradient|Text)\b)[A-Z]\w*/;

for (const file of files) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  // "Shared" means it can render on native. Web-only-ness comes from three
  // places, not just the extension: the .web.tsx pair half, anything under
  // src/components/web/, and .dom.tsx components (which run inside a real DOM —
  // a WebView on native, an iframe on web).
  const shared =
    !file.endsWith('.web.tsx') &&
    !file.endsWith('.dom.tsx') &&
    !file.startsWith('src/components/web/');

  // ── 1. contrast ──
  for (const { key, body, line } of leaves(src)) {
    if (!/font/.test(body)) continue; // text styles only
    // Quoted first: an rgba() value contains commas, so a bare [^,]+ capture
    // truncates it to "'rgba(41" and silently parses as nothing — which had
    // this very check passing every rgba colour in the codebase.
    const cm = /(?<![a-zA-Z])color:\s*('[^']*'|"[^"]*"|[^,\n}]+)/.exec(body);
    if (!cm) continue;
    const parsed = parseColor(cm[1]);
    if (!parsed) continue; // a named token — trusted, they carry measured ratios
    const [rgb, alpha] = parsed;
    const om = /\bopacity:\s*([\d.]+)/.exec(body);
    const eff = alpha * (om ? +om[1] : 1);
    if (eff <= 0.1) continue; // ghost type; see ALLOW for the ones that matter
    const bg = canvasFor(rgb);
    const r = ratio(over(rgb, eff, bg), bg);
    if (r >= FLOOR) continue;
    if (ALLOW[`${file}:${key}`]) continue;
    fail(file, line, 'contrast', `${key} is ${r.toFixed(2)}:1 (floor ${FLOOR})`);
  }

  // ── 2 + 3. controls ──
  const sizes = new Map();
  for (const { key, body } of leaves(src)) {
    const w = /\bwidth:\s*([\d.]+)/.exec(body);
    const h = /\bheight:\s*([\d.]+)/.exec(body);
    if (w && h) sizes.set(key, [+w[1], +h[1]]);
  }
  for (const m of src.matchAll(CONTROL)) {
    const el = element(src, m.index);
    if (!el || !/onPress/.test(el.attrs)) continue;
    const line = lineOf(src, m.index);

    const rnLabel = /accessibilityLabel/.test(el.attrs);
    const domLabel = /aria-label/.test(el.attrs);

    if (ICON.test(el.inner) && !HAS_TEXT.test(el.inner) && !HAS_COMPONENT.test(el.inner)) {
      // On web either prop names the control; on native only accessibilityLabel does.
      if (!rnLabel && !(domLabel && !shared)) {
        fail(file, line, 'unnamed-control', `${m[1]} wraps only an icon`);
      }
    }

    // Scoped to the element, so `aria-label` sitting redundantly ALONGSIDE
    // accessibilityLabel isn't flagged — that's noise, not a bug. The bug is
    // aria-label as the ONLY name in a file that can render on native.
    if (shared && domLabel && !rnLabel) {
      fail(file, line, 'web-only-prop', 'aria-label is the only name and does nothing on native');
    }

    if (!/hitSlop/.test(el.attrs)) {
      for (const k of el.attrs.matchAll(/(?:styles|s|c)\.([A-Za-z_]\w*)/g)) {
        const size = sizes.get(k[1]);
        if (!size) continue;
        const [w, h] = size;
        if (w < 44 || h < 44) {
          fail(file, line, 'small-target', `${k[1]} is ${w}x${h}, under 44 with no hitSlop`);
        }
        break;
      }
    }
  }
}

// ── 4½. no emoji ────────────────────────────────────────────────────────────
// UI copy uses vector icons and typography, never emoji pictographs — emoji
// render as coloured glyphs that ignore the palette, differ per OS, and read
// as filler. Text-presentation symbols the app uses deliberately are allowed
// by character; content that is genuinely MADE of emoji (share payloads
// pasted into other apps, social captions) is allowed by file, with a reason.
// Scans .ts as well as .tsx, and includes the admin console — the rule is
// about the product's voice, not one surface.
const EMOJI_FILE_ALLOW = {
  'src/lib/game/shareGrid.ts':
    'The daily-game share payload — coloured squares ARE the feature, pasted into iMessage.',
  'src/lib/social/tiktokCsv.ts':
    'Social-caption content for the content factory — marketing copy, not app UI.',
};
const EMOJI_CHAR_ALLOW = new Set([
  '★', // ratings — a text-presentation star, monochrome
  '✓', // checkmarks in dense chrome
  '❖', // the biography colophon ornament
  '♪', // music-note in admin social labels
  '♥', // card-suit heart, text presentation
]);
const isPictograph = (o) =>
  (o >= 0x2600 && o <= 0x27bf) ||
  (o >= 0x1f000 && o <= 0x1faff) ||
  (o >= 0x1f1e6 && o <= 0x1f1ff) ||
  o === 0x2b50 ||
  o === 0x2b55 ||
  o === 0xfe0f;

const walkTs = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walkTs(full, out);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
};

for (const file of [...walkTs(join(ROOT, 'src')), ...walkTs(join(ROOT, 'app'))].map(rel).sort()) {
  if (EMOJI_FILE_ALLOW[file]) continue;
  const src = readFileSync(join(ROOT, file), 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const ch of lines[i]) {
      const o = ch.codePointAt(0);
      if (o < 0x2000 || EMOJI_CHAR_ALLOW.has(ch)) continue;
      if (isPictograph(o)) {
        fail(
          file,
          i + 1,
          'emoji',
          `"${ch}" (U+${o.toString(16).toUpperCase()}) — use a vector icon or typography`,
        );
        break; // one report per line is enough
      }
    }
  }
}

// ── 4¾. no Flame-Bold ───────────────────────────────────────────────────────
// Headings use `Flame-Regular`. The bold cut's strokes are thick enough that
// the counters close up at heading sizes and the word reads as a shape rather
// than as letters — worse the larger it gets, which is exactly where headings
// live. The face is no longer registered in either root layout or embedded by
// the expo-font plugin, so a reference to it silently falls back to the system
// font; this catches it as a failure instead. (The .ttf stays in assets for
// the social content factory, which renders images, not app UI.)
for (const file of [...walkTs(join(ROOT, 'src')), ...walkTs(join(ROOT, 'app'))].map(rel).sort()) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Flame-Bold')) {
      fail(file, i + 1, 'flame-bold', 'use Flame-Regular — the bold cut is too heavy to read');
    }
  }
}

// ── 4⅞. a rounded cap must overlap by at least its radius ───────────────────
// The beige sheet's seam: a cap with rounded top corners pulled up over a dark
// stage by a negative marginTop. Its corner cut-outs show whatever is BEHIND
// them, and behind the cap is the list's content background — which on these
// screens is beige. Overlap by less than the radius and the bottom of each
// curve sits over beige rather than over the stage, so the cut-out is filled in
// and the curve looks truncated where it meets the straight edge.
//
// Five screens shipped with overlaps of 14–18 against a 24 radius, and
// character/[id] — the only one that tied the two together — was the only seam
// that looked right. Use SEAM from constants/tokens rather than a literal pair.
// Values may be literals, `SEAM.radius`/`SEAM.overlap`, or a numeric const
// declared in the same file (`const SHEET_OVERLAP = 28`). Resolving them is not
// a nicety: the moment the SEAM token existed, a literal-only check would have
// waved through `borderTopLeftRadius: SEAM.radius` beside `marginTop: -16` —
// the exact bug, wearing the fix as a disguise.
const SEAM_VALUES = { 'SEAM.radius': 24, 'SEAM.overlap': 24 };
const numeric = (raw, consts) => {
  const t = raw.trim();
  if (/^\d+(?:\.\d+)?$/.test(t)) return +t;
  if (t in SEAM_VALUES) return SEAM_VALUES[t];
  if (t in consts) return consts[t];
  return null;
};

for (const file of files) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  const consts = {};
  for (const c of src.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*(\d+(?:\.\d+)?)\s*;/g)) {
    consts[c[1]] = +c[2];
  }
  // Style objects are `name: { ... }`; scan each for the pair.
  for (const m of src.matchAll(/(\w+):\s*\{([^{}]*)\}/g)) {
    const body = m[2];
    const rRaw = body.match(/borderTopLeftRadius:\s*([\w.]+)/);
    const pRaw = body.match(/marginTop:\s*-\s*([\w.]+)/);
    if (!rRaw || !pRaw) continue;
    const radius = [numeric(rRaw[1], consts)];
    const pull = [numeric(pRaw[1], consts)];
    if (radius[0] === null || pull[0] === null) continue;
    if (+pull[0] < +radius[0]) {
      fail(
        file,
        lineOf(src, m.index),
        'seam-overlap',
        `${m[1]}: overlaps ${pull[0]} but rounds ${radius[0]} — the corner cut-out shows the sheet's own background for the last ${(+radius[0] - +pull[0]).toFixed(0)}pt`,
      );
    }
  }
}

// ── 4^15/16. every route renders something ─────────────────────────────────
// A route file with no default export is not a compile error, not a lint
// error, and not a test failure — expo-router only discovers it at navigation
// time, on a device. A scripted edit truncated app/compare/pick.tsx to its
// import block and it went through typecheck, lint, tests and CI untouched:
// the Battle Builder had become an empty module, and the only symptom would
// have been a red screen on tapping Fight.
//
// A route either declares a screen or re-exports one. Layouts and the html
// shell are not routes.
const ROUTE_SKIP = /(^|\/)(_layout|\+html)\.(tsx|ts)$/;
for (const file of files) {
  if (!file.startsWith('app/')) continue;
  if (ROUTE_SKIP.test(file)) continue;
  const src = readFileSync(join(ROOT, file), 'utf8');
  if (/export\s+default/.test(src)) continue;
  if (/export\s*\{\s*default[\s,}]/.test(src)) continue; // re-export shim
  fail(file, 1, 'route-no-screen', 'route file exports no screen — expo-router will fail at navigation time');
}

// ── 5. the design-scale ratchet ─────────────────────────────────────────────
// The other four rules are absolutes: a violation is a bug, so it fails. Scale
// drift is different — there are ~1,000 radius call sites and 52 distinct font
// sizes, many of them deliberate (a 2px bar, a 26px squircle tuned to its art).
// Failing on all of them would mean turning the rule off, which is how the
// last three token files ended up decorative.
//
// So this is a RATCHET. It counts off-scale literals and compares against a
// committed baseline. The count may fall; it may not rise. New code has to
// pick a step from the scale, existing code converges when someone is already
// in the file, and the number only travels one direction.
//
// When it falls, the check tells you to re-baseline — that is the tightening.
const RADIUS_SCALE = new Set([4, 8, 12, 16, 20, 24, 999]);
const FONT_SCALE = new Set([10, 11, 12, 13, 13.5, 14.5, 15, 18, 23, 30, 38, 46]);

const offScale = { radius: [], font: [] };
for (const file of files) {
  const src = readFileSync(join(ROOT, file), 'utf8');
  for (const m of src.matchAll(/\bborderRadius:\s*([0-9.]+)/g)) {
    if (!RADIUS_SCALE.has(+m[1])) offScale.radius.push(`${file}:${lineOf(src, m.index)} ${m[1]}`);
  }
  for (const m of src.matchAll(/\bfontSize:\s*([0-9.]+)/g)) {
    if (!FONT_SCALE.has(+m[1])) offScale.font.push(`${file}:${lineOf(src, m.index)} ${m[1]}`);
  }
}

const BASELINE_PATH = 'scripts/ui/design-baseline.json';
let baseline = null;
try {
  baseline = JSON.parse(readFileSync(join(ROOT, BASELINE_PATH), 'utf8'));
} catch {
  // No baseline yet — the writer below prints one to adopt.
}

const counts = { radius: offScale.radius.length, font: offScale.font.length };

if (!baseline) {
  console.error(
    `No design baseline found. Create ${BASELINE_PATH} with:\n` +
      `${JSON.stringify(counts, null, 2)}\n`,
  );
  process.exit(1);
}

for (const kind of ['radius', 'font']) {
  if (counts[kind] > baseline[kind]) {
    const added = counts[kind] - baseline[kind];
    console.error(
      `Design scale ratchet: ${added} new off-scale ${kind} value(s) ` +
        `(${baseline[kind]} → ${counts[kind]}).\n\n` +
        `  Pick a step from src/design — ${
          kind === 'radius' ? 'RADIUS' : 'DISPLAY / BODY / LABEL'
        }.\n` +
        `  If the value is genuinely deliberate, raise the baseline in ${BASELINE_PATH}\n` +
        `  in the same commit, so the exception is reviewed rather than absorbed.\n\n` +
        `  Off-scale ${kind} values now present:\n` +
        offScale[kind]
          .slice(0, 40)
          .map((s) => `    ${s}`)
          .join('\n') +
        (offScale[kind].length > 40 ? `\n    …and ${offScale[kind].length - 40} more` : ''),
    );
    process.exit(1);
  }
}

const tightened = ['radius', 'font'].filter((k) => counts[k] < baseline[k]);
if (tightened.length) {
  console.log(
    `Design scale ratchet TIGHTENED — update ${BASELINE_PATH}:\n` +
      `${JSON.stringify(counts, null, 2)}`,
  );
}

if (failures.length) {
  const byRule = failures.reduce((a, f) => ((a[f.rule] ??= []).push(f), a), {});
  console.error(`UI invariants check failed (${failures.length}):\n`);
  for (const [rule, list] of Object.entries(byRule)) {
    console.error(`  ${rule} (${list.length})`);
    for (const f of list) console.error(`    ${f.file}:${f.line}  ${f.detail}`);
    console.error('');
  }
  console.error(
    'These never look broken on screen — see the contrast, touch-target and\n' +
      'control-label sections of docs/features/platform-and-motion.md. If an\n' +
      'exception is genuinely right, add it to ALLOW in this script with a reason.',
  );
  process.exit(1);
}
console.log(`UI invariants check passed — ${files.length} files scanned.`);
