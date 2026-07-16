// Pure builder for the static "battle" ad-landing page — the instant-paint
// destination for paid social traffic (see docs/marketing/utm-attribution.md).
//
// Why this page exists: a TikTok/IG click lands in a slow in-app WebView on
// cellular; booting the full SPA there loses most visitors before first paint
// (~5% click→arrival measured on the July promotes). This page is a few KB of
// server-rendered HTML — portraits, live tally, two vote buttons — that paints
// in well under a second. The visitor votes FIRST (a real vote, cast against
// the anon-granted cast_matchup_vote_v2 RPC with the same voter-key handoff the
// app uses), then opts into the app via the CTA — already invested. Commitment
// before friction, not friction before commitment.
//
// Kept free of runtime deps so it's unit-testable (__tests__/api/battlePage.test.ts)
// and mirrors the shareMeta/botPage builder convention.
import { SITE_URL } from '../../src/constants/site';
import { escapeHtml } from './shareMeta';

export type BattleHero = {
  id: string;
  name: string;
  publisher: string | null;
  portrait_url: string | null;
  image_url: string | null;
};

export type BattleTally = { votesA: number; votesB: number; total: number };

export type BattlePageInput = {
  a: BattleHero;
  b: BattleHero;
  tally: BattleTally;
  /** Sanitized utm_* query-string suffix (no leading &), e.g.
   *  "utm_source=tiktok&utm_medium=paid&utm_campaign=x". Empty when untagged. */
  utmQuery: string;
  /** Supabase project URL + publishable key for the inline vote call. These are
   *  the same EXPO_PUBLIC_* values already shipped in every client bundle. */
  supabaseUrl: string;
  supabaseKey: string;
};

const portrait = (h: BattleHero): string | null => h.portrait_url ?? h.image_url;

/** The /compare deep-link the CTA points at, carrying the UTM tags through so
 *  the SPA's first-touch capture attributes the session to the campaign. */
export function compareHref(a: string, b: string, utmQuery: string): string {
  const base = `/compare/${encodeURIComponent(a)}/${encodeURIComponent(b)}`;
  return utmQuery ? `${base}?${utmQuery}` : base;
}

/** Keep only utm_* params (and cap length) from a raw query object — the page
 *  echoes these into links and must never reflect arbitrary input. */
export function sanitizeUtmQuery(query: Record<string, string | string[] | undefined>): string {
  const keep = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const parts: string[] = [];
  for (const k of keep) {
    const v = query[k];
    if (typeof v === 'string' && v.trim()) {
      parts.push(`${k}=${encodeURIComponent(v.trim().slice(0, 120))}`);
    }
  }
  return parts.join('&');
}

