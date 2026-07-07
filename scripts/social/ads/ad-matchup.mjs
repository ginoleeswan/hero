#!/usr/bin/env node
// Data-first "who would win" ad. Leans on the community vote split + the six-stat
// comparison, not on a copyrighted portrait. A face appears ONLY when the safety
// layer allows it (Tier C full / Tier A-B stylized); otherwise a name plate.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, makeSb, fonts, OUT_DIR, renderPng, STAT_KEYS, resolveManual, hydrate, slugFor } from '../lib.mjs';
import { safePortrait } from '../safety.mjs';
import { adShell } from './shell.mjs';
import { styleAttr } from './stylize.mjs';

const SIZES = { '1x1': [1080, 1080], '4x5': [1080, 1350], '9x16': [1080, 1920] };
const GOLD = '#e0a83e', ORANGE = '#e8823a', TEAL = '#4fb3d0', CREAM = '#f6eddd', MUTED = '#9db4c4';

const STAT_LABEL = { intelligence: 'INT', strength: 'STR', speed: 'SPD', durability: 'DUR', power: 'PWR', combat: 'CBT' };

function faceOrPlate(p, name, box, accent) {
  if (!p) {
    return `<div style="width:${box}px;height:${box}px;border-radius:26%;background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.01));border:2px solid ${accent};display:flex;align-items:center;justify-content:center;padding:0 6%;box-shadow:0 18px 44px -20px rgba(0,0,0,.7)"><span class="pop" style="font-size:${Math.round(box * 0.16)}px;color:${CREAM};line-height:1.02;text-align:center">${name}</span></div>`;
  }
  const st = p.stylize ? styleAttr('duotone') : '';
  return `<div class="styl" style="width:${box}px;height:${box}px;border-radius:26%;overflow:hidden;border:2px solid ${accent};box-shadow:0 18px 44px -20px rgba(0,0,0,.7)"><img src="${p.uri}" style="${st}"></div>`;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
  const wantSize = get('--size', '1x1');
  const sizes = wantSize === 'all' ? Object.keys(SIZES) : [wantSize];
  if (sizes.some((s) => !SIZES[s])) { console.error('--size:', Object.keys(SIZES).join(', '), 'or all'); process.exit(1); }
  const spec = get('--matchup', null);
  if (!spec) { console.error('Provide --matchup "A,B".'); process.exit(1); }

  const sb = makeSb(loadEnv());
  const sel = await resolveManual(sb, spec);
  const data = await hydrate(sb, sel);
  const [rawA, rawB] = await Promise.all([
    safePortrait(sel.ka, { context: 'ad' }),
    safePortrait(sel.kb, { context: 'ad' }),
  ]);
  // Matchup faces are all-or-nothing AND conservative: show real faces only when
  // BOTH sides are full-fidelity Tier C (public-domain/owned). Any S/A/B or mixed
  // → name plates for both. Keeps it symmetric and off the risky edge.
  const useFaces = rawA && rawB && !rawA.stylize && !rawB.stylize;
  const pa = useFaces ? rawA : null, pb = useFaces ? rawB : null;

  const dir = join(OUT_DIR, `ad-matchup-${slugFor(sel)}`);
  mkdirSync(dir, { recursive: true });

  for (const size of sizes) {
    const [w, h] = SIZES[size];
    const box = Math.round(w * 0.32);
    const barH = Math.round(h * 0.018);
    const statRows = STAT_KEYS.map((k) => {
      const a = sel.ka[k] ?? 0, b = sel.kb[k] ?? 0;
      const lead = a === b ? '' : a > b ? ORANGE : TEAL; // winner's number glows
      return `<div style="display:flex;align-items:center;gap:${Math.round(w * 0.018)}px;margin:${Math.round(h * 0.008)}px 0">
        <span class="pop" style="width:${Math.round(w * 0.08)}px;text-align:right;font-size:${Math.round(h * 0.026)}px;color:${lead === ORANGE ? ORANGE : CREAM}">${a}</span>
        <div style="flex:1;height:${barH}px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden;display:flex;flex-direction:row-reverse">
          <div style="width:${a}%;height:100%;background:${ORANGE};border-radius:99px"></div></div>
        <span style="width:${Math.round(w * 0.1)}px;text-align:center;font-family:'S';font-size:${Math.round(h * 0.018)}px;letter-spacing:.1em;color:${MUTED}">${STAT_LABEL[k]}</span>
        <div style="flex:1;height:${barH}px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden">
          <div style="width:${b}%;height:100%;background:${TEAL};border-radius:99px"></div></div>
        <span class="pop" style="width:${Math.round(w * 0.08)}px;text-align:left;font-size:${Math.round(h * 0.026)}px;color:${lead === TEAL ? TEAL : CREAM}">${b}</span></div>`;
    }).join('');

    const inner = `<div style="position:absolute;left:0;right:0;top:0;bottom:${Math.round(h * 0.12)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 ${Math.round(w * 0.06)}px">
      <div style="font-size:${Math.round(h * 0.036)}px;letter-spacing:.22em;color:${GOLD};margin-bottom:${Math.round(h * 0.028)}px">WHO WOULD WIN?</div>
      <div style="display:flex;align-items:center;gap:${Math.round(w * 0.05)}px;margin-bottom:${Math.round(h * 0.016)}px">
        ${faceOrPlate(pa, sel.ka.name, box, ORANGE)}
        <span class="pop" style="font-size:${Math.round(h * 0.055)}px;color:${GOLD}">VS</span>
        ${faceOrPlate(pb, sel.kb.name, box, TEAL)}</div>
      <div style="display:flex;justify-content:space-between;width:100%;max-width:${Math.round(w * 0.86)}px;font-family:'S';font-size:${Math.round(h * 0.024)}px;color:${CREAM};margin-bottom:${Math.round(h * 0.006)}px">
        <span style="color:${ORANGE}">${sel.ka.name}</span><span style="color:${TEAL}">${sel.kb.name}</span></div>
      <div style="width:100%;max-width:${Math.round(w * 0.86)}px;height:${Math.round(h * 0.05)}px;border-radius:12px;overflow:hidden;display:flex">
        <div style="width:${data.voteA}%;background:${ORANGE};display:flex;align-items:center;padding-left:18px"><span style="font-family:'FR';font-size:${Math.round(h * 0.03)}px;color:#3a1c08">${data.voteA}%</span></div>
        <div style="width:${data.voteB}%;background:${TEAL};display:flex;align-items:center;justify-content:flex-end;padding-right:18px"><span style="font-family:'FR';font-size:${Math.round(h * 0.03)}px;color:#082530">${data.voteB}%</span></div></div>
      <div style="font-size:${Math.round(h * 0.02)}px;color:${MUTED};margin:${Math.round(h * 0.008)}px 0 ${Math.round(h * 0.022)}px">the community vote${sel.total ? ` · ${sel.total} in` : ''}</div>
      <div style="width:100%;max-width:${Math.round(w * 0.86)}px">${statRows}</div>
      <div style="font-size:${Math.round(h * 0.03)}px;letter-spacing:.5px;margin-top:${Math.round(h * 0.03)}px"><span style="color:${MUTED}">cast your vote · </span><span class="g pop">mythique.app&thinsp;→</span></div>
    </div>`;

    await renderPng(adShell(fonts(), { w, h }, inner), join(dir, `${size}.png`), w, h);
    console.log(`  -> ${join(dir, `${size}.png`)}`);
  }

  writeFileSync(join(dir, 'caption.txt'), [
    `${sel.ka.name} vs ${sel.kb.name} — who wins? ⚔️`, ``,
    `The community says ${sel.ka.name} ${data.voteA}% · ${sel.kb.name} ${data.voteB}%. Settle it on mythique.app`, ``,
    `#whowouldwin #powerscaling #comics #anime #mythique`,
  ].join('\n'));
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
