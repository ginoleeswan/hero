// Parametric {w,h} brand shell for paid ad creative. Mirrors lib.mjs's slide()
// but is size-agnostic and always carries the legal disclaimer footer.
import { COLORS, grainUri, fontFace } from '../lib.mjs';
import { DISCLAIMER } from '../safety.mjs';
import { svgFilterDefs } from './stylize.mjs';

export function adShell(F, { w, h }, inner, extra = '') {
  const { GOLD, CREAM, NAVY } = COLORS;
  const css = `${fontFace(F)}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:${NAVY};font-family:'FR';color:${CREAM};}
.page{position:relative;width:${w}px;height:${h}px;overflow:hidden;background:radial-gradient(100% 58% at 50% -10%, rgba(224,168,62,.07), transparent 55%), linear-gradient(#0d1f2b, ${NAVY} 62%);}
.dots{position:absolute;inset:0;background-image:radial-gradient(circle, rgba(224,168,62,.09) 1.2px, transparent 1.8px);background-size:38px;-webkit-mask-image:radial-gradient(130% 100% at 50% 40%, transparent 52%, #000);opacity:.26;}
.grain{position:absolute;inset:0;background-image:url("${grainUri()}");background-size:340px;opacity:.05;mix-blend-mode:overlay;}
.foot{position:absolute;bottom:${Math.round(h * 0.035)}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:8px;opacity:.92;}
.foot .row{display:flex;align-items:center;gap:16px;}
.foot .wm{font-family:'R';font-size:${Math.round(h * 0.03)}px;color:${CREAM};}
.foot .at{font-family:'FR';font-size:${Math.round(h * 0.02)}px;color:${GOLD};letter-spacing:1px;}
.foot .disc{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:${Math.round(h * 0.014)}px;color:rgba(245,235,220,.55);text-align:center;padding:0 40px;letter-spacing:.3px;}
.g{color:${GOLD};}.pop{font-family:'FR';-webkit-text-stroke:${Math.round(h * 0.006)}px ${NAVY};paint-order:stroke fill;}
.styl img{width:100%;height:100%;object-fit:cover;}
${extra}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${svgFilterDefs()}<div class="page"><div class="dots"></div><div class="grain"></div>${inner}<div class="foot"><div class="row"><span class="wm">mythique</span><span class="at">@mythiqueapp</span></div><div class="disc">${DISCLAIMER}</div></div></div></body></html>`;
}