export function buildBattleHtml(input: BattlePageInput): string {
  const { a, b, tally, utmQuery } = input;
  const nameA = escapeHtml(a.name);
  const nameB = escapeHtml(b.name);
  const title = `${nameA} vs ${nameB} — who wins?`;
  const cta = escapeHtml(compareHref(a.id, b.id, utmQuery));
  const ogImage = `${SITE_URL}/api/og?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}`;
  const canonical = `${SITE_URL}/compare/${encodeURIComponent(a.id)}/${encodeURIComponent(b.id)}`;
  const imgA = portrait(a);
  const imgB = portrait(b);

  // Fighter card: portrait (or an initial-letter plate when artless) + name.
  // The WHOLE card is the vote button — biggest possible tap target.
  const card = (h: BattleHero, name: string, img: string | null, side: 'a' | 'b') => `
  <button class="fighter" id="f${side}" data-pick="${escapeHtml(h.id)}" aria-label="Vote ${name}">
    ${
      img
        ? `<img src="${escapeHtml(img)}" alt="${name}" width="164" height="205" loading="eager" decoding="async">`
        : `<div class="noart">${escapeHtml(h.name.charAt(0).toUpperCase())}</div>`
    }
    <span class="fname">${name}</span>
    ${h.publisher ? `<span class="fpub">${escapeHtml(h.publisher)}</span>` : ''}
    <span class="votecta">TAP TO VOTE</span>
  </button>`;

  // Vote data + the inline caster. JSON-embedded values are built from
  // sanitized/known-safe inputs; </script> breakout is prevented by escaping
  // forward slashes in the JSON payload.
  const boot = JSON.stringify({
    a: a.id,
    b: b.id,
    va: tally.votesA,
    vb: tally.votesB,
    url: input.supabaseUrl,
    key: input.supabaseKey,
    cta: compareHref(a.id, b.id, utmQuery),
  }).replace(/\//g, '\\/');

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b1820">
<meta name="color-scheme" content="dark">
<title>${title}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mythique">
<meta property="og:title" content="${title}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://res.cloudinary.com">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{height:100%}
body{background:linear-gradient(#0d1f2b,#0b1820 55%);color:#f5ebdc;
  font:16px/1.4 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:100svh;padding:22px 16px calc(22px + env(safe-area-inset-bottom));text-align:center}
.brand{font-weight:800;font-size:15px;letter-spacing:.24em;color:#e0a83e;margin-bottom:14px}
h1{font-size:clamp(26px,7.5vw,40px);font-weight:900;letter-spacing:-.5px;margin-bottom:4px}
.sub{color:#9db4c4;font-size:13.5px;margin-bottom:22px}
.arena{display:flex;align-items:stretch;gap:10px;width:100%;max-width:430px}
.fighter{flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;
  background:linear-gradient(180deg,#12283a,#0e1f2d);border:1.5px solid rgba(246,237,221,.12);
  border-radius:18px;padding:14px 10px 12px;color:inherit;font:inherit;cursor:pointer}
.fighter img,.noart{width:100%;max-width:164px;aspect-ratio:4/5;object-fit:cover;
  border-radius:12px;background:#0b1820}
.noart{display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:900;color:#e0a83e}
.fname{font-weight:800;font-size:16.5px;line-height:1.15}
.fpub{color:#9db4c4;font-size:11.5px}
.votecta{margin-top:2px;background:#e0a83e;color:#3a2708;font-weight:800;font-size:11.5px;
  letter-spacing:.08em;border-radius:999px;padding:6px 13px}
.vs{align-self:center;font-weight:900;font-size:19px;color:#e0a83e;padding:0 2px}
.fighter.picked{border-color:#e0a83e;box-shadow:0 0 0 2px rgba(224,168,62,.35)}
.fighter.dim{opacity:.45}
.fighter:disabled{cursor:default}
#result{width:100%;max-width:430px;margin-top:18px;display:none}
#result.show{display:block}
.bar{height:14px;border-radius:999px;background:#12283a;overflow:hidden;display:flex}
.bar i{display:block;height:100%;background:#e0a83e;transition:width .6s ease}
.split{display:flex;justify-content:space-between;color:#9db4c4;font-size:12.5px;margin-top:6px}
.split b{color:#f5ebdc}
#go{display:none;margin-top:18px;background:#e0a83e;color:#3a2708;font-weight:800;font-size:16px;
  border-radius:999px;padding:15px 30px;text-decoration:none}
#go.show{display:inline-block}
.foot{color:rgba(157,180,196,.55);font-size:11px;margin-top:26px;max-width:430px}
.foot a{color:rgba(157,180,196,.8)}
</style>
</head><body>
<div class="brand">MYTHIQUE</div>
<h1>Who wins?</h1>
<p class="sub">${escapeHtml(
    tally.total > 0
      ? `${tally.total.toLocaleString('en-US')} fans have picked a side — vote to see the split`
      : 'Cast the first vote and start the argument',
  )}</p>
<div class="arena">
  ${card(a, nameA, imgA, 'a')}
  <span class="vs">VS</span>
  ${card(b, nameB, imgB, 'b')}
</div>
<div id="result">
  <div class="bar"><i id="fill" style="width:50%"></i></div>
  <div class="split"><span><b id="pa">–</b> ${nameA}</span><span><b id="pb">–</b> ${nameB}</span></div>
</div>
<a id="go" href="${cta}">See the full battle →</a>
<p class="foot">Live community vote on <a href="${cta}">mythique.app</a> · Unofficial fan encyclopedia — characters © their respective owners.</p>
<script>
(function(){
  var D=JSON.parse('${boot}');
  // Same voter key the app uses (AsyncStorage on web = raw localStorage), so
  // this vote is already "yours" when the CTA lands in the SPA.
  var vk;try{vk=localStorage.getItem('mythique.voterKey');
    if(!vk||vk.length<8){vk='vk_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);
      localStorage.setItem('mythique.voterKey',vk);}}catch(e){vk='vk_'+Math.random().toString(36).slice(2,14);}
  function vote(pick){
    var va=D.va+(pick===D.a?1:0), vb=D.vb+(pick===D.b?1:0), t=va+vb;
    document.getElementById('fill').style.width=Math.round(va/t*100)+'%';
    document.getElementById('pa').textContent=Math.round(va/t*100)+'%';
    document.getElementById('pb').textContent=Math.round(vb/t*100)+'%';
    document.getElementById('result').className='show';
    document.getElementById('go').className='show';
    try{fetch(D.url+'/rest/v1/rpc/cast_matchup_vote_v2',{method:'POST',keepalive:true,
      headers:{apikey:D.key,'content-type':'application/json'},
      body:JSON.stringify({p_a:D.a,p_b:D.b,p_picked:pick,p_voter_key:vk})}).catch(function(){});}catch(e){}
  }
  ['fa','fb'].forEach(function(id){
    var el=document.getElementById(id);
    el.addEventListener('click',function(){
      if(el.disabled)return;
      el.className='fighter picked';
      var other=document.getElementById(id==='fa'?'fb':'fa');
      other.className='fighter dim';
      el.disabled=true;other.disabled=true;
      vote(el.getAttribute('data-pick'));
    });
  });
})();
</script>
</body></html>`;
}
