'use dom';

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { LOGO_MASK_PATH as LOGO_PATH } from '../../constants/logo';

const screenshotDesktop = require('../../../assets/images/screenshots/desktop-explore.png');
const screenshotMobile = require('../../../assets/images/screenshots/mobile-spiderman.png');

const P = (id: string) =>
  `https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_400/hero-portraits/${id}.jpg`;

// [id, name, weight] — higher weight = more likely to appear each load
const HERO_POOL: [string, string, number][] = [
  ['620', 'Spider-Man', 10],
  ['69', 'Batman', 10],
  ['346', 'Iron Man', 10],
  ['717', 'Wolverine', 10],
  ['644', 'Superman', 10],
  ['149', 'Captain America', 9],
  ['659', 'Thor', 9],
  ['720', 'Wonder Woman', 9],
  ['213', 'Deadpool', 8],
  ['332', 'Hulk', 8],
  ['106', 'Black Panther', 8],
  ['226', 'Doctor Strange', 7],
  ['423', 'Magneto', 7],
  ['579', 'Scarlet Witch', 7],
  ['370', 'Joker', 7],
  ['687', 'Venom', 6],
  ['cv-4324', 'Loki', 6],
  ['201', 'Daredevil', 6],
  ['638', 'Storm', 6],
  ['196', 'Cyclops', 5],
  ['cv-3552', 'Jean Grey', 5],
  ['241', 'Emma Frost', 5],
  ['165', 'Catwoman', 5],
  ['38', 'Aquaman', 5],
  ['306', 'Hal Jordan', 5],
  ['298', 'Green Arrow', 4],
  ['567', 'Rogue', 4],
  ['274', 'Gambit', 4],
  ['222', 'Doctor Doom', 4],
  ['cv-21561', 'Carol Danvers', 4],
  ['cv-3200', 'Black Widow', 4],
  ['697', 'Vision', 3],
  ['185', 'Colossus', 3],
  ['490', 'Nightcrawler', 3],
  ['481', 'Namor', 3],
  ['cv-1691', 'Dick Grayson', 3],
  ['cv-5368', 'Barbara Gordon', 3],
  ['432', 'Martian Manhunter', 3],
];

const weightedShuffle = () =>
  [...HERO_POOL]
    .map((entry) => ({ entry, key: Math.random() ** (1 / entry[2]) }))
    .sort((a, b) => b.key - a.key)
    .map(({ entry }) => entry);

// Each section gets its own independent shuffle so collage ≠ mosaic
const collageShuffled = weightedShuffle();
const mosaicShuffled = weightedShuffle();

const collageChars = collageShuffled.slice(0, 10);
const mosaicChars = mosaicShuffled.slice(0, 10);
const stripChars = collageShuffled.slice(0, 8);

