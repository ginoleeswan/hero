'use dom';

import { useRouter } from 'expo-router';

const wordmark = require('../../../assets/hero-wordmark.svg');
const logoMark = require('../../../assets/hero-logo.svg');
const spiderman = require('../../../assets/images/spiderman.jpg');
const batman = require('../../../assets/images/batman.jpg');
const ironman = require('../../../assets/images/ironman.jpg');
const deadpool = require('../../../assets/images/deadpool.jpg');
const wolverine = require('../../../assets/images/wolverine.jpg');
const wonderWoman = require('../../../assets/images/wonder-woman.jpg');
const thor = require('../../../assets/images/thor.jpg');
const blackPanther = require('../../../assets/images/black-panther.jpg');
const docStrange = require('../../../assets/images/doctor-strange.jpg');
const hulk = require('../../../assets/images/hulk.jpg');
const screenshotHome = require('../../../assets/images/screenshots/home.PNG');
const screenshotSearch = require('../../../assets/images/screenshots/search.PNG');

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Righteous&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#0b1820; --surface:#142130; --card:#1a2d3e;
    --orange:#E77333; --yellow:#F9B222; --beige:#f5ebdc;
    --muted:#7a93a3; --border:#253d50; --radius:16px;
  }
  html {
    scroll-behavior: smooth;
    background: var(--bg); /* iOS Safari overscroll top area */
  }
  body {
    background: var(--bg); color: var(--beige);
    font-family: 'Poppins', sans-serif;
    overflow-x: hidden; -webkit-font-smoothing: antialiased;
    /* iOS Safari overscroll bottom area */
    overscroll-behavior-y: none;
  }
  nav {
    position: fixed; top:0; left:0; right:0; z-index:100;
    display:flex; align-items:center; justify-content:space-between;
    padding:20px 40px;
    background:linear-gradient(to bottom,rgba(11,24,32,0.95) 0%,transparent 100%);
  }
  .nav-brand { display:flex; align-items:center; gap:10px; }
  .nav-logo { height:32px; width:32px; }
  .nav-wordmark { height:22px; width:auto; }
  .nav-cta {
    background:var(--orange); color:#fff; font-family:'Righteous',sans-serif;
    font-size:14px; letter-spacing:0.5px; padding:10px 22px; border-radius:100px;
    border:none; cursor:pointer; transition:background 200ms,transform 150ms;
  }
  .nav-cta:hover { background:#f2813e; transform:translateY(-1px); }

  .hero {
    position:relative; min-height:100dvh;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    text-align:center; padding:120px 24px 80px; overflow:hidden;
  }
  .hero::before {
    content:''; position:absolute; inset:0;
    background:
      radial-gradient(ellipse 60% 50% at 20% 60%,rgba(231,115,51,0.18) 0%,transparent 70%),
      radial-gradient(ellipse 50% 40% at 80% 40%,rgba(21,161,171,0.15) 0%,transparent 70%),
      radial-gradient(ellipse 80% 80% at 50% 50%,rgba(249,178,34,0.06) 0%,transparent 60%);
    pointer-events:none;
  }
  .hero-collage { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
  .hero-card {
    position:absolute; border-radius:12px; overflow:hidden;
    box-shadow:0 8px 40px rgba(0,0,0,0.6); animation:float 6s ease-in-out infinite;
  }
  .hero-card img { width:100%; height:100%; object-fit:cover; display:block; }
  .hero-card::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(to bottom,transparent 40%,rgba(11,24,32,0.6) 100%);
  }
  .hc1  {width:120px;height:160px;top:14%;left:3%;  --rot:rotate(-8deg);animation-delay:0s;}
  .hc2  {width:100px;height:140px;top:55%;left:1%;  --rot:rotate(5deg); animation-delay:1.2s;}
  .hc3  {width:140px;height:190px;top:8%; left:12%; --rot:rotate(4deg); animation-delay:0.6s;}
  .hc4  {width:110px;height:150px;top:62%;left:11%; --rot:rotate(-6deg);animation-delay:2s;}
  .hc5  {width:100px;height:140px;top:30%;left:5%;  --rot:rotate(7deg); animation-delay:3s;}
  .hc6  {width:120px;height:160px;top:14%;right:3%; --rot:rotate(8deg); animation-delay:0.4s;}
  .hc7  {width:100px;height:140px;top:55%;right:1%; --rot:rotate(-5deg);animation-delay:1.6s;}
  .hc8  {width:140px;height:190px;top:8%; right:12%;--rot:rotate(-4deg);animation-delay:1s;}
  .hc9  {width:110px;height:150px;top:62%;right:11%;--rot:rotate(6deg); animation-delay:2.4s;}
  .hc10 {width:100px;height:140px;top:30%;right:5%; --rot:rotate(-7deg);animation-delay:3.4s;}
  @keyframes float {
    0%,100% { transform:var(--rot,rotate(0deg)) translateY(0); }
    50%      { transform:var(--rot,rotate(0deg)) translateY(-12px); }
  }
  .hero-content { position:relative; z-index:2; max-width:700px; }
  .hero-badge {
    display:inline-flex; align-items:center; gap:8px;
    background:rgba(249,178,34,0.12); border:1px solid rgba(249,178,34,0.3);
    color:var(--yellow); font-size:12px; font-weight:600; letter-spacing:1px;
    text-transform:uppercase; padding:6px 16px; border-radius:100px; margin-bottom:32px;
  }
  .hero-badge svg { width:14px; height:14px; }
  .hero-wordmark-large {
    width:min(520px,80vw); height:auto; margin-bottom:24px;
    filter:drop-shadow(0 4px 32px rgba(231,115,51,0.3));
  }
  .hero-tagline {
    font-family:'Righteous',sans-serif; font-size:clamp(18px,3vw,26px);
    color:var(--muted); letter-spacing:0.5px; margin-bottom:16px;
  }
  .hero-sub {
    font-size:clamp(15px,2vw,17px); color:var(--muted); line-height:1.7;
    max-width:480px; margin:0 auto 40px; font-weight:300;
  }
  .hero-ctas { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
  .btn-primary {
    display:inline-flex; align-items:center; gap:10px; background:var(--orange);
    color:#fff; font-family:'Righteous',sans-serif; font-size:16px;
    padding:14px 28px; border-radius:100px; border:none; cursor:pointer;
    text-decoration:none; transition:background 200ms,transform 150ms,box-shadow 200ms;
    box-shadow:0 4px 24px rgba(231,115,51,0.4);
  }
  .btn-primary:hover { background:#f2813e; transform:translateY(-2px); box-shadow:0 8px 32px rgba(231,115,51,0.5); }
  .btn-secondary {
    display:inline-flex; align-items:center; gap:10px; background:transparent;
    color:var(--beige); font-family:'Righteous',sans-serif; font-size:16px;
    padding:14px 28px; border-radius:100px; border:1px solid var(--border);
    cursor:pointer; transition:border-color 200ms,transform 150ms,background 200ms;
  }
  .btn-secondary:hover { border-color:var(--beige); background:rgba(245,235,220,0.06); transform:translateY(-2px); }
  .btn-icon { width:20px; height:20px; flex-shrink:0; }
  .scroll-hint {
    position:absolute; bottom:32px; left:50%; transform:translateX(-50%);
    display:flex; flex-direction:column; align-items:center; gap:8px;
    color:var(--muted); font-size:11px; letter-spacing:1px; text-transform:uppercase;
    animation:bounce 2s ease-in-out infinite; z-index:2;
  }
  @keyframes bounce {
    0%,100% { transform:translateX(-50%) translateY(0); }
    50%      { transform:translateX(-50%) translateY(6px); }
  }

  .stats {
    background:var(--surface); border-top:1px solid var(--border);
    border-bottom:1px solid var(--border); padding:28px 40px;
    display:flex; justify-content:center;
  }
  .stat-item {
    display:flex; flex-direction:column; align-items:center;
    padding:0 48px; border-right:1px solid var(--border);
  }
  .stat-item:last-child { border-right:none; }
  .stat-num { font-family:'Righteous',sans-serif; font-size:32px; color:var(--yellow); line-height:1; }
  .stat-label { font-size:12px; color:var(--muted); letter-spacing:0.5px; margin-top:4px; }

  .marquee-wrapper {
    overflow:hidden; padding:18px 0; background:var(--orange);
    border-top:1px solid rgba(255,255,255,0.1); border-bottom:1px solid rgba(0,0,0,0.2);
  }
  .marquee-track {
    display:flex; gap:48px; animation:marquee 30s linear infinite; width:max-content;
  }
  .marquee-track:hover { animation-play-state:paused; }
  .marquee-item {
    font-family:'Righteous',sans-serif; font-size:14px; letter-spacing:2px;
    text-transform:uppercase; color:rgba(255,255,255,0.85);
    white-space:nowrap; display:flex; align-items:center; gap:48px;
  }
  .marquee-dot { width:6px; height:6px; background:rgba(255,255,255,0.5); border-radius:50%; }
  @keyframes marquee {
    from { transform:translateX(0); } to { transform:translateX(-50%); }
  }

  .section { padding:100px 40px; }
  .section-inner { max-width:1100px; margin:0 auto; }
  .section-eyebrow {
    font-size:11px; font-weight:600; letter-spacing:2px; text-transform:uppercase;
    color:var(--orange); margin-bottom:16px;
  }
  .section-heading {
    font-family:'Righteous',sans-serif; font-size:clamp(28px,4vw,44px);
    line-height:1.15; margin-bottom:20px;
  }
  .section-sub { font-size:16px; color:var(--muted); line-height:1.7; max-width:520px; }

  .features-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; margin-top:64px; }
  .feature-card {
    background:var(--card); border:1px solid var(--border);
    border-radius:var(--radius); padding:32px 28px;
    transition:border-color 250ms,transform 200ms;
  }
  .feature-card:hover { border-color:var(--orange); transform:translateY(-4px); }
  .feature-icon {
    width:48px; height:48px; background:rgba(231,115,51,0.12); border-radius:12px;
    display:flex; align-items:center; justify-content:center; margin-bottom:20px;
  }
  .feature-icon svg { width:24px; height:24px; stroke:var(--orange); fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .feature-title { font-family:'Righteous',sans-serif; font-size:18px; margin-bottom:12px; }
  .feature-desc { font-size:14px; color:var(--muted); line-height:1.7; }

  .screenshots { background:var(--surface); padding:100px 40px; }
  .screenshots-inner { max-width:1100px; margin:0 auto; }
  .screenshots-layout { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; margin-top:64px; }
  .screenshots-phones { display:flex; justify-content:center; align-items:flex-end; }
  .phone-frame { border-radius:38px; overflow:hidden; border:2px solid rgba(255,255,255,0.1); box-shadow:0 24px 80px rgba(0,0,0,0.6); flex-shrink:0; }
  .phone-frame img { display:block; width:100%; height:auto; }
  .phone-main   { width:220px; transform:rotate(-3deg); z-index:2; position:relative; }
  .phone-second { width:190px; transform:rotate(5deg) translateX(-20px); opacity:0.85; }
  .screenshots-text .section-sub { margin-bottom:32px; }
  .feature-list { list-style:none; display:flex; flex-direction:column; gap:16px; }
  .feature-list li { display:flex; align-items:flex-start; gap:14px; font-size:15px; color:var(--beige); line-height:1.5; }
  .check {
    width:22px; height:22px; background:rgba(99,169,54,0.15); border-radius:50%;
    display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;
  }
  .check svg { width:12px; height:12px; stroke:#63A936; stroke-width:2.5; fill:none; stroke-linecap:round; stroke-linejoin:round; }

  .showcase { padding:100px 40px; }
  .showcase-inner { max-width:1100px; margin:0 auto; }
  .hero-mosaic { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-top:56px; }
  .mosaic-card {
    border-radius:14px; overflow:hidden; aspect-ratio:2/3;
    position:relative; cursor:pointer; transition:transform 250ms,box-shadow 250ms;
  }
  .mosaic-card:hover { transform:scale(1.04); box-shadow:0 16px 48px rgba(0,0,0,0.7); z-index:1; }
  .mosaic-card img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; }
  .mosaic-card::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(to bottom,transparent 50%,rgba(11,24,32,0.85) 100%);
  }
  .mosaic-name {
    position:absolute; bottom:12px; left:0; right:0; text-align:center;
    font-family:'Righteous',sans-serif; font-size:13px; color:var(--beige); z-index:1; letter-spacing:0.5px;
  }

  .cta-section { padding:100px 40px; text-align:center; background:var(--surface); border-top:1px solid var(--border); }
  .cta-inner { max-width:600px; margin:0 auto; }
  .cta-glow {
    display:inline-block;
    background:linear-gradient(135deg,var(--orange) 0%,var(--yellow) 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
    font-family:'Righteous',sans-serif; font-size:clamp(36px,6vw,60px); line-height:1.1; margin-bottom:20px;
  }
  .cta-sub { font-size:17px; color:var(--muted); line-height:1.7; margin-bottom:40px; }
  .cta-buttons { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
  .app-store-badge {
    display:inline-flex; align-items:center; gap:12px; background:var(--card);
    border:1px solid var(--border); color:var(--beige); padding:14px 24px;
    border-radius:14px; cursor:pointer; border-style:solid;
    transition:border-color 200ms,transform 150ms; min-width:160px;
  }
  .app-store-badge:hover { border-color:var(--muted); transform:translateY(-2px); }
  .badge-text { display:flex; flex-direction:column; text-align:left; }
  .badge-text span:first-child { font-size:10px; color:var(--muted); letter-spacing:0.5px; }
  .badge-text span:last-child  { font-family:'Righteous',sans-serif; font-size:16px; }
  .badge-icon { width:28px; height:28px; flex-shrink:0; }

  footer {
    padding:40px; border-top:1px solid var(--border);
    display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;
  }
  footer img { height:22px; opacity:0.7; }
  footer p { font-size:13px; color:var(--muted); }

  /* Hero strip — mobile only */
  .hero-strip { display:none; }

  @media (max-width:1024px) {
    .features-grid { grid-template-columns:repeat(2,1fr); }
    .hero-mosaic { grid-template-columns:repeat(4,1fr); }
    .hero-mosaic .mosaic-card:last-child { display:none; }
    .stat-item { padding:0 28px; }
  }

  @media (max-width:768px) {
    /* Nav */
    nav { padding:14px 20px; }

    /* Hero — tighter, no min-height */
    .hero { padding:88px 20px 52px; min-height:auto; }
    .hc1,.hc2,.hc3,.hc4,.hc5,.hc6,.hc7,.hc8,.hc9,.hc10 { display:none; }
    .scroll-hint { display:none; }

    /* Hero strip — bleeds to viewport edges */
    .hero-strip {
      display:flex; overflow-x:auto; gap:10px;
      margin: 28px -20px 0; padding: 0 20px;
      scrollbar-width:none;
    }
    .hero-strip::-webkit-scrollbar { display:none; }
    .hero-strip-card {
      flex-shrink:0; width:88px; height:124px; border-radius:12px;
      overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.5);
    }
    .hero-strip-card img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; }

    /* Stats — 2×2 grid */
    .stats { display:grid; grid-template-columns:1fr 1fr; padding:0; gap:0; }
    .stat-item { border-right:none; border-bottom:1px solid var(--border); padding:24px 16px; align-items:center; }
    .stat-item:nth-child(odd)  { border-right:1px solid var(--border); }
    .stat-item:nth-child(3),
    .stat-item:nth-child(4)    { border-bottom:none; }
    .stat-num  { font-size:22px; }
    .stat-label { font-size:11px; }

    /* Sections */
    .section,.screenshots,.showcase,.cta-section { padding:64px 20px; }
    .section-heading { font-size:clamp(24px,6vw,34px); margin-bottom:16px; }
    .section-sub { font-size:15px; }

    /* Features — grid layout: icon left, title+desc right */
    .features-grid { grid-template-columns:1fr; gap:10px; margin-top:36px; }
    .feature-card {
      display:grid; grid-template-columns:40px 1fr;
      grid-template-rows:auto auto; column-gap:14px; row-gap:4px; padding:18px;
    }
    .feature-icon {
      grid-row:1/3; align-self:start; margin-bottom:0;
      width:40px; height:40px; border-radius:10px;
    }
    .feature-title { grid-column:2; font-size:15px; margin-bottom:0; align-self:end; }
    .feature-desc  { grid-column:2; font-size:13px; align-self:start; }

    /* Screenshots */
    .screenshots-layout { grid-template-columns:1fr; gap:36px; }
    .screenshots-phones { order:-1; justify-content:center; }
    .phone-second { display:none; }
    .phone-main { width:min(240px,62vw); transform:none; }
    .screenshots-text { text-align:center; }
    .screenshots-text .section-sub { margin-bottom:24px; }
    .feature-list li { justify-content:center; }

    /* Mosaic — 3 cols, 2 rows */
    .hero-mosaic { grid-template-columns:repeat(3,1fr); gap:8px; margin-top:36px; }
    .hero-mosaic .mosaic-card { display:block; }
    .hero-mosaic .mosaic-card:nth-child(n+7) { display:none; }
    .mosaic-name { font-size:11px; bottom:8px; }

    /* Final CTA */
    .cta-sub { font-size:15px; }
  }

  @media (max-width:480px) {
    /* Full-width hero CTAs */
    .hero-ctas { flex-direction:column; align-items:stretch; width:100%; max-width:300px; margin:0 auto; }
    .btn-primary,.btn-secondary { justify-content:center; }

    /* Store badges */
    .cta-buttons { flex-direction:column; align-items:center; width:100%; }
    .app-store-badge { width:100%; max-width:260px; justify-content:center; }

    /* Footer */
    footer { justify-content:center; text-align:center; flex-direction:column; align-items:center; }
  }

  @media (prefers-reduced-motion:reduce) {
    .hero-card,.scroll-hint,.marquee-track { animation:none; }
    * { transition-duration:0.01ms !important; }
  }
`;

export default function LandingPage({ dom: _dom }: { dom?: import('expo/dom').DOMProps }) {
  const router = useRouter();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        zIndex: 999,
        backgroundColor: '#0b1820',
        color: '#f5ebdc',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <nav>
        <div className="nav-brand">
          <img className="nav-logo" src={logoMark} alt="" aria-hidden="true" />
          <img className="nav-wordmark" src={wordmark} alt="Hero" />
        </div>
        <button className="nav-cta" onClick={() => router.push('/(auth)/login')}>
          Sign In
        </button>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-collage" aria-hidden="true">
          <div className="hero-card hc1">
            <img src={spiderman} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc2">
            <img src={batman} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc3">
            <img src={ironman} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc4">
            <img src={deadpool} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc5">
            <img src={wolverine} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc6">
            <img src={wonderWoman} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc7">
            <img src={thor} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc8">
            <img src={blackPanther} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc9">
            <img src={docStrange} alt="" loading="lazy" />
          </div>
          <div className="hero-card hc10">
            <img src={hulk} alt="" loading="lazy" />
          </div>
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            500+ Heroes &amp; Villains
          </div>
          <img className="hero-wordmark-large" src={wordmark} alt="Hero" />
          <p className="hero-tagline">The Universe's Greatest Heroes</p>
          <p className="hero-sub">
            Discover the powers, origins, and stories of 500+ characters from Marvel, DC, and beyond
            — all in your pocket.
          </p>
          <div className="hero-ctas">
            <button className="btn-primary">
              <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              App Store
            </button>
            <button className="btn-secondary" onClick={() => router.push('/(auth)/signup')}>
              <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.18 23.76c.28.16.6.22.93.17l12.81-7.4-2.79-2.79-10.95 10zM.29 1.52A1.5 1.5 0 0 0 0 2.39v19.22c0 .31.09.6.29.87l.09.09 10.77-10.77v-.25L.38 1.43l-.09.09zM20.9 10.77l-2.71-1.56-3.07 3.08 3.07 3.07 2.74-1.58c.78-.45.78-1.58-.03-2.01zM4.11.24L16.92 7.63l-2.79 2.79L3.18.24A1.08 1.08 0 0 1 4.11.24z" />
              </svg>
              Google Play
            </button>
            <button className="btn-secondary" onClick={() => router.push('/(auth)/login')}>
              Try on Web →
            </button>
          </div>
        </div>

        {/* Mobile hero strip */}
        <div className="hero-strip" aria-hidden="true">
          {[spiderman, ironman, batman, deadpool, wonderWoman, thor, wolverine, blackPanther].map(
            (src, i) => (
              <div key={i} className="hero-strip-card">
                <img src={src} alt="" loading="lazy" />
              </div>
            ),
          )}
        </div>

        <div className="scroll-hint" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span>Scroll</span>
        </div>
      </section>

      {/* STATS */}
      <div className="stats">
        <div className="stat-item">
          <span className="stat-num">500+</span>
          <span className="stat-label">Heroes &amp; Villains</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">Marvel &amp; DC</span>
          <span className="stat-label">Universes</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">Free</span>
          <span className="stat-label">To Download</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">iOS &amp; Android</span>
          <span className="stat-label">Platforms</span>
        </div>
      </div>

      {/* MARQUEE */}
      <div className="marquee-wrapper" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((i) => (
            <div key={i} className="marquee-item">
              {[
                'Spider-Man',
                'Batman',
                'Iron Man',
                'Wonder Woman',
                'Black Panther',
                'Thor',
                'Deadpool',
                'Wolverine',
                'Doctor Strange',
                'Hulk',
                'Magneto',
                'Joker',
                'Loki',
                'Venom',
                'Storm',
                'Captain America',
              ].map((name, j) => (
                <span key={j}>
                  {name}
                  <span
                    className="marquee-dot"
                    style={{ display: 'inline-block', marginLeft: 48 }}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section className="section">
        <div className="section-inner">
          <p className="section-eyebrow">What's inside</p>
          <h2 className="section-heading">
            Everything you need to
            <br />
            know your heroes
          </h2>
          <p className="section-sub">
            From first appearances to power stats — the most complete superhero companion app on the
            planet.
          </p>
          <div className="features-grid">
            {[
              {
                title: 'Discover Heroes',
                desc: 'Browse curated collections of heroes by universe, team, or power set. New favourites await every scroll.',
                icon: (
                  <>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ),
              },
              {
                title: 'Instant Search',
                desc: 'Find any of 500+ characters in seconds. Search by name, power, publisher, or team affiliation.',
                icon: (
                  <>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </>
                ),
              },
              {
                title: 'Save Favourites',
                desc: 'Build your personal hero roster. Track your favourite characters and revisit them any time.',
                icon: (
                  <>
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </>
                ),
              },
              {
                title: 'Power Stats',
                desc: 'Dive deep into intelligence, strength, speed, durability, power, and combat ratings for every hero.',
                icon: (
                  <>
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </>
                ),
              },
              {
                title: 'Origin Stories',
                desc: 'First issue data, publisher history, and real names — the complete origin story behind every icon.',
                icon: (
                  <>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </>
                ),
              },
              {
                title: 'Universe Browser',
                desc: 'Explore Marvel, DC, Dark Horse and more. Organised by publisher, team, and comic era.',
                icon: (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M3 15h18M9 3v18" />
                  </>
                ),
              },
            ].map((f, i) => (
              <div key={i} className="feature-card">
                <div className="feature-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {f.icon}
                  </svg>
                </div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section className="screenshots">
        <div className="screenshots-inner">
          <div className="screenshots-layout">
            <div className="screenshots-phones">
              <div className="phone-frame phone-main">
                <img src={screenshotHome} alt="Hero app home screen" width={220} />
              </div>
              <div className="phone-frame phone-second">
                <img
                  src={screenshotSearch}
                  alt="Hero app search screen"
                  width={190}
                  loading="lazy"
                />
              </div>
            </div>
            <div className="screenshots-text">
              <p className="section-eyebrow">The app</p>
              <h2 className="section-heading">
                Designed for
                <br />
                true fans
              </h2>
              <p className="section-sub">
                A beautiful, fast, and intuitive experience — built by fans, for fans.
              </p>
              <ul className="feature-list">
                {[
                  'Curated hero carousels updated regularly',
                  'Detailed character info from trusted sources',
                  'Beautiful card UI with squircle artwork',
                  'Works offline — your heroes, always available',
                ].map((item, i) => (
                  <li key={i}>
                    <span className="check" aria-hidden="true">
                      <svg viewBox="0 0 12 12">
                        <polyline points="2 6 5 9 10 3" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* MOSAIC */}
      <section className="showcase">
        <div className="showcase-inner">
          <p className="section-eyebrow">The roster</p>
          <h2 className="section-heading">From every universe</h2>
          <p className="section-sub">
            Marvel. DC. Dark Horse. If they wear a cape (or don't), we've got them covered.
          </p>
          <div className="hero-mosaic">
            {[
              [spiderman, 'Spider-Man'],
              [batman, 'Batman'],
              [ironman, 'Iron Man'],
              [wonderWoman, 'Wonder Woman'],
              [blackPanther, 'Black Panther'],
              [deadpool, 'Deadpool'],
              [wolverine, 'Wolverine'],
              [thor, 'Thor'],
              [docStrange, 'Doctor Strange'],
              [hulk, 'Hulk'],
            ].map(([src, name], i) => (
              <div key={i} className="mosaic-card">
                <img src={src as string} alt={name as string} loading="lazy" />
                <span className="mosaic-name">{name as string}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <p className="section-eyebrow">Download now</p>
          <h2 className="cta-glow">Your heroes await.</h2>
          <p className="cta-sub">
            Free to download. No ads. Just the greatest heroes ever created — right in your pocket.
          </p>
          <div className="cta-buttons">
            <button className="app-store-badge" aria-label="Download on the App Store">
              <svg
                className="badge-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="badge-text">
                <span>Download on the</span>
                <span>App Store</span>
              </div>
            </button>
            <button className="app-store-badge" aria-label="Get it on Google Play">
              <svg
                className="badge-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3.18 23.76c.28.16.6.22.93.17l12.81-7.4-2.79-2.79-10.95 10zM.29 1.52A1.5 1.5 0 0 0 0 2.39v19.22c0 .31.09.6.29.87l.09.09 10.77-10.77v-.25L.38 1.43l-.09.09zM20.9 10.77l-2.71-1.56-3.07 3.08 3.07 3.07 2.74-1.58c.78-.45.78-1.58-.03-2.01zM4.11.24L16.92 7.63l-2.79 2.79L3.18.24A1.08 1.08 0 0 1 4.11.24z" />
              </svg>
              <div className="badge-text">
                <span>Get it on</span>
                <span>Google Play</span>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <img src={wordmark} alt="Hero" />
        <p>© 2025 Hero App. All rights reserved.</p>
      </footer>
    </div>
  );
}
