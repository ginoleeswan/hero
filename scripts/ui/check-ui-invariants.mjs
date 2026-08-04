#!/usr/bin/env node
// UI invariants checker — the tripwire for four rules that are invisible when
// broken.
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

    if (ICON.test(el.inner) && !HAS_TEXT.test(el.inner)) {
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