// Tale-of-the-tape proof — real power stats (l = Hulk #332, r = Iron Man #346)
const TALE: { label: string; l: number; r: number }[] = [
  { label: 'Strength', l: 100, r: 85 },
  { label: 'Power', l: 98, r: 100 },
  { label: 'Intelligence', l: 88, r: 100 },
  { label: 'Durability', l: 100, r: 85 },
  { label: 'Combat', l: 85, r: 64 },
  { label: 'Speed', l: 63, r: 58 },
];

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
  .nav-wordmark { font-family:'Righteous',sans-serif; font-size:22px; color:var(--beige); letter-spacing:-0.5px; position:relative; top:-2px; }
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
    display:block;
    font-family:'Righteous',sans-serif;
    font-size:clamp(64px,13vw,128px);
    color:var(--beige);
    letter-spacing:-3px;
    line-height:1;
    margin-bottom:40px;
    text-shadow:0 4px 40px rgba(231,115,51,0.35);
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
  .screenshots-phones { position:relative; display:flex; justify-content:center; align-items:center; min-height:320px; }
  .browser-frame {
    width:100%; max-width:520px; border-radius:14px; overflow:hidden;
    border:1px solid var(--border); background:var(--card);
    box-shadow:0 30px 80px rgba(0,0,0,0.6); transform:rotate(-1deg);
  }
  .browser-bar { display:flex; align-items:center; gap:7px; padding:11px 14px; background:var(--surface); border-bottom:1px solid var(--border); }
  .browser-dot { width:10px; height:10px; border-radius:50%; }
  .browser-dot:nth-child(1) { background:#ff5f57; }
  .browser-dot:nth-child(2) { background:#febc2e; }
  .browser-dot:nth-child(3) { background:#28c840; }
  .browser-url { margin-left:10px; font-size:11px; color:var(--muted); background:var(--bg); padding:4px 16px; border-radius:100px; letter-spacing:0.5px; }
  .browser-frame img { display:block; width:100%; height:auto; }
  .phone-frame { border-radius:26px; overflow:hidden; border:2px solid rgba(255,255,255,0.12); box-shadow:0 18px 50px rgba(0,0,0,0.7); flex-shrink:0; }
  .phone-frame img { display:block; width:100%; height:auto; }
  .phone-second { position:absolute; right:-4px; bottom:-28px; width:128px; transform:rotate(4deg); z-index:3; }
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
  .app-store-badge:not(:disabled):hover { border-color:var(--muted); transform:translateY(-2px); }
  .app-store-badge:disabled { cursor:default; opacity:0.55; }
  .badge-text { display:flex; flex-direction:column; text-align:left; }
  .badge-text span:first-child { font-size:10px; color:var(--muted); letter-spacing:0.5px; }
  .badge-text span:last-child  { font-family:'Righteous',sans-serif; font-size:16px; }
  .badge-icon { width:28px; height:28px; flex-shrink:0; }

  /* Tale of the tape */
  .tott { padding:100px 40px; background:var(--bg); }
  .tott-inner { max-width:760px; margin:0 auto; text-align:center; }
  .tott-inner .section-eyebrow { color:var(--orange); }
  .tott-inner .section-sub { margin:0 auto; }
  .tott-card {
    margin-top:48px; background:var(--card); border:1px solid var(--border);
    border-radius:24px; padding:36px; text-align:left;
    --hulk:#63A936; --iron:#E77333;
  }
  .tott-head { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:20px; margin-bottom:32px; }
  .tott-fighter { display:flex; flex-direction:column; align-items:center; gap:8px; }
  .tott-portrait { width:96px; height:96px; border-radius:50%; overflow:hidden; border:3px solid; }
  .tott-portrait.l { border-color:var(--hulk); }
  .tott-portrait.r { border-color:var(--iron); }
  .tott-portrait img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; }
  .tott-name { font-family:'Righteous',sans-serif; font-size:18px; }
  .tott-univ { font-size:11px; color:var(--muted); letter-spacing:1.5px; text-transform:uppercase; }
  .tott-vs {
    font-family:'Righteous',sans-serif; font-size:24px;
    width:54px; height:54px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,var(--orange),var(--yellow));
    color:#0b1820; box-shadow:0 6px 24px rgba(231,115,51,0.4);
  }
  .tott-bars { display:flex; flex-direction:column; gap:14px; }
  .tott-row { display:grid; grid-template-columns:34px 1fr 120px 1fr 34px; align-items:center; gap:12px; }
  .tott-val { font-family:'Righteous',sans-serif; font-size:15px; color:var(--muted); }
  .tott-val.l { text-align:right; }
  .tott-val.r { text-align:left; }
  .tott-val.win.l { color:var(--hulk); }
  .tott-val.win.r { color:var(--iron); }
  .tott-label { font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); text-align:center; }
  .tott-bar { position:relative; height:8px; background:var(--surface); border-radius:6px; overflow:hidden; }
  .tott-fill { position:absolute; top:0; bottom:0; border-radius:6px; }
  .tott-fill.l { right:0; background:var(--hulk); }
  .tott-fill.r { left:0; background:var(--iron); }

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
    .screenshots-phones { order:-1; justify-content:center; min-height:auto; padding-bottom:28px; }
    .browser-frame { transform:none; max-width:100%; }
    .phone-second { width:96px; right:4px; bottom:-14px; }
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

    /* Tale of the tape */
    .tott { padding:64px 20px; }
    .tott-card { padding:24px 14px; border-radius:20px; margin-top:32px; }
    .tott-head { gap:8px; margin-bottom:24px; }
    .tott-portrait { width:64px; height:64px; }
    .tott-name { font-size:15px; }
    .tott-univ { font-size:9px; }
    .tott-vs { width:44px; height:44px; font-size:19px; }
    .tott-row { grid-template-columns:24px 1fr 64px 1fr 24px; gap:6px; }
    .tott-val { font-size:13px; }
    .tott-label { font-size:9px; letter-spacing:0.5px; }
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

  /* Font-loading splash */
  .page-loader {
    position:fixed; inset:0; z-index:9999;
    background:#0b1820;
    display:flex; align-items:center; justify-content:center;
    transition:opacity 400ms ease;
  }
  .page-loader.ready { opacity:0; pointer-events:none; }
  @keyframes loaderDraw {
    0% { stroke-dashoffset:100; }
    60%,100% { stroke-dashoffset:0; }
  }
  @keyframes loaderFill {
    0%,60% { fill-opacity:0; }
    100% { fill-opacity:1; }
  }
  .loader-path {
    stroke-dasharray:100;
    animation:
      loaderDraw 2s ease-in-out infinite,
      loaderFill 2s ease-in-out infinite;
  }
`;

export default function LandingPage({ dom: _dom }: { dom?: import('expo/dom').DOMProps }) {
  const router = useRouter();
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  return (
    <div
      style={{
        backgroundColor: '#0b1820',
        color: '#f5ebdc',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className={`page-loader${fontsReady ? ' ready' : ''}`} aria-hidden="true">
        <svg width={100} height={100} viewBox="0 0 1024 1024">
          <path
            className="loader-path"
            pathLength={100}
            d={LOGO_PATH}
            stroke="#f5ebdc"
            strokeWidth={12}
            fill="#f5ebdc"
          />
        </svg>
      </div>

      <nav>
        <div className="nav-brand">
          <svg className="nav-logo" viewBox="0 0 1024 1024" aria-hidden="true">
            <path fill="var(--orange)" d={LOGO_PATH} />
          </svg>
          <span className="nav-wordmark">mythique</span>
        </div>
        <button className="nav-cta" onClick={() => router.push('/(auth)/login')}>
          Sign In
        </button>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-collage" aria-hidden="true">
          {collageChars.map(([id], i) => (
            <div key={id} className={`hero-card hc${i + 1}`}>
              <img src={P(id)} alt="" loading="lazy" />
            </div>
          ))}
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
            Every universe. Every icon.
          </div>
          <span className="hero-wordmark-large">mythique</span>
          <p className="hero-tagline">Know every icon. Settle every debate.</p>
          <p className="hero-sub">
            Explore 34,000+ characters in rich detail, trace how they&apos;re connected, and pit any
            two head-to-head to settle who&apos;d really win. The whole universe — alive, connected,
            and yours to argue about.
          </p>
          <div className="hero-ctas">
            <button className="btn-primary" onClick={() => router.push('/explore')}>
              <svg
                className="btn-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              Explore the universe
            </button>
            <button className="btn-secondary" onClick={() => router.push('/versus')}>
              Settle a debate →
            </button>
          </div>
        </div>

        {/* Mobile hero strip */}
        <div className="hero-strip" aria-hidden="true">
          {stripChars.map(([id]) => (
            <div key={id} className="hero-strip-card">
              <img src={P(id)} alt="" loading="lazy" />
            </div>
          ))}
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
          <span className="stat-num">34,000+</span>
          <span className="stat-label">Characters</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">180+</span>
          <span className="stat-label">Universes</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">3,000+</span>
          <span className="stat-label">Films &amp; Shows</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">430K+</span>
          <span className="stat-label">Connections</span>
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
          <p className="section-eyebrow">Why it&apos;s different</p>
          <h2 className="section-heading">
            More than a wiki.
            <br />A universe you can play with.
          </h2>
          <p className="section-sub">
            Explore every character in depth, see how they all connect, and settle the debates a
            static list never could. One living, opinionated multiverse — every franchise, every
            icon.
          </p>
          <div className="features-grid">
            {[
              {
                title: 'Explore the Universe',
                desc: 'Browse 34,000+ characters across Marvel, DC, Disney, anime, games and beyond — curated collections that surface someone new every scroll.',
                icon: (
                  <>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                ),
              },
              {
                title: 'Deep Profiles',
                desc: 'Powers, origins, abilities, real names and did-you-knows — the full dossier behind every character, not just a stat block.',
                icon: (
                  <>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </>
                ),
              },
              {
                title: 'Rivalries & Family Trees',
                desc: 'See who they fight, who they love, and who they’re related to — every hero mapped into a living web of allies, enemies and kin.',
                icon: (
                  <>
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </>
                ),
              },
              {
                title: 'Settle the Debate',
                desc: 'Pit any two head-to-head, take a side, and watch the winner reveal — crowd vote plus the tale of the tape. The "who’d win" argument, finally settled.',
                icon: (
                  <>
                    <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
                    <path d="m13 19 6-6" />
                    <path d="m16 16 4 4" />
                    <path d="m19 21 2-2" />
                    <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
                    <path d="m5 14 4 4" />
                    <path d="m7 17-2 2" />
                    <path d="m3 19 2 2" />
                  </>
                ),
              },
              {
                title: 'On Screen',
                desc: 'Every film, show and game a character appears in — with trailers and where to stream them next.',
                icon: (
                  <>
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </>
                ),
              },
              {
                title: 'Instant Search',
                desc: 'Find any of 34,000+ characters in seconds — search by name, power, publisher or team affiliation.',
                icon: (
                  <>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

      {/* TALE OF THE TAPE */}
      <section className="tott">
        <div className="tott-inner">
          <p className="section-eyebrow">The big question</p>
          <h2 className="section-heading">Who&apos;d actually win?</h2>
          <p className="section-sub">
            Every matchup opens with the tale of the tape — real power stats, side by side. Then you
            take a side and watch the verdict roll in.
          </p>

          <div className="tott-card">
            <div className="tott-head">
              <div className="tott-fighter">
                <div className="tott-portrait l">
                  <img src={P('332')} alt="Hulk" loading="lazy" />
                </div>
                <span className="tott-name">Hulk</span>
                <span className="tott-univ">Marvel</span>
              </div>
              <div className="tott-vs" aria-hidden="true">
                VS
              </div>
              <div className="tott-fighter">
                <div className="tott-portrait r">
                  <img src={P('346')} alt="Iron Man" loading="lazy" />
                </div>
                <span className="tott-name">Iron Man</span>
                <span className="tott-univ">Marvel</span>
              </div>
            </div>

            <div className="tott-bars">
              {TALE.map((row) => {
                const hulkWins = row.l > row.r;
                const ironWins = row.r > row.l;
                return (
                  <div className="tott-row" key={row.label}>
                    <span className={`tott-val l${hulkWins ? ' win' : ''}`}>{row.l}</span>
                    <div className="tott-bar">
                      <div className="tott-fill l" style={{ width: `${row.l}%` }} />
                    </div>
                    <span className="tott-label">{row.label}</span>
                    <div className="tott-bar">
                      <div className="tott-fill r" style={{ width: `${row.r}%` }} />
                    </div>
                    <span className={`tott-val r${ironWins ? ' win' : ''}`}>{row.r}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            className="btn-primary"
            style={{ marginTop: 36 }}
            onClick={() => router.push('/versus')}
          >
            <svg
              className="btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
              <path d="m13 19 6-6" />
              <path d="m16 16 4 4" />
              <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
              <path d="m5 14 4 4" />
            </svg>
            Settle a debate
          </button>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section className="screenshots">
        <div className="screenshots-inner">
          <div className="screenshots-layout">
            <div className="screenshots-phones">
              <div className="browser-frame">
                <div className="browser-bar" aria-hidden="true">
                  <span className="browser-dot" />
                  <span className="browser-dot" />
                  <span className="browser-dot" />
                  <span className="browser-url">mythique</span>
                </div>
                <img src={screenshotDesktop} alt="Mythique explore feed on desktop" loading="lazy" />
              </div>
              <div className="phone-frame phone-second">
                <img src={screenshotMobile} alt="A character profile on mobile" loading="lazy" />
              </div>
            </div>
            <div className="screenshots-text">
              <p className="section-eyebrow">The experience</p>
              <h2 className="section-heading">
                Made to
                <br />
                get lost in.
              </h2>
              <p className="section-sub">
                Fast, beautiful, and endlessly deep — on desktop or mobile, right in your browser.
              </p>
              <ul className="feature-list">
                {[
                  'Rich profiles — powers, origins, abilities & trivia',
                  'Rivalry and family-tree graphs you can explore',
                  'Head-to-head matchups with the tale of the tape',
                  'Film, TV and game appearances for every hero',
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
            Marvel, DC, anime, video games and beyond — 34,000+ characters, deeply detailed, all in
            one place.
          </p>
          <div className="hero-mosaic">
            {mosaicChars.map(([id, name]) => (
              <div key={id} className="mosaic-card">
                <img src={P(id)} alt={name} loading="lazy" />
                <span className="mosaic-name">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-section">
        <div className="cta-inner">
          <p className="section-eyebrow">Dive in</p>
          <h2 className="cta-glow">Explore. Compare. Argue.</h2>
          <p className="cta-sub">
            30,000+ characters across every universe, deep profiles, living rivalries, and the only
            place to settle who&apos;d really win — free, no ads, right in your browser.
          </p>
          <button
            className="btn-primary"
            style={{ marginBottom: 28 }}
            onClick={() => router.push('/explore')}
          >
            <svg
              className="btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            Explore the universe
          </button>
          <div className="cta-buttons">
            <button className="app-store-badge" disabled aria-label="Coming soon to the App Store">
              <svg
                className="badge-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="badge-text">
                <span>Coming soon to</span>
                <span>App Store</span>
              </div>
            </button>
            <button className="app-store-badge" disabled aria-label="Coming soon to Google Play">
              <svg
                className="badge-icon"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3.18 23.76c.28.16.6.22.93.17l12.81-7.4-2.79-2.79-10.95 10zM.29 1.52A1.5 1.5 0 0 0 0 2.39v19.22c0 .31.09.6.29.87l.09.09 10.77-10.77v-.25L.38 1.43l-.09.09zM20.9 10.77l-2.71-1.56-3.07 3.08 3.07 3.07 2.74-1.58c.78-.45.78-1.58-.03-2.01zM4.11.24L16.92 7.63l-2.79 2.79L3.18.24A1.08 1.08 0 0 1 4.11.24z" />
              </svg>
              <div className="badge-text">
                <span>Coming soon to</span>
                <span>Google Play</span>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <span className="nav-wordmark" style={{ opacity: 0.6 }}>
          mythique
        </span>
        <p>© 2026 Mythique. All rights reserved.</p>
      </footer>
    </div>
  );
}
