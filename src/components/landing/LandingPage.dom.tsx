'use dom';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as THREE from 'three';
import { LOGO_MASK_PATH as LOGO_PATH } from '../../constants/logo';
import { getTodaysMatchup, type MatchupHero, type TodaysMatchup } from '../../lib/matchup';
import { getDailyDebate, todayIso } from '../../lib/db/dailyDebate';
import { getTakes, type Take } from '../../lib/db/takes';
import { useMatchupVote } from '../../hooks/useMatchupVote';

const screenshotDesktop = require('../../../assets/images/screenshots/desktop-explore.png');
const screenshotMobile = require('../../../assets/images/screenshots/mobile-spiderman.png');

const P = (id: string) =>
  `https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_400/hero-portraits/${id}.jpg`;

// High-res variant for the summoned portrait's crisp reveal
const P800 = (id: string) =>
  `https://res.cloudinary.com/dgrsb5o4p/image/upload/f_auto,q_auto,w_800/hero-portraits/${id}.jpg`;

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
const mosaicChars = mosaicShuffled.slice(0, 11);
const stripChars = collageShuffled.slice(0, 8);

// head-to-head proof — real power stats (l = Hulk #332, r = Iron Man #346)
const TALE: { label: string; l: number; r: number }[] = [
  { label: 'Strength', l: 100, r: 85 },
  { label: 'Power', l: 98, r: 100 },
  { label: 'Intelligence', l: 88, r: 100 },
  { label: 'Durability', l: 100, r: 85 },
  { label: 'Combat', l: 85, r: 64 },
  { label: 'Speed', l: 63, r: 58 },
];

/* ------------------------------------------------------------------ */
/* The Summoning — 3D hero data                                        */
/* ------------------------------------------------------------------ */

type Rel = 'enemy' | 'ally' | 'kin';

interface Bond {
  id: string;
  name: string;
  rel: Rel;
}

interface Summon {
  id: string;
  name: string;
  universe: string;
  /** Signature colour — tints the hero section while this legend is on stage */
  accent: string;
  bonds: Bond[];
}

const REL_COLOR: Record<Rel, string> = {
  enemy: '#E77333',
  ally: '#15A1AB',
  kin: '#F9B222',
};

const REL_RGB: Record<Rel, string> = {
  enemy: '231,115,51',
  ally: '21,161,171',
  kin: '249,178,34',
};

// The summonable roster. Bonds are real relationships from the graph,
// hardcoded here so the landing page never blocks on the DB.
const SUMMONS: Summon[] = [
  {
    id: '69',
    name: 'Batman',
    universe: 'DC',
    accent: '#F9B222',
    bonds: [
      { id: '370', name: 'Joker', rel: 'enemy' },
      { id: 'cv-1691', name: 'Nightwing', rel: 'kin' },
      { id: '165', name: 'Catwoman', rel: 'ally' },
      { id: 'cv-5368', name: 'Oracle', rel: 'ally' },
    ],
  },
  {
    id: '717',
    name: 'Wolverine',
    universe: 'Marvel',
    accent: '#FFC53D',
    bonds: [
      { id: '423', name: 'Magneto', rel: 'enemy' },
      { id: 'cv-3552', name: 'Jean Grey', rel: 'ally' },
      { id: '638', name: 'Storm', rel: 'ally' },
      { id: '196', name: 'Cyclops', rel: 'ally' },
    ],
  },
  {
    id: '659',
    name: 'Thor',
    universe: 'Marvel',
    accent: '#7FB8FF',
    bonds: [
      { id: 'cv-4324', name: 'Loki', rel: 'kin' },
      { id: '332', name: 'Hulk', rel: 'ally' },
      { id: '149', name: 'Captain America', rel: 'ally' },
    ],
  },
  {
    id: '620',
    name: 'Spider-Man',
    universe: 'Marvel',
    accent: '#E5484D',
    bonds: [
      { id: '687', name: 'Venom', rel: 'enemy' },
      { id: '201', name: 'Daredevil', rel: 'ally' },
      { id: 'cv-3200', name: 'Black Widow', rel: 'ally' },
    ],
  },
  {
    id: '423',
    name: 'Magneto',
    universe: 'Marvel',
    accent: '#C266DD',
    bonds: [
      { id: '579', name: 'Scarlet Witch', rel: 'kin' },
      { id: '717', name: 'Wolverine', rel: 'enemy' },
      { id: '241', name: 'Emma Frost', rel: 'ally' },
    ],
  },
  {
    id: '638',
    name: 'Storm',
    universe: 'Marvel',
    accent: '#DDE9F8',
    bonds: [
      { id: '106', name: 'Black Panther', rel: 'kin' },
      { id: 'cv-3552', name: 'Jean Grey', rel: 'ally' },
      { id: '196', name: 'Cyclops', rel: 'ally' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* The Summoning — engine                                              */
/* ------------------------------------------------------------------ */

const FOV = 38;
const CAMERA_Z = 4.6;
// Portrait plane in world units (2:3, like the source images)
const PLANE_W = 2;
const PLANE_H = 3;
// Group footprint incl. halo — used to fit the scene into the stage rect
const GROUP_W = 3.95;
const GROUP_H = 3.5;

const PARTICLE_VERT = `
  attribute vec2 aUv;
  attribute vec3 aScatter;
  attribute float aSeed;
  uniform sampler2D uTex;
  uniform sampler2D uTexB;
  uniform float uMix;
  uniform float uSwirl;
  uniform float uAssemble;
  uniform float uReveal;
  uniform float uTime;
  uniform float uScale;
  uniform float uSpacing;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Crossfade between the outgoing and incoming legend mid-flight, staggered
    // per particle so the colour change ripples through the cloud
    float mixT = clamp(uMix * 1.6 - aSeed * 0.6, 0.0, 1.0);
    vec3 tex = mix(texture2D(uTex, aUv).rgb, texture2D(uTexB, aUv).rgb, mixT);
    float lum = dot(tex, vec3(0.299, 0.587, 0.114));

    // Staggered per-particle assembly, eased
    float t = clamp(uAssemble * 1.45 - aSeed * 0.45, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);

    // Assembled home on the card's portrait window (inset from the frame),
    // with a gentle breathing wave
    vec3 home = vec3(
      (aUv.x - 0.5) * ${(PLANE_W * 0.93).toFixed(3)},
      (aUv.y - 0.5) * ${(PLANE_H * 0.9467).toFixed(3)},
      (aSeed - 0.5) * 0.06
    );
    home.x += 0.012 * sin(uTime * 1.3 + aUv.y * 9.0 + aSeed * 6.2831);
    home.z += 0.035 * sin(uTime * 0.9 + aUv.x * 7.0 + aSeed * 6.2831);

    // Dispersed stardust, slowly swirling; during a morph the swirl surges
    // and the cloud rotates so the change of form reads as one motion
    vec3 sc = aScatter;
    float sw = uTime * 0.22 + aSeed * 6.2831;
    float surge = 1.0 + uSwirl * 1.4;
    sc.x += 0.28 * sin(sw) * surge;
    sc.y += 0.2 * cos(sw * 1.3) * surge;
    sc.z += 0.22 * sin(sw * 0.7) * surge;
    float ang = uSwirl * (0.9 + aSeed * 0.5);
    float ca = cos(ang);
    float sa = sin(ang);
    sc.xy = mat2(ca, -sa, sa, ca) * sc.xy;

    vec3 pos = mix(sc, home, t);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float worldSize = uSpacing * (0.85 + lum * 0.9) * mix(0.5, 1.25, t);
    gl_PointSize = min(uScale * worldSize / -mv.z, 64.0);

    vColor = tex;
    // Once the crisp card has revealed, the particles get fully out of its
    // way — any residual dot veil reads as blur over the portrait
    vAlpha = mix(0.3, 1.0, t) * (1.0 - uReveal);
  }
`;

const PARTICLE_FRAG = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.3, length(c)) * vAlpha;
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const REVEAL_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The crisp trading card that resolves out of the particles: rounded card
// body, framed portrait window, gold keyline, iridescent holo sheen. While
// materializing (uOpacity < 1) the edge is noise-torn; fully summoned it
// settles into a clean card.
const REVEAL_FRAG = `
  uniform sampler2D uTex;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec2 uTilt;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float roundedRect(vec2 pa, vec2 ext, float r) {
    vec2 q = abs(pa) - ext + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    // Aspect-corrected space so corners stay circular on the 2:3 card
    vec2 p = vUv * 2.0 - 1.0;
    vec2 pa = vec2(p.x, p.y * 1.5);

    float n = vnoise(vUv * 13.0 + uTime * 0.12) * 0.62
            + vnoise(vUv * 38.0 - uTime * 0.08) * 0.38;

    float sdCard = roundedRect(pa, vec2(0.96, 1.4625), 0.1);
    float sdWindow = roundedRect(pa, vec2(0.93, 1.42), 0.05);

    // Materialization: torn edge that heals into a clean die-cut
    float tear = (n - 0.5) * 0.24 * (1.0 - uOpacity);
    float mask = smoothstep(0.012, -0.012, sdCard - tear);
    if (mask * uOpacity < 0.01) discard;

    // Card body (frame band) — warm-lit navy so it separates from the void
    vec3 col = mix(vec3(0.1, 0.18, 0.25), vec3(0.16, 0.27, 0.36), vUv.y);
    col += (n - 0.5) * 0.03; // faint paper grain

    // Portrait inside the window
    vec2 uvP = (pa / vec2(0.93, 1.42) + 1.0) * 0.5;
    float window = smoothstep(0.008, -0.008, sdWindow);
    vec3 art = texture2D(uTex, clamp(uvP, 0.0, 1.0)).rgb;
    // Whisper of a vignette — just enough to seat the art
    art *= 1.0 - 0.09 * smoothstep(0.55, 1.0, length(pa / vec2(1.0, 1.45)));
    col = mix(col, art, window);

    // Gold keyline around the window, bright hairline at the outer edge
    float keyline = smoothstep(0.02, 0.0, abs(sdWindow));
    col = mix(col, vec3(0.976, 0.698, 0.133), keyline * 0.9);
    float hairline = smoothstep(0.016, 0.0, abs(sdCard + 0.012));
    col = mix(col, vec3(0.96, 0.92, 0.86), hairline * 0.5);

    // Holo sheen: an iridescent band that sweeps with time and pointer tilt
    float s = dot(pa, normalize(vec2(0.8, 1.0)));
    float c = sin(uTime * 0.3) * 1.5 + uTilt.x * 4.0 - uTilt.y * 2.0;
    float band = exp(-pow((s - c) * 2.6, 2.0));
    vec3 iri = mix(vec3(0.082, 0.631, 0.671), vec3(0.976, 0.698, 0.133),
                   0.5 + 0.5 * sin(s * 5.0 + uTime * 0.7));
    col += iri * band * (0.1 + keyline * 0.35);

    gl_FragColor = vec4(col, mask * uOpacity);
  }
`;

interface SummonEngine {
  dispose(): void;
  setPaused(paused: boolean): void;
  summonNext(): void;
}

interface EngineOpts {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  stage: HTMLElement;
  mobile: boolean;
  onSummon: (s: Summon) => void;
  onFail: () => void;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${url}`));
    img.src = url;
  });
}

// A relationship-halo node: circular portrait, relation-coloured ring,
// name + relation label — baked into one canvas texture.
function drawBondNode(img: HTMLImageElement | null, bond: Bond): HTMLCanvasElement {
  const W = 320;
  const H = 400;
  const cx = W / 2;
  const cy = 140;
  const r = 108;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const color = REL_COLOR[bond.rel];

  // Soft glow behind the disc
  const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.35);
  glow.addColorStop(0, `${color}55`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, cy + r * 1.5);

  // Circle-clipped portrait (crop toward the top of the 2:3 image — faces live there)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const side = Math.min(img.width, img.height);
    const sy = Math.max(0, img.height * 0.04);
    ctx.drawImage(img, (img.width - side) / 2, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#1a2d3e';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#f5ebdc';
    ctx.font = "700 64px 'Righteous', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bond.name.charAt(0), cx, cy);
  }
  ctx.restore();

  // Relation ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.stroke();

  // Name + relation label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f5ebdc';
  ctx.font = "600 30px 'Poppins', sans-serif";
  ctx.fillText(bond.name, cx, cy + r + 52);
  ctx.fillStyle = color;
  ctx.font = "600 19px 'Poppins', sans-serif";
  const rel = bond.rel.toUpperCase().split('').join('  ');
  ctx.fillText(rel, cx, cy + r + 86);

  return canvas;
}

function makeGlowSprite(rgb: string, alpha: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, `rgba(${rgb},${alpha})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Sprite(mat);
}

// Halo layout slots (pre-scale, relative to the portrait centre)
const BOND_SLOTS: Record<number, [number, number, number][]> = {
  1: [[1.5, 0.55, 0.1]],
  2: [
    [-1.5, 0.7, -0.2],
    [1.5, -0.45, 0.15],
  ],
  3: [
    [-1.5, 0.75, -0.2],
    [1.52, 0.45, 0.15],
    [-1.28, -0.95, 0.1],
  ],
  4: [
    [-1.5, 0.8, -0.2],
    [1.52, 0.7, 0.15],
    [-1.38, -0.9, 0.12],
    [1.45, -0.85, -0.15],
  ],
};

function createSummoningScene(opts: EngineOpts): SummonEngine {
  const { canvas, container, stage, mobile, onSummon, onFail } = opts;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 40);
  camera.position.set(0, 0, CAMERA_Z);

  const disposables: { dispose(): void }[] = [renderer];
  const track = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  /* --- Starfield ------------------------------------------------- */
  const STARS = mobile ? 140 : 300;
  const starGeo = track(new THREE.BufferGeometry());
  {
    const pos = new Float32Array(STARS * 3);
    const col = new Float32Array(STARS * 3);
    const palette = [
      new THREE.Color('#f5ebdc'),
      new THREE.Color('#15A1AB'),
      new THREE.Color('#E77333'),
      new THREE.Color('#7a93a3'),
    ];
    for (let i = 0; i < STARS; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = -0.5 - Math.random() * 6;
      const c = palette[Math.floor(Math.random() * palette.length)];
      const dim = 0.25 + Math.random() * 0.5;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const starMat = track(
    new THREE.PointsMaterial({
      size: 0.022,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* --- Summon group (portrait + glows + halo) --------------------- */
  const group = new THREE.Group();
  scene.add(group);

  const warmGlow = makeGlowSprite('231,115,51', 0.5);
  warmGlow.scale.set(5.4, 5.4, 1);
  warmGlow.position.set(-0.3, -0.6, -1.1);
  warmGlow.material.opacity = 0;
  track(warmGlow.material.map as THREE.Texture);
  track(warmGlow.material);
  group.add(warmGlow);

  const coolGlow = makeGlowSprite('21,161,171', 0.35);
  coolGlow.scale.set(3.6, 3.6, 1);
  coolGlow.position.set(0.9, 1.0, -1.4);
  coolGlow.material.opacity = 0;
  track(coolGlow.material.map as THREE.Texture);
  track(coolGlow.material);
  group.add(coolGlow);

  /* --- Portrait particles ----------------------------------------- */
  const COLS = mobile ? 72 : 100;
  const ROWS = mobile ? 108 : 150;
  const COUNT = COLS * ROWS;

  const particleGeo = track(new THREE.BufferGeometry());
  {
    const position = new Float32Array(COUNT * 3); // required by three, unused in shader
    const uv = new Float32Array(COUNT * 2);
    const scatter = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    let i = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        uv[i * 2] = (x + 0.5) / COLS;
        uv[i * 2 + 1] = (y + 0.5) / ROWS;
        // Dispersed home: a loose shell around the portrait
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const rad = 1.7 + Math.random() * 1.3;
        scatter[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
        scatter[i * 3 + 1] = rad * Math.sin(phi) * Math.sin(theta) * 0.8;
        scatter[i * 3 + 2] = rad * Math.cos(phi) * 0.6 - 0.2;
        seed[i] = Math.random();
        i++;
      }
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    particleGeo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    particleGeo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
    particleGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    particleGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 4);
  }

  const placeholderTex = track(
    new THREE.DataTexture(new Uint8Array([11, 24, 32, 255]), 1, 1, THREE.RGBAFormat),
  );
  placeholderTex.needsUpdate = true;

  const particleMat = track(
    new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: placeholderTex },
        uTexB: { value: placeholderTex },
        uMix: { value: 0 },
        uSwirl: { value: 0 },
        uAssemble: { value: 0 },
        uReveal: { value: 0 },
        uTime: { value: 0 },
        uScale: { value: 1 },
        uSpacing: { value: (PLANE_H / ROWS) * 1.25 },
      },
    }),
  );
  // The card group tilts as one: particles assemble inside it, and the
  // crisp card resolves around them, so the float reads as a single object.
  const card = new THREE.Group();
  group.add(card);

  const particles = new THREE.Points(particleGeo, particleMat);
  particles.frustumCulled = false;
  particles.renderOrder = 1;
  particles.position.z = 0.03; // in front of the card face
  card.add(particles);

  /* --- The trading card ------------------------------------------- */
  const revealGeo = track(new THREE.PlaneGeometry(PLANE_W, PLANE_H));
  const revealMat = track(
    new THREE.ShaderMaterial({
      vertexShader: REVEAL_VERT,
      fragmentShader: REVEAL_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: placeholderTex },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uTilt: { value: new THREE.Vector2(0, 0) },
      },
    }),
  );
  const revealPlane = new THREE.Mesh(revealGeo, revealMat);
  revealPlane.renderOrder = 0;
  card.add(revealPlane);

  // Soft floor shadow that grounds the floating card
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 128;
  {
    const ctx = shadowCanvas.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(128, 64, 4, 128, 64, 120);
      g.addColorStop(0, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.scale(1, 0.5);
      ctx.fillRect(0, 0, 256, 256);
    }
  }
  const shadowTex = track(new THREE.CanvasTexture(shadowCanvas));
  const shadowMat = track(
    new THREE.SpriteMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const shadow = new THREE.Sprite(shadowMat);
  shadow.scale.set(2.4, 0.7, 1);
  shadow.position.set(0, -1.85, -0.25);
  group.add(shadow);

  /* --- Texture + halo caches -------------------------------------- */
  const texCache = new Map<string, THREE.Texture>();
  const texLoader = new THREE.TextureLoader();
  const loadPortrait = (id: string): Promise<THREE.Texture> => {
    const hit = texCache.get(id);
    if (hit) return Promise.resolve(hit);
    return texLoader.loadAsync(P800(id)).then((tex) => {
      // Trilinear + anisotropy keeps the card crisp while it tilts
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texCache.set(id, tex);
      return tex;
    });
  };

  const nodeTexCache = new Map<string, THREE.CanvasTexture>();
  const buildNodeTexture = async (bond: Bond): Promise<THREE.CanvasTexture> => {
    const key = `${bond.id}:${bond.rel}`;
    const hit = nodeTexCache.get(key);
    if (hit) return hit;
    const img = await loadImage(P(bond.id)).catch(() => null);
    const tex = new THREE.CanvasTexture(drawBondNode(img, bond));
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    nodeTexCache.set(key, tex);
    return tex;
  };

  interface Halo {
    group: THREE.Group;
    materials: (THREE.MeshBasicMaterial | THREE.LineBasicMaterial)[];
    nodes: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number }[];
    pulses: { sprite: THREE.Sprite; curve: THREE.QuadraticBezierCurve3; phase: number }[];
    dispose(): void;
  }

  const buildHalo = async (s: Summon): Promise<Halo> => {
    const g = new THREE.Group();
    const materials: (THREE.MeshBasicMaterial | THREE.LineBasicMaterial)[] = [];
    const nodes: Halo['nodes'] = [];
    const pulses: Halo['pulses'] = [];
    const owned: { dispose(): void }[] = [];
    const slots = BOND_SLOTS[Math.min(s.bonds.length, 4)] ?? BOND_SLOTS[4];
    const textures = await Promise.all(s.bonds.slice(0, 4).map(buildNodeTexture));

    s.bonds.slice(0, 4).forEach((bond, i) => {
      const [sx, sy, sz] = slots[i];
      // Narrow viewports pull the halo in so nodes never clip the screen edge
      const base = new THREE.Vector3(mobile ? sx * 0.86 : sx, sy, sz);

      // Node card
      const nodeGeo = new THREE.PlaneGeometry(0.82, 1.025);
      const nodeMat = new THREE.MeshBasicMaterial({
        map: textures[i],
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      owned.push(nodeGeo, nodeMat);
      const mesh = new THREE.Mesh(nodeGeo, nodeMat);
      mesh.position.copy(base);
      mesh.renderOrder = 3;
      materials.push(nodeMat);
      nodes.push({ mesh, base, phase: Math.random() * Math.PI * 2 });
      g.add(mesh);

      // Curved connection from the portrait's edge to the node
      const dir = base.clone().setZ(0).normalize();
      const edgeT =
        1 / Math.sqrt((dir.x / (PLANE_W / 2 + 0.06)) ** 2 + (dir.y / (PLANE_H / 2 - 0.1)) ** 2);
      const start = dir.clone().multiplyScalar(edgeT);
      const end = base.clone().sub(dir.clone().multiplyScalar(0.42));
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.z += 0.18;
      mid.y += (Math.random() - 0.5) * 0.15;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(REL_COLOR[bond.rel]),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      owned.push(lineGeo, lineMat);
      materials.push(lineMat);
      const line = new THREE.Line(lineGeo, lineMat);
      line.renderOrder = 3;
      g.add(line);

      // Energy pulse that travels the bond, card → node
      const pulse = makeGlowSprite(REL_RGB[bond.rel], 0.95);
      pulse.scale.set(0.24, 0.24, 1);
      pulse.material.opacity = 0;
      pulse.renderOrder = 4;
      owned.push(pulse.material.map as THREE.Texture, pulse.material);
      pulses.push({ sprite: pulse, curve, phase: Math.random() });
      g.add(pulse);
    });

    return {
      group: g,
      materials,
      nodes,
      pulses,
      dispose: () => owned.forEach((d) => d.dispose()),
    };
  };
  const haloCache = new Map<string, Halo>();
  const getHalo = async (s: Summon): Promise<Halo> => {
    const hit = haloCache.get(s.id);
    if (hit) return hit;
    const halo = await buildHalo(s);
    haloCache.set(s.id, halo);
    return halo;
  };

  /* --- State machine ----------------------------------------------- */
  // 'morph' replaces the old disperse -> wait -> reassemble chain: one
  // continuous cosine curve where the cloud lifts, swirls, crossfades to
  // the next legend mid-air, and lands — no dead stop, no colour pop.
  type Phase = 'waiting' | 'assemble' | 'hold' | 'morph';
  let phase: Phase = 'waiting';
  let phaseT = 0;
  let index = Math.floor(Math.random() * SUMMONS.length);
  let activeHalo: Halo | null = null;
  let haloAlpha = 0;
  let disposed = false;
  let paused = false;
  let rafId = 0;
  let loadFailures = 0;
  let canvasReady = false;
  let morphPending = false;
  let morphSwapped = false;
  let pendingNext: { s: Summon; tex: THREE.Texture; index: number } | null = null;

  const ASSEMBLE_S = 2.0;
  const HOLD_S = 6.2;
  const MORPH_S = 2.6;

  const preload = (s: Summon) => {
    loadPortrait(s.id).catch(() => {});
    document.fonts.ready.then(() => {
      if (!disposed) getHalo(s).catch(() => {});
    });
  };

  const beginSummon = async (s: Summon) => {
    try {
      const tex = await loadPortrait(s.id);
      if (disposed) return;
      loadFailures = 0;
      particleMat.uniforms.uTex.value = tex;
      revealMat.uniforms.uTex.value = tex;
      warmGlow.material.color.set(s.accent);
      phase = 'assemble';
      phaseT = 0;
      onSummon(s);
      // Halo attaches as soon as it's built (may land mid-assemble; that's fine)
      document.fonts.ready.then(() =>
        getHalo(s)
          .then((halo) => {
            if (disposed || SUMMONS[index].id !== s.id) return;
            if (activeHalo) group.remove(activeHalo.group);
            activeHalo = halo;
            haloAlpha = 0;
            group.add(halo.group);
          })
          .catch(() => {}),
      );
      // Warm the cache for the next legend while this one is on stage
      preload(SUMMONS[(index + 1) % SUMMONS.length]);
    } catch {
      if (disposed) return;
      // Portrait failed to load — skip to the next legend; if the whole
      // roster fails (offline, CDN down), hand the hero back to the static path
      loadFailures += 1;
      if (loadFailures >= SUMMONS.length) {
        onFail();
        return;
      }
      index = (index + 1) % SUMMONS.length;
      beginSummon(SUMMONS[index]);
    }
  };

  // Loads the next legend, then starts the morph. If a portrait fails,
  // walks the roster; a full sweep of failures falls back to static.
  const startMorph = () => {
    if (disposed || morphPending || phase !== 'hold') return;
    morphPending = true;
    const tryLoad = (i: number, attempts: number) => {
      const nextIndex = i % SUMMONS.length;
      const s = SUMMONS[nextIndex];
      loadPortrait(s.id)
        .then((tex) => {
          if (disposed) return;
          pendingNext = { s, tex, index: nextIndex };
          particleMat.uniforms.uTexB.value = tex;
          morphSwapped = false;
          morphPending = false;
          phase = 'morph';
          phaseT = 0;
        })
        .catch(() => {
          if (disposed) return;
          if (attempts >= SUMMONS.length) {
            onFail();
            return;
          }
          tryLoad(nextIndex + 1, attempts + 1);
        });
    };
    tryLoad(index + 1, 1);
  };

  const summonNext = () => {
    if (disposed) return;
    startMorph();
  };

  /* --- Layout ------------------------------------------------------ */
  const alignToStage = () => {
    const cRect = container.getBoundingClientRect();
    const sRect = stage.getBoundingClientRect();
    if (cRect.width === 0 || cRect.height === 0) return;

    renderer.setSize(cRect.width, cRect.height, false);
    camera.aspect = cRect.width / cRect.height;
    camera.updateProjectionMatrix();
    particleMat.uniforms.uScale.value =
      (cRect.height * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));

    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAMERA_Z;
    const visW = visH * camera.aspect;
    const worldPerPxX = visW / cRect.width;
    const worldPerPxY = visH / cRect.height;

    const stageCx = sRect.left + sRect.width / 2 - (cRect.left + cRect.width / 2);
    const stageCy = sRect.top + sRect.height / 2 - (cRect.top + cRect.height / 2);
    group.position.x = stageCx * worldPerPxX;
    group.position.y = -stageCy * worldPerPxY + 0.14;

    const scale = Math.min(
      (sRect.width * worldPerPxX) / GROUP_W,
      (sRect.height * 0.84 * worldPerPxY) / GROUP_H,
    );
    const s = THREE.MathUtils.clamp(scale, 0.34, 1.18);
    group.scale.set(s, s, s);
  };

  const ro = new ResizeObserver(alignToStage);
  ro.observe(container);
  ro.observe(stage);
  alignToStage();

  /* --- Pointer ------------------------------------------------------ */
  const camTarget = new THREE.Vector2(0, 0);

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = container.getBoundingClientRect();
    camTarget.set(
      ((e.clientX - r.left) / r.width - 0.5) * 0.34,
      -((e.clientY - r.top) / r.height - 0.5) * 0.22,
    );
  };
  container.addEventListener('pointermove', onMove, { passive: true });

  let downAt = 0;
  let downX = 0;
  let downY = 0;
  const onDown = (e: PointerEvent) => {
    downAt = performance.now();
    downX = e.clientX;
    downY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (performance.now() - downAt < 350 && Math.hypot(e.clientX - downX, e.clientY - downY) < 12) {
      summonNext();
    }
  };
  canvas.addEventListener('pointerdown', onDown, { passive: true });
  canvas.addEventListener('pointerup', onUp, { passive: true });

  const onContextLost = (e: Event) => {
    e.preventDefault();
    onFail();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  /* --- Loop --------------------------------------------------------- */
  const clock = new THREE.Clock();
  let elapsed = 0;
  let reveal = 0;

  const frame = () => {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);
    if (paused) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    phaseT += dt;

    if (phase === 'assemble') {
      particleMat.uniforms.uAssemble.value = Math.min(phaseT / ASSEMBLE_S, 1);
      if (phaseT >= ASSEMBLE_S) {
        phase = 'hold';
        phaseT = 0;
      }
    } else if (phase === 'hold') {
      particleMat.uniforms.uAssemble.value = 1;
      if (phaseT >= HOLD_S) startMorph();
    } else if (phase === 'morph') {
      const p = Math.min(phaseT / MORPH_S, 1);
      // One cosine breath: 1 -> 0 -> 1, never stopping
      particleMat.uniforms.uAssemble.value = 0.5 + 0.5 * Math.cos(Math.PI * 2 * p);
      particleMat.uniforms.uSwirl.value = Math.sin(Math.PI * p);
      particleMat.uniforms.uMix.value = THREE.MathUtils.smoothstep(p, 0.36, 0.62);
      if (!morphSwapped && p >= 0.5 && pendingNext) {
        // Identity changes at the trough, while the cloud is pure stardust
        morphSwapped = true;
        const pn = pendingNext;
        index = pn.index;
        onSummon(pn.s);
        revealMat.uniforms.uTex.value = pn.tex;
        warmGlow.material.color.set(pn.s.accent);
        if (activeHalo) {
          group.remove(activeHalo.group);
          activeHalo = null;
        }
        haloAlpha = 0;
        document.fonts.ready.then(() =>
          getHalo(pn.s)
            .then((halo) => {
              if (disposed || SUMMONS[index].id !== pn.s.id) return;
              activeHalo = halo;
              group.add(halo.group);
            })
            .catch(() => {}),
        );
      }
      if (p >= 1 && pendingNext) {
        particleMat.uniforms.uTex.value = pendingNext.tex;
        particleMat.uniforms.uMix.value = 0;
        particleMat.uniforms.uSwirl.value = 0;
        particleMat.uniforms.uAssemble.value = 1;
        pendingNext = null;
        phase = 'hold';
        phaseT = 0;
        preload(SUMMONS[(index + 1) % SUMMONS.length]);
      }
    }

    // The crisp card resolves once the particles have fully assembled,
    // and dissolves back to dust the instant dispersal starts
    const assembleV = particleMat.uniforms.uAssemble.value as number;
    const revealTarget = phase === 'hold' ? 1 : 0;
    reveal += (revealTarget - reveal) * Math.min(dt * (revealTarget ? 2.6 : 7), 1);
    revealMat.uniforms.uOpacity.value = reveal;
    particleMat.uniforms.uReveal.value = reveal;
    shadowMat.opacity = reveal * 0.42;

    // The card floats: slow wobble plus pointer-follow tilt
    const tiltX = camTarget.x * 0.35 + Math.sin(elapsed * 0.5) * 0.05;
    const tiltY = -camTarget.y * 0.3 + Math.cos(elapsed * 0.42) * 0.035;
    card.rotation.y += (tiltX - card.rotation.y) * Math.min(dt * 3, 1);
    card.rotation.x += (tiltY - card.rotation.x) * Math.min(dt * 3, 1);
    card.position.y = Math.sin(elapsed * 0.7) * 0.04 * reveal;
    (revealMat.uniforms.uTilt.value as THREE.Vector2).set(card.rotation.y, card.rotation.x);

    // Halo fades in late in assembly, out early in dispersal
    const haloTarget = (phase === 'hold' || phase === 'assemble') && assembleV > 0.75 ? 1 : 0;
    haloAlpha += (haloTarget - haloAlpha) * Math.min(dt * 3.2, 1);
    if (activeHalo) {
      activeHalo.materials.forEach((m) => {
        m.opacity = haloAlpha;
      });
      activeHalo.nodes.forEach((n) => {
        n.mesh.position.y = n.base.y + Math.sin(elapsed * 0.8 + n.phase) * 0.045;
        n.mesh.position.x = n.base.x + Math.cos(elapsed * 0.6 + n.phase) * 0.02;
      });
      activeHalo.pulses.forEach((pl) => {
        const t = (elapsed * 0.22 + pl.phase) % 1;
        pl.sprite.position.copy(pl.curve.getPoint(t));
        pl.sprite.material.opacity = haloAlpha * Math.sin(t * Math.PI) * 0.9;
      });
    }

    // Glows breathe with the summon
    warmGlow.material.opacity = 0.16 + assembleV * 0.3;
    coolGlow.material.opacity = 0.08 + assembleV * 0.18;

    // Camera parallax + slow starfield drift
    camera.position.x += (camTarget.x - camera.position.x) * Math.min(dt * 4, 1);
    camera.position.y += (camTarget.y - camera.position.y) * Math.min(dt * 4, 1);
    stars.rotation.z = elapsed * 0.008;

    particleMat.uniforms.uTime.value = elapsed;
    revealMat.uniforms.uTime.value = elapsed;
    renderer.render(scene, camera);
    if (!canvasReady) {
      canvasReady = true;
      canvas.classList.add('ready');
    }
  };

  beginSummon(SUMMONS[index]);
  rafId = requestAnimationFrame(frame);

  return {
    setPaused(p: boolean) {
      if (paused === p) return;
      paused = p;
      if (!p) clock.getDelta(); // swallow the paused interval
    },
    summonNext,
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      container.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      haloCache.forEach((h) => h.dispose());
      nodeTexCache.forEach((t) => t.dispose());
      texCache.forEach((t) => t.dispose());
      starGeo.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}

/* ------------------------------------------------------------------ */
/* CSS                                                                 */
/* ------------------------------------------------------------------ */

// Loaded via an injected <link> on mount (see the fonts effect) — a CSS @import
// here would only start fetching after this <style> mounts and applies late.
const FONTS_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Righteous&display=swap';

const CSS = `

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#0b1820; --surface:#142130; --card:#1a2d3e;
    --orange:#E77333; --yellow:#F9B222; --beige:#f5ebdc;
    --muted:#7a93a3; --border:#253d50; --teal:rgb(21,161,171); --radius:16px;
    --ease:cubic-bezier(.16,1,.3,1); /* expo-out — the page's one easing voice */
  }
  html {
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
    /* One consistent gradient scrim at every scroll position — the same
       ink fade the app TopBar carries (near-solid over the logo row, easing
       to transparent), so the nav never restyles mid-scroll. */
    background:linear-gradient(to bottom, rgba(11,24,32,1) 0%, rgba(11,24,32,0.85) 30%, rgba(11,24,32,0.45) 62%, rgba(11,24,32,0.14) 84%, transparent 100%);
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
    position:relative; min-height:100svh;
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

  /* --- The Summoning (3D hero) --- */
  .summon-canvas {
    position:absolute; inset:0; width:100%; height:100%;
    opacity:0; transition:opacity 1.1s ease; z-index:1;
    touch-action:pan-y; /* orbit-free: taps summon, scroll stays native */
    /* Dissolve the particle field into the ink before the hero's bottom edge —
       without this the starfield ends in a hard clipped line against the next
       section. */
    mask-image:linear-gradient(to bottom, #000 0%, #000 72%, transparent 98%);
    -webkit-mask-image:linear-gradient(to bottom, #000 0%, #000 72%, transparent 98%);
  }
  .summon-canvas.ready { opacity:1; }
  .hero-accent {
    position:absolute; inset:0; pointer-events:none; z-index:1;
    background:radial-gradient(48% 42% at 27% 42%,var(--accent-soft,rgba(231,115,51,0.12)) 0%,transparent 72%);
  }
  .hero--3d {
    text-align:left;
    padding:110px 24px 64px;
  }
  .hero-grid {
    position:relative; z-index:2;
    display:grid; grid-template-columns:minmax(380px,0.95fr) minmax(0,1.3fr);
    gap:0; align-items:center;
    width:100%; max-width:1220px; margin:0 auto;
    min-height:calc(100svh - 190px);
  }
  /* No container — the copy sits directly in the starfield; a soft local
     darkening behind it keeps the type readable without drawing a box */
  .hero-panel {
    position:relative; z-index:2;
    padding:24px 0;
  }
  .hero-panel::before {
    content:''; position:absolute; inset:-90px -140px; pointer-events:none; z-index:-1;
    /* closest-side: the fade completes exactly at the nearest box edge, so
       the wash never hard-clips against its own bounds */
    background:radial-gradient(closest-side at 42% 45%,rgba(11,24,32,0.72) 0%,rgba(11,24,32,0.32) 55%,transparent 100%);
  }
  .hero--3d .hero-wordmark-large {
    font-size:clamp(52px,7vw,92px); margin-bottom:28px; letter-spacing:-2px;
    text-shadow:0 6px 70px var(--accent-strong,rgba(231,115,51,0.35));
    transition:text-shadow 1.2s ease;
  }
  .hero--3d .hero-tagline { margin-bottom:14px; }
  .hero--3d .hero-sub { margin:0 0 34px; max-width:440px; }
  .hero--3d .hero-ctas { justify-content:flex-start; }

  .summon-stage {
    position:relative; align-self:stretch;
    min-height:420px; pointer-events:none;
    margin-left:-72px; /* the scene drifts behind the copy column's edge */
  }
  .summon-plate {
    position:absolute; left:50%; bottom:-6px; transform:translateX(-50%);
    display:flex; flex-direction:column; align-items:center; gap:6px;
    pointer-events:none; white-space:nowrap;
  }
  .summon-plate::before {
    content:''; width:36px; height:3px; border-radius:2px; margin-bottom:4px;
    background:var(--accent,var(--yellow)); transition:background .8s ease;
  }
  .plate-name {
    font-family:'Righteous',sans-serif; font-size:30px; color:var(--beige);
    letter-spacing:0.5px; text-shadow:0 2px 18px rgba(11,24,32,0.9);
    animation:plateIn .6s cubic-bezier(.22,.7,.25,1) both;
  }
  .plate-universe {
    font-size:10px; font-weight:600; letter-spacing:3px; text-transform:uppercase;
    color:var(--muted);
  }
  .plate-summon {
    pointer-events:auto; margin-top:10px;
    background:rgba(20,33,48,0.7); color:var(--beige);
    border:1px solid var(--border); border-radius:100px;
    font-family:'Righteous',sans-serif; font-size:12px; letter-spacing:0.5px;
    padding:8px 18px; cursor:pointer;
    -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);
    transition:border-color 200ms,transform 150ms,background 200ms;
  }
  .plate-summon:hover { border-color:var(--yellow); background:rgba(26,45,62,0.85); transform:translateY(-1px); }
  @keyframes plateIn {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:none; }
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

  /* Bond-spectrum hairline — the page's structural signature. The gradient is
     the relation legend from the hero: enemy orange -> kin yellow -> ally teal. */
  .hairline { position:relative; }
  .hairline::before {
    content:''; position:absolute; top:-1px; left:0; right:0; height:2px;
    background:linear-gradient(90deg,#E77333 0%,#F9B222 45%,#15A1AB 100%);
    opacity:0.75; pointer-events:none;
  }

  .stats {
    background:
      radial-gradient(ellipse 50% 90% at 50% 0%,rgba(231,115,51,0.07) 0%,transparent 70%),
      var(--surface);
    border-bottom:1px solid var(--border);
    padding:0 40px;
  }
  .stats-inner {
    max-width:1100px; margin:0 auto; padding:40px 0;
    display:grid; grid-template-columns:repeat(4,1fr);
  }
  .stat-item {
    display:flex; flex-direction:column; align-items:flex-start;
    padding:0 36px; border-right:1px solid var(--border);
  }
  .stat-item:first-child { padding-left:0; }
  .stat-item:last-child { border-right:none; }
  .stat-num { font-family:'Righteous',sans-serif; font-size:clamp(30px,3.4vw,42px); color:var(--beige); line-height:1; }
  .stat-tick { display:block; width:26px; height:3px; border-radius:2px; margin:12px 0 8px; }
  .stat-label { font-size:12px; color:var(--muted); letter-spacing:1.5px; text-transform:uppercase; }

  /* Outer clipper never transforms — it's what actually stops the tilted
     band from bleeding past the viewport and causing page-level horizontal
     scroll (a rotated full-width box's bounding rect is always wider than
     the box itself). The rotation/scale lives on the inner layer instead. */
  .marquee-clip { overflow:hidden; width:100%; margin:2px 0; padding:18px 0; }
  .marquee-wrapper {
    overflow:hidden; padding:18px 0;
    /* Overscan past both edges so the tilt never shows a cut end */
    width:112%; margin-left:-6%;
    background:linear-gradient(100deg,#d9662a 0%,var(--orange) 45%,#f2813e 100%);
    border-top:1px solid rgba(255,255,255,0.1); border-bottom:1px solid rgba(0,0,0,0.2);
    transform:rotate(-1.2deg);
    box-shadow:0 12px 40px rgba(231,115,51,0.18);
  }
  .mq-outline {
    color:transparent;
    -webkit-text-stroke:1.1px rgba(255,255,255,0.85);
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
  .section-eyebrow::before {
    content:''; display:inline-block; width:22px; height:2px; border-radius:2px;
    margin-right:10px; vertical-align:3.5px;
    background:linear-gradient(90deg,var(--orange),var(--yellow));
  }
  .section-heading {
    font-family:'Righteous',sans-serif; font-size:clamp(28px,4vw,44px);
    line-height:1.15; margin-bottom:20px;
  }
  .section-sub { font-size:16px; color:var(--muted); line-height:1.7; max-width:520px; }

  .features-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; margin-top:64px; }
  .feature-card {
    position:relative; overflow:hidden;
    background:var(--card); border:1px solid var(--border);
    border-radius:var(--radius); padding:32px 28px;
    transition:border-color 250ms,transform 200ms,box-shadow 250ms;
  }
  .feature-card::after {
    content:''; position:absolute; inset:0; pointer-events:none;
    background:radial-gradient(230px circle at var(--mx,50%) var(--my,50%),rgba(231,115,51,0.11),transparent 65%);
    opacity:0; transition:opacity 250ms;
  }
  .feature-card:hover::after { opacity:1; }
  .feature-card:hover {
    border-color:var(--orange); transform:translateY(-4px);
    box-shadow:0 14px 44px rgba(231,115,51,0.13);
  }
  .feature-icon {
    width:48px; height:48px; background:rgba(231,115,51,0.12); border-radius:12px;
    display:flex; align-items:center; justify-content:center; margin-bottom:20px;
    transition:background 250ms,transform 250ms;
  }
  .feature-card:hover .feature-icon { background:rgba(231,115,51,0.22); transform:scale(1.06); }
  .feature-icon svg { width:24px; height:24px; stroke:var(--orange); fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .feature-title { font-family:'Righteous',sans-serif; font-size:18px; margin-bottom:12px; }
  .feature-desc { font-size:14px; color:var(--muted); line-height:1.7; }

  /* Bento variants — the graph and the debate are the product's two moats,
     so they get the big cells and live visuals; the rest stay quiet. */
  .fc-wide { grid-column:span 2; display:grid; grid-template-columns:1fr 200px; column-gap:20px; align-items:center; }
  .fc-wide .fc-copy { min-width:0; }
  .fc-tall { grid-row:span 2; display:flex; flex-direction:column; }
  .fc-tall .fc-visual { margin-top:auto; padding-top:24px; }

  /* Mini bond web — real portraits, real relation colours */
  .fc-web { position:relative; height:170px; }
  .fc-web svg { position:absolute; inset:0; width:100%; height:100%; }
  .fc-web-node { position:absolute; display:flex; flex-direction:column; align-items:center; gap:4px; transform:translate(-50%,-50%); }
  .fc-web-node img {
    width:44px; height:44px; border-radius:50%; object-fit:cover; object-position:top;
    border:2px solid var(--node-c,#7a93a3); display:block;
    box-shadow:0 0 14px rgba(0,0,0,0.5);
  }
  .fc-web-node span { font-size:8px; font-weight:600; letter-spacing:1.5px; color:var(--node-c,#7a93a3); text-transform:uppercase; }

  /* Mini head-to-head */
  .fc-bars { display:flex; flex-direction:column; gap:10px; }
  .fc-bar-row { display:grid; grid-template-columns:1fr 1fr; gap:4px; align-items:center; }
  .fc-bar-label { grid-column:1 / -1; font-size:9px; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); }
  .fc-bar { position:relative; height:6px; border-radius:4px; background:var(--surface); overflow:hidden; }
  .fc-bar i { position:absolute; top:0; bottom:0; border-radius:4px; transform:scaleX(0); transition:transform .9s cubic-bezier(.2,.8,.2,1) .25s; }
  .fc-bar.l i { right:0; background:var(--orange); transform-origin:right; }
  .fc-bar.r i { left:0; background:var(--teal); transform-origin:left; }
  .feature-card.in .fc-bar i { transform:scaleX(1); }

  /* Poster chips for On Screen */
  .fc-posters { display:flex; gap:10px; }
  .fc-poster {
    position:relative; width:64px; aspect-ratio:2/3; border-radius:8px; overflow:hidden;
    border:1px solid rgba(245,235,220,0.12); box-shadow:0 8px 22px rgba(0,0,0,0.5);
  }
  .fc-poster img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; }
  .fc-poster::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(to top,rgba(11,24,32,0.75),transparent 55%);
  }
  .fc-poster i {
    position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
    width:0; height:0; border-left:9px solid rgba(255,255,255,0.92);
    border-top:6px solid transparent; border-bottom:6px solid transparent;
    filter:drop-shadow(0 2px 6px rgba(0,0,0,0.6)); z-index:1;
  }

  .screenshots { background:var(--surface); padding:100px 40px; }
  .screenshots-inner { max-width:1100px; margin:0 auto; }
  .screenshots-layout { display:grid; grid-template-columns:1fr 1fr; gap:64px; align-items:center; margin-top:64px; }
  .screenshots-phones { position:relative; display:flex; justify-content:center; align-items:center; min-height:320px; }
  .screenshots-phones::before {
    content:''; position:absolute; inset:-10% -6%; pointer-events:none;
    background:
      radial-gradient(45% 55% at 38% 45%,rgba(21,161,171,0.14) 0%,transparent 70%),
      radial-gradient(38% 45% at 78% 72%,rgba(231,115,51,0.13) 0%,transparent 70%);
  }
  .browser-frame {
    position:relative;
    width:100%; max-width:520px; border-radius:14px; overflow:hidden;
    border:1px solid var(--border); background:var(--card);
    box-shadow:0 30px 80px rgba(0,0,0,0.6);
    transform:perspective(1400px) rotateY(7deg) rotateX(2.5deg) rotate(-1deg);
    transition:transform .6s cubic-bezier(.22,.7,.25,1);
  }
  @media (hover:hover) {
    .screenshots-phones:hover .browser-frame { transform:perspective(1400px) rotateY(0deg) rotateX(0deg) rotate(0deg); }
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
  .hero-mosaic { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-top:56px; grid-auto-flow:dense; }
  .mosaic-card.featured { grid-column:span 2; grid-row:span 2; }
  .mosaic-card.featured .mosaic-name { font-size:19px; bottom:18px; }
  .mosaic-more {
    border:1px dashed rgba(122,147,163,0.55); border-radius:14px; aspect-ratio:2/3;
    background:transparent; cursor:pointer;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
    padding:12px; transition:border-color 250ms,background 250ms,transform 250ms;
  }
  .mosaic-more:hover { border-color:var(--yellow); background:rgba(249,178,34,0.06); transform:scale(1.03); }
  .mosaic-more-num { font-family:'Righteous',sans-serif; font-size:20px; color:var(--yellow); }
  .mosaic-more-label { font-size:11px; color:var(--muted); letter-spacing:0.5px; line-height:1.5; text-align:center; }
  .mosaic-card {
    border-radius:14px; overflow:hidden; aspect-ratio:2/3;
    position:relative; cursor:pointer; transition:transform 250ms,box-shadow 250ms;
  }
  .mosaic-card:hover { transform:scale(1.04); box-shadow:0 16px 48px rgba(0,0,0,0.7); z-index:1; }
  .mosaic-card::before {
    content:''; position:absolute; inset:0; z-index:2; border-radius:14px;
    border:1px solid transparent; pointer-events:none; transition:border-color 250ms;
  }
  .mosaic-card:hover::before { border-color:rgba(249,178,34,0.45); }
  .mosaic-card img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; transition:transform 350ms ease; }
  .mosaic-card:hover img { transform:scale(1.07); }
  .mosaic-card::after {
    content:''; position:absolute; inset:0;
    background:linear-gradient(to bottom,transparent 50%,rgba(11,24,32,0.85) 100%);
  }
  .mosaic-name {
    position:absolute; bottom:12px; left:0; right:0; text-align:center;
    font-family:'Righteous',sans-serif; font-size:13px; color:var(--beige); z-index:1; letter-spacing:0.5px;
  }

  .cta-section {
    padding:100px 40px; text-align:center;
    background:
      radial-gradient(ellipse 60% 70% at 50% 0%,rgba(231,115,51,0.08) 0%,transparent 70%),
      radial-gradient(ellipse 40% 50% at 80% 100%,rgba(21,161,171,0.06) 0%,transparent 70%),
      var(--surface);
    border-top:1px solid var(--border);
  }
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

  /* Head to head */
  .tott { padding:100px 40px; background:var(--bg); position:relative; overflow:hidden; }
  .tott-watermark {
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-6deg);
    font-family:'Righteous',sans-serif; font-size:clamp(240px,36vw,520px); line-height:1;
    color:rgba(245,235,220,0.026); pointer-events:none; user-select:none; z-index:0;
  }
  .tott-inner { max-width:760px; margin:0 auto; text-align:center; position:relative; z-index:1; }
  .tott-verdict {
    margin:24px 26px 0; padding:20px 0 26px; border-top:1px solid var(--border);
    display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap;
    font-size:13px; color:var(--muted); letter-spacing:0.3px;
  }
  .tott-verdict strong { color:var(--hulk); font-weight:600; }
  .tott-verdict-chip {
    font-size:9px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
    color:var(--yellow); border:1px solid rgba(249,178,34,0.35);
    background:rgba(249,178,34,0.08); padding:4px 10px; border-radius:100px;
  }
  .tott-inner .section-eyebrow { color:var(--orange); }
  .tott-inner .section-sub { margin:0 auto; }
  .tott-card {
    margin-top:48px; background:var(--card); border:1px solid var(--border);
    border-radius:24px; padding:0; text-align:left; overflow:hidden;
    --hulk:#74B843; --iron:#E77333;
    box-shadow:0 30px 90px rgba(0,0,0,0.45);
  }

  /* Fight-card head: broadcast-graphic split. Two duotone colour fields with
     a comic halftone texture meet at an angled gold seam; each fighter is a
     2:3 mini trading card breaking out of the band, with an oversized name
     and a rounds-won pip scoreboard. */
  .tott-head { position:relative; height:248px; margin-bottom:44px; }
  .tott-field { position:absolute; inset:0; overflow:hidden; }
  .tott-field::before {
    content:''; position:absolute; inset:0;
    clip-path:polygon(0 0, calc(50% + 42px) 0, calc(50% - 42px) 100%, 0 100%);
    background:
      radial-gradient(circle at 1.2px 1.2px, rgba(245,235,220,0.05) 1.2px, transparent 1.9px),
      radial-gradient(130% 160% at 0% 0%, rgba(116,184,67,0.32) 0%, rgba(116,184,67,0.05) 52%, transparent 78%),
      linear-gradient(115deg, #16291d 0%, #101f2a 78%);
    background-size:13px 13px, auto, auto;
  }
  .tott-field::after {
    content:''; position:absolute; inset:0;
    clip-path:polygon(calc(50% + 48px) 0, 100% 0, 100% 100%, calc(50% - 36px) 100%);
    background:
      radial-gradient(circle at 1.2px 1.2px, rgba(245,235,220,0.05) 1.2px, transparent 1.9px),
      radial-gradient(130% 160% at 100% 0%, rgba(231,115,51,0.32) 0%, rgba(231,115,51,0.06) 52%, transparent 78%),
      linear-gradient(-115deg, #2b1b12 0%, #101f2a 78%);
    background-size:13px 13px, auto, auto;
  }
  .tott-seam {
    position:absolute; top:-8%; bottom:-8%; left:50%; width:4px;
    background:linear-gradient(180deg,var(--yellow),var(--orange));
    transform:translateX(-50%) rotate(19deg);
    border-radius:3px; opacity:0.9;
    box-shadow:0 0 20px rgba(249,178,34,0.4);
  }
  .tott-fcard {
    position:absolute; bottom:-24px; width:150px; aspect-ratio:2/3; z-index:1;
    border-radius:14px; overflow:hidden;
    box-shadow:0 24px 50px rgba(0,0,0,0.65);
  }
  .tott-fcard img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; }
  .tott-fcard.l { left:30px; transform:rotate(-5deg); border:2px solid rgba(116,184,67,0.8); }
  .tott-fcard.r { right:30px; transform:rotate(5deg); border:2px solid rgba(231,115,51,0.8); }
  .tott-fcard.r img { transform:scaleX(-1); }
  .tott-id { position:absolute; top:50%; transform:translateY(-50%); z-index:1; display:flex; flex-direction:column; gap:7px; }
  .tott-id.l { left:206px; align-items:flex-start; }
  .tott-id.r { right:206px; align-items:flex-end; text-align:right; }
  .tott-name {
    font-family:'Righteous',sans-serif; font-size:clamp(26px,3.5vw,40px);
    text-transform:uppercase; letter-spacing:0.5px; line-height:1.02;
    text-shadow:0 3px 20px rgba(0,0,0,0.7);
    max-width:150px; /* long names wrap to two lines instead of crossing the seam */
  }
  .tott-pips { display:flex; gap:5px; margin-top:2px; }
  .tott-pips i { width:9px; height:9px; border-radius:50%; background:var(--pc,#7a93a3); box-shadow:0 1px 6px rgba(0,0,0,0.45); }
  .tott-pips.l { --pc:var(--hulk); }
  .tott-pips.r { --pc:var(--iron); }
  .tott-pip-label { font-size:8px; font-weight:600; letter-spacing:2px; color:var(--muted); text-transform:uppercase; }
  .tott-univ { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--beige); opacity:0.75; display:flex; align-items:center; gap:6px; }
  .tott-univ::before { content:''; width:7px; height:7px; border-radius:50%; background:var(--fc,#7a93a3); }
  .tott-id.l .tott-univ { --fc:var(--hulk); }
  .tott-id.r .tott-univ { --fc:var(--iron); flex-direction:row-reverse; }
  .tott-vs {
    position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); z-index:2;
    font-family:'Righteous',sans-serif; font-size:28px;
    width:74px; height:74px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,var(--orange),var(--yellow));
    border:5px solid #14222f;
    color:#0b1820;
    box-shadow:0 6px 24px rgba(231,115,51,0.4), 0 0 0 7px rgba(249,178,34,0.12);
    animation:vsPulse 3.2s ease-in-out infinite;
  }
  @keyframes vsPulse {
    0%,100% { box-shadow:0 6px 24px rgba(231,115,51,0.4); }
    50%      { box-shadow:0 6px 38px rgba(249,178,34,0.6); }
  }
  .tott-bars { display:flex; flex-direction:column; gap:4px; padding:0 26px; }
  .tott-row {
    display:grid; grid-template-columns:48px 1fr 120px 1fr 48px; align-items:center; gap:12px;
    padding:7px 10px; border-radius:10px; transition:background 200ms;
  }
  .tott-row:hover { background:rgba(245,235,220,0.035); }
  .tott-val { font-family:'Righteous',sans-serif; font-size:14px; color:var(--muted); padding:3px 0; }
  .tott-val.l { text-align:right; justify-self:end; }
  .tott-val.r { text-align:left; justify-self:start; }
  .tott-val.win { padding:3px 9px; border-radius:7px; }
  .tott-val.win.l { color:var(--hulk); background:rgba(116,184,67,0.13); }
  .tott-val.win.r { color:var(--iron); background:rgba(231,115,51,0.13); }
  .tott-label { font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); text-align:center; }
  .tott-bar { position:relative; height:8px; background:var(--surface); border-radius:6px; overflow:hidden; }
  .tott-fill { position:absolute; top:0; bottom:0; border-radius:6px; transform:scaleX(0); transition:transform .9s cubic-bezier(.2,.8,.2,1); }
  .tott-fill.l { right:0; background:linear-gradient(90deg,#5a9a33,var(--hulk)); transform-origin:right; }
  .tott-fill.r { left:0; background:linear-gradient(90deg,var(--iron),#f2813e); transform-origin:left; }
  .tott-fill.lose { opacity:0.38; }
  .tott-card.in .tott-fill { transform:scaleX(1); }
  .tott-card.in .tott-row:nth-child(1) .tott-fill { transition-delay:.05s; }
  .tott-card.in .tott-row:nth-child(2) .tott-fill { transition-delay:.12s; }
  .tott-card.in .tott-row:nth-child(3) .tott-fill { transition-delay:.19s; }
  .tott-card.in .tott-row:nth-child(4) .tott-fill { transition-delay:.26s; }
  .tott-card.in .tott-row:nth-child(5) .tott-fill { transition-delay:.33s; }
  .tott-card.in .tott-row:nth-child(6) .tott-fill { transition-delay:.40s; }

  /* Daily debate teaser — live pair below the Summoning hero. Renders only
     once the server-curated (or seeded-fallback) pair has resolved, so it
     fades in on mount rather than riding the scroll-reveal IO (that observer
     only queries .reveal elements present at first paint). */
  /* --- Today's debate — the live crossfire ---
     The section's job is DEBATE, not the fight (the "Who'd actually win?"
     section further down owns that): the space between the two camps is a
     live comment war — real takes popping in as side-tinted speech bubbles
     over the fighters squaring off below. */
  .debate-teaser { padding:72px 40px 96px; background:var(--bg); position:relative; }
  .debate-inner { max-width:680px; margin:0 auto; text-align:center; }
  .debate-inner .section-sub { margin:0 auto; }
  /* Entrance choreography — component-local IO ('.in'): the global reveal
     observer only registers first-paint elements and this mounts after
     today's pair resolves. */
  .debate-eyebrow, .debate-heading, .debate-sub, .debate-side, .debate-bubble { opacity:0; }
  .debate-teaser.in .debate-eyebrow { animation:debateRise .7s var(--ease) both; }
  .debate-teaser.in .debate-heading { animation:debateRise .7s var(--ease) .08s both; }
  .debate-teaser.in .debate-sub { animation:debateRise .7s var(--ease) .16s both; }
  @keyframes debateRise {
    from { opacity:0; transform:translateY(16px); }
    to { opacity:1; transform:none; }
  }
  .debate-vs-text { color:var(--muted); font-size:0.6em; vertical-align:middle; }
  .debate-live {
    display:inline-flex; align-items:center; gap:7px; margin-left:12px;
    font-size:11px; letter-spacing:2px; color:#ff6b6b; vertical-align:middle;
  }
  .debate-live-dot {
    width:7px; height:7px; border-radius:50%; background:#ff5d5d;
    box-shadow:0 0 10px rgba(255,93,93,0.8);
    animation:debateLivePulse 1.6s ease-in-out infinite;
  }
  @keyframes debateLivePulse {
    0%,100% { opacity:1; transform:scale(1); }
    50% { opacity:0.45; transform:scale(0.75); }
  }

  /* The stage: fighters square off from the bottom corners (side B mirrored so
     they FACE each other), the crossfire of takes filling the air between. */
  .debate-stage {
    position:relative; margin-top:44px; height:380px;
    border-radius:20px; overflow:hidden;
    border:1px solid var(--border);
    background:
      radial-gradient(90% 70% at 12% 100%, rgba(231,115,51,0.13) 0%, transparent 60%),
      radial-gradient(90% 70% at 88% 100%, rgba(21,161,171,0.13) 0%, transparent 60%),
      var(--card);
    box-shadow:0 30px 80px rgba(0,0,0,0.5);
  }
  .debate-side {
    position:absolute; bottom:0; width:50%; height:58%;
    overflow:hidden;
  }
  .debate-side.l { left:0; }
  .debate-side.r { right:0; }
  /* Duotone: grayscale art washed in the camp colour (mix-blend color keeps
     luminance, swaps hue — the montage "ghost gallery" trick), so any source
     art harmonises with the section instead of shouting its own palette. */
  .debate-side img { filter:grayscale(1) contrast(1.06); }
  .debate-side::before {
    content:''; position:absolute; inset:0; z-index:1; mix-blend-mode:color;
  }
  .debate-side.l::before { background:var(--orange); opacity:0.9; }
  .debate-side.r::before { background:var(--teal); opacity:0.9; }
  /* Gold hairline where the camps meet — the debate line. */
  .debate-faceoff-seam {
    position:absolute; bottom:0; left:50%; width:1px; height:58%; z-index:2;
    transform:translateX(-50%);
    background:linear-gradient(to top, rgba(249,178,34,0.9), rgba(249,178,34,0.15) 85%, transparent);
    box-shadow:0 0 14px rgba(249,178,34,0.5);
  }
  .debate-teaser.in .debate-side.l { animation:debateSlideL .8s var(--ease) .2s both; }
  .debate-teaser.in .debate-side.r { animation:debateSlideR .8s var(--ease) .2s both; }
  @keyframes debateSlideL {
    from { opacity:0; transform:translateX(-36px); }
    to { opacity:1; transform:none; }
  }
  @keyframes debateSlideR {
    from { opacity:0; transform:translateX(36px); }
    to { opacity:1; transform:none; }
  }
  .debate-side img {
    position:absolute; inset:0; width:100%; height:100%;
    object-fit:cover; object-position:top;
  }
  /* Face each other: mirror side B (portrait art overwhelmingly faces right). */
  .debate-side.r img { transform:scaleX(-1); }
  .debate-side-fallback {
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    font-family:'Righteous',sans-serif; font-size:56px; color:var(--muted);
    background:var(--surface);
  }
  /* Side-colour rim light from each camp's corner + a floor fade. */
  .debate-side.l::after {
    content:''; position:absolute; inset:0; z-index:2;
    background:linear-gradient(115deg, rgba(231,115,51,0.22) 0%, transparent 55%),
               linear-gradient(to top, rgba(11,24,32,0.78) 0%, transparent 40%),
               linear-gradient(to bottom, rgba(11,24,32,0.55) 0%, transparent 30%);
  }
  .debate-side.r::after {
    content:''; position:absolute; inset:0; z-index:2;
    background:linear-gradient(245deg, rgba(21,161,171,0.22) 0%, transparent 55%),
               linear-gradient(to top, rgba(11,24,32,0.78) 0%, transparent 40%),
               linear-gradient(to bottom, rgba(11,24,32,0.55) 0%, transparent 30%);
  }

  /* The crossfire: takes as side-tinted chat bubbles, popped in on a real
     conversation cadence, tails aimed at their camp. */
  .debate-bubble {
    position:absolute; z-index:3; max-width:62%;
    padding:11px 14px 12px; border-radius:14px; text-align:left;
    font-size:13.5px; line-height:1.45; color:var(--beige);
    background:rgba(20,33,48,0.92);
    -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);
    border:1px solid var(--border);
    box-shadow:0 14px 40px rgba(0,0,0,0.45);
  }
  .debate-bubble .debate-bubble-author {
    display:block; margin-top:6px;
    font-size:10.5px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase;
  }
  .debate-bubble.a { border-color:rgba(231,115,51,0.45); border-bottom-left-radius:4px; }
  .debate-bubble.b { border-color:rgba(21,161,171,0.45); border-bottom-right-radius:4px; }
  .debate-bubble.a .debate-bubble-author { color:var(--orange); }
  .debate-bubble.b .debate-bubble-author { color:var(--teal); }
  .debate-bubble.slot1 { top:22px; left:16px; }
  .debate-bubble.slot2 { top:104px; right:16px; }
  .debate-bubble.slot3 { top:196px; left:50%; transform:translateX(-50%); max-width:66%; }
  .debate-teaser.in .debate-bubble.slot1 { animation:debateBubble .5s cubic-bezier(.2,1.4,.4,1) .65s both; }
  .debate-teaser.in .debate-bubble.slot2 { animation:debateBubble .5s cubic-bezier(.2,1.4,.4,1) 1.25s both; }
  .debate-teaser.in .debate-bubble.slot3 { animation:debateBubbleC .5s cubic-bezier(.2,1.4,.4,1) 1.85s both; }
  @keyframes debateBubble {
    from { opacity:0; transform:translateY(14px) scale(0.86); }
    to { opacity:1; transform:none; }
  }
  @keyframes debateBubbleC {
    from { opacity:0; transform:translateX(-50%) translateY(14px) scale(0.86); }
    to { opacity:1; transform:translateX(-50%); }
  }

  /* Live crowd split — a tug-of-war rope that fills from 50/50 to the real
     tally once revealed, with a glowing KNOT at the contested boundary that
     strains side to side: the argument, visualised as live tension. */
  .debate-split { margin-top:24px; }
  .debate-split-bar {
    position:relative; display:flex; height:14px; border-radius:999px;
    overflow:visible; background:var(--surface);
  }
  .debate-split-fill { height:100%; transition:width .9s var(--ease); }
  .debate-split-fill.l {
    background:linear-gradient(90deg,#c85f2a,var(--orange));
    border-radius:999px 0 0 999px;
  }
  .debate-split-fill.r {
    background:linear-gradient(90deg,var(--teal),#0f7f88);
    border-radius:0 999px 999px 0;
  }
  .debate-knot {
    position:absolute; top:50%; z-index:2;
    transition:left .9s var(--ease);
    transform:translate(-50%,-50%);
  }
  .debate-knot-core {
    display:block; width:26px; height:26px; border-radius:50%;
    background:#0e1c26; border:2px solid var(--yellow);
    box-shadow:0 0 22px rgba(249,178,34,0.55), 0 4px 14px rgba(0,0,0,0.6);
    animation:debateTension 2.6s ease-in-out infinite;
  }
  .debate-knot-core::after {
    content:''; position:absolute; inset:6px; border-radius:50%;
    background:radial-gradient(circle at 40% 35%, var(--yellow), #c98f1a);
  }
  @keyframes debateTension {
    0%,100% { transform:translateX(-2.5px); }
    50% { transform:translateX(2.5px); }
  }
  .debate-split-labels {
    display:flex; justify-content:space-between; align-items:baseline; gap:10px; margin-top:12px;
    font-size:12px; font-weight:700; letter-spacing:0.8px;
    font-family:'Righteous',sans-serif; color:var(--muted);
  }
  .debate-split-labels .l { color:var(--orange); }
  .debate-split-labels .r { color:var(--teal); }
  .debate-split-labels .mid {
    font-family:'Poppins',sans-serif; font-weight:500; letter-spacing:0.3px; font-size:11.5px;
  }
  .debate-teaser .btn-primary { margin-top:30px; }
  @media (prefers-reduced-motion:reduce) {
    .debate-eyebrow,.debate-heading,.debate-sub,.debate-side,.debate-bubble {
      opacity:1 !important; animation:none !important;
    }
    .debate-bubble.slot3 { transform:translateX(-50%) !important; }
    .debate-live-dot, .debate-knot-core { animation:none !important; }
  }

  footer {
    /* Bottom clearance = the iOS toolbar/home-indicator zone, so the page closes
       on breathing ink and the frosted toolbar never sits on the footer text —
       the same close every app page gets from PageEndCap. */
    padding:40px 40px calc(40px + env(safe-area-inset-bottom, 0px) + 28px);
    border-top:1px solid var(--border);
    display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;
    position:relative;
  }
  footer img { height:22px; opacity:0.7; }
  footer p { font-size:13px; color:var(--muted); }
  .footer-tag { font-size:12px; color:var(--muted); letter-spacing:0.5px; opacity:0.8; }
  .footer-support {
    font-size:13px; color:var(--muted); text-decoration:none;
    transition:color 150ms;
  }
  .footer-support:hover { color:var(--teal); }

  /* Hero strip — mobile only */
  .hero-strip { display:none; }

  @media (max-width:1024px) {
    .features-grid { grid-template-columns:repeat(2,1fr); }
    .fc-wide { grid-column:span 2; }
    .fc-tall { grid-row:auto; }
    .hero-mosaic { grid-template-columns:repeat(4,1fr); }
    .hero-mosaic .mosaic-card:nth-child(n+9):not(.mosaic-more) { display:none; }
    .stat-item { padding:0 28px; }
  }

  @media (max-width:900px) {
    .hero-grid { grid-template-columns:1fr; gap:8px; min-height:auto; }
    .hero--3d { text-align:center; padding:100px 20px 40px; }
    .hero--3d .hero-sub { margin:0 auto 30px; }
    .hero--3d .hero-ctas { justify-content:center; }
    .hero-panel { padding:8px 0 0; }
    .summon-stage { min-height:56vh; margin-left:0; }
  }

  @media (max-width:768px) {
    /* Nav */
    nav { padding:14px 20px; }

    /* Hero — tighter, no min-height */
    .hero { padding:88px 20px 52px; min-height:auto; }
    .hero--3d { min-height:100svh; padding:88px 16px 36px; }
    .hc1,.hc2,.hc3,.hc4,.hc5,.hc6,.hc7,.hc8,.hc9,.hc10 { display:none; }
    .scroll-hint { display:none; }
    .plate-name { font-size:19px; }

    /* Hero strip — bleeds to viewport edges */
    .hero-strip {
      display:flex; overflow-x:auto; gap:10px;
      margin: 28px -20px 0; padding: 0 20px;
      scrollbar-width:none;
    }
    .hero-strip::-webkit-scrollbar { display:none; }
    .hero--3d .hero-strip { display:none; }
    .hero-strip-card {
      flex-shrink:0; width:88px; height:124px; border-radius:12px;
      overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.5);
    }
    .hero-strip-card img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; }

    /* Stats — 2×2 grid */
    .stats { padding:0; }
    .stats-inner { display:grid; grid-template-columns:1fr 1fr; padding:0; gap:0; }
    .stat-item { border-right:none; border-bottom:1px solid var(--border); padding:22px 20px; align-items:flex-start; }
    .stat-item:first-child { padding-left:20px; }
    .stat-item:nth-child(odd)  { border-right:1px solid var(--border); }
    .stat-item:nth-child(3),
    .stat-item:nth-child(4)    { border-bottom:none; }
    .stat-num  { font-size:24px; }
    .stat-tick { margin:8px 0 6px; }
    .stat-label { font-size:10px; }

    /* Marquee — straighten on small screens (a tilted edge eats width) */
    .marquee-clip { margin:0; padding:0; }
    .marquee-wrapper { transform:none; width:100%; margin-left:0; }

    /* Sections */
    .section,.screenshots,.showcase,.cta-section,.debate-teaser { padding:64px 20px; }
    .debate-stage { height:340px; }
    .debate-bubble { font-size:12.5px; max-width:72%; }
    .debate-bubble.slot2 { top:96px; }
    .debate-bubble.slot3 { top:184px; max-width:76%; }
    .debate-side { height:52%; }
    .debate-faceoff-seam { height:52%; }
    .section-heading { font-size:clamp(24px,6vw,34px); margin-bottom:16px; }
    .section-sub { font-size:15px; }

    /* Daily debate teaser — smaller portraits, tighter card */
    .debate-card { padding:24px 18px 20px; }

    /* Features — grid layout: icon left, title+desc right */
    .features-grid { grid-template-columns:1fr; gap:10px; margin-top:36px; }
    .feature-card, .feature-card.fc-wide, .feature-card.fc-tall {
      display:grid; grid-template-columns:40px 1fr;
      grid-template-rows:auto auto; column-gap:14px; row-gap:4px; padding:18px;
      grid-column:auto; grid-row:auto;
    }
    .fc-wide .fc-copy { display:contents; }
    .fc-visual { display:none; }
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

    /* Mosaic — 3 cols; featured tile keeps its 2x2 */
    .hero-mosaic { grid-template-columns:repeat(3,1fr); gap:8px; margin-top:36px; }
    .hero-mosaic .mosaic-card:nth-child(n+9):not(.mosaic-more) { display:none; }
    .mosaic-name { font-size:11px; bottom:8px; }
    .mosaic-card.featured .mosaic-name { font-size:15px; bottom:12px; }

    /* Final CTA */
    .cta-sub { font-size:15px; }

    /* Head to head */
    .tott { padding:64px 20px; }
    .tott-card { border-radius:20px; margin-top:32px; }
    .tott-head { height:168px; margin-bottom:30px; }
    .tott-field::before { clip-path:polygon(0 0, calc(50% + 26px) 0, calc(50% - 26px) 100%, 0 100%); }
    .tott-field::after { clip-path:polygon(calc(50% + 31px) 0, 100% 0, 100% 100%, calc(50% - 21px) 100%); }
    .tott-seam { width:3px; transform:translateX(-50%) rotate(17deg); }
    .tott-fcard { width:88px; bottom:-14px; border-radius:10px; }
    .tott-fcard.l { left:14px; }
    .tott-fcard.r { right:14px; }
    .tott-id { gap:4px; }
    .tott-id.l { left:114px; }
    .tott-id.r { right:114px; }
    .tott-name { font-size:18px; max-width:84px; }
    .tott-univ { font-size:8px; letter-spacing:1.5px; }
    .tott-pips { gap:4px; }
    .tott-pips i { width:7px; height:7px; }
    .tott-vs { width:50px; height:50px; font-size:20px; border-width:4px; }
    .tott-bars { padding:0 8px; }
    .tott-row { grid-template-columns:34px 1fr 64px 1fr 34px; gap:6px; padding:5px 6px; }
    .tott-val { font-size:12px; }
    .tott-val.win { padding:2px 6px; }
    .tott-label { font-size:9px; letter-spacing:0.5px; }
    .tott-verdict { margin:16px 14px 0; padding:14px 0 18px; font-size:12px; }
  }

  @media (max-width:480px) {
    /* Full-width hero CTAs */
    .hero-ctas { flex-direction:column; align-items:stretch; width:100%; max-width:300px; margin:0 auto; }
    .btn-primary,.btn-secondary { justify-content:center; }
    .summon-stage { min-height:52vh; }

    /* Store badges */
    .cta-buttons { flex-direction:column; align-items:center; width:100%; }
    .app-store-badge { width:100%; max-width:260px; justify-content:center; }

    /* Footer */
    footer { justify-content:center; text-align:center; flex-direction:column; align-items:center; }
  }

  /* Scroll reveals — one easing voice, different verbs per element:
     text rises, headlines resolve out of blur, cards settle from scale,
     eyebrows wipe in like the ticker, mosaic art breathes to rest. */
  .reveal { opacity:0; transform:translateY(28px); transition:opacity .8s var(--ease), transform .8s var(--ease), filter .8s var(--ease); will-change:opacity,transform; }
  /* Release the compositing layer once revealed: permanent will-change keeps
     every section on its own GPU layer, and iOS Safari clips composited layers
     to the layout viewport while the bottom toolbar collapses — content in the
     under-toolbar band showed the bare canvas instead (the "navy band"). */
  .reveal.in { opacity:1; transform:none; filter:none; will-change:auto; }
  .rv-blur { filter:blur(14px); transform:translateY(14px); }
  .rv-scale { transform:translateY(30px) scale(0.94); }
  .rv-wipe {
    opacity:1; transform:none;
    clip-path:inset(-20% 100% -20% 0);
    transition:clip-path .9s var(--ease);
  }
  .rv-wipe.in { clip-path:inset(-20% -5% -20% 0); }
  .feature-card.reveal { transition:opacity .7s var(--ease), transform .7s var(--ease), border-color .25s ease, box-shadow .25s ease; }
  .mosaic-card.reveal { transition:opacity .7s var(--ease), transform .7s var(--ease), box-shadow .3s ease; }
  /* Ken Burns settle: the art drifts to rest as its tile arrives */
  .mosaic-card.reveal img { transform:scale(1.14); transition:transform 1.3s var(--ease); }
  .mosaic-card.reveal.in img { transform:scale(1); }
  .mosaic-card.reveal.in:hover img { transform:scale(1.07); }

  /* Press feedback — buttons give a little under the finger */
  .btn-primary:active, .btn-secondary:active, .nav-cta:active, .plate-summon:active, .mosaic-more:active {
    transform:translateY(0) scale(0.97);
  }

  /* Hero load-in sequence */
  .hero-content > *, .hero-panel > * { opacity:0; }
  .hero-panel::before { opacity:1; }
  .loaded .hero-content > *, .loaded .hero-panel > * { animation:heroIn .9s var(--ease) both; }
  .loaded .hero-content .hero-wordmark-large, .loaded .hero-panel .hero-wordmark-large { animation-delay:.12s; }
  .loaded .hero-content .hero-tagline, .loaded .hero-panel .hero-tagline { animation-delay:.26s; }
  .loaded .hero-content .hero-sub, .loaded .hero-panel .hero-sub { animation-delay:.38s; }
  .loaded .hero-content .hero-ctas, .loaded .hero-panel .hero-ctas { animation-delay:.5s; }
  @keyframes heroIn { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }

  /* The overture: wordmark letters resolve one by one, then the summon lands */
  .wm-l { display:inline-block; opacity:0; }
  .loaded .wm-l { animation:wmIn .9s var(--ease) both; }
  .loaded .hero-content .hero-wordmark-large, .loaded .hero-panel .hero-wordmark-large { animation:none; opacity:1; }
  @keyframes wmIn {
    from { opacity:0; transform:translateY(26px) scale(0.96); filter:blur(12px); }
    to   { opacity:1; transform:none; filter:none; }
  }
  @media (prefers-reduced-motion:reduce) {
    .hero-card,.scroll-hint,.marquee-track,.tott-vs,.plate-name { animation:none; }
    * { transition-duration:0.01ms !important; }
    .reveal { opacity:1 !important; transform:none !important; filter:none !important; clip-path:none !important; }
    .mosaic-card.reveal img { transform:none !important; }
    .tott-fill { transform:scaleX(1) !important; }
    .fc-bar i { transform:scaleX(1) !important; }
    .marquee-wrapper { transform:none; width:100%; margin-left:0; }
    .marquee-clip { padding:0; }
    .hero-content > *, .hero-panel > * { opacity:1 !important; animation:none !important; }
    .wm-l { opacity:1 !important; animation:none !important; }
  }

  /* Font-loading splash. height:100lvh (not inset:0): fixed elements pin to
     the LAYOUT viewport, which stops at the iOS toolbar — the large-viewport
     height extends the ink under the glass so the splash is edge-to-edge,
     matching the boot LogoLoader and the page behind it.
     NO opacity fade: the splash and the page behind it are the same ink, so a
     cross-fade adds nothing — except a translucency ramp that iOS's toolbar
     glass re-samples on its own cadence (the bottom band visibly faded
     off-beat). The splash unmounts instantly and the hero's staggered
     entrance animations carry the whole transition. */
  .page-loader {
    position:fixed; top:0; left:0; right:0; height:100lvh; z-index:9999;
    background:#0b1820;
    display:flex; align-items:center; justify-content:center;
    /* The root is visibility:hidden while loading (so the toolbar glass can't
       frost the unrevealed page) — the splash itself must stay visible. */
    visibility:visible;
  }
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

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function detect3DSupport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Daily debate teaser                                                 */
/* ------------------------------------------------------------------ */

// First sentence of the AI verdict, used as a hook line when the
// server-curated `daily_debate` row has no hand-written hook text.
function firstSentence(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : trimmed;
}

function DebateSide({ hero, side }: { hero: MatchupHero; side: 'l' | 'r' }) {
  const src = hero.portrait_url ?? hero.image_url ?? null;
  return (
    <div className={`debate-side ${side}`}>
      {src ? (
        <img src={src} alt={hero.name} loading="lazy" />
      ) : (
        <span className="debate-side-fallback" aria-hidden="true">
          {hero.name.charAt(0)}
        </span>
      )}
    </div>
  );
}

interface DebateBubble {
  body: string;
  side: 'a' | 'b';
  author: string;
}

// Teaser only — no inline voting. This section sells the DEBATE (the "Who'd
// actually win?" section further down owns the fight): the air between the
// two camps is a live crossfire of real community takes, popped in on a chat
// cadence, with the tug-of-war tally underneath. The split bar reads the live
// crowd tally (useMatchupVote, same hook the Compare screen uses) and falls
// back to the stat-round split until the tally loads, so it's never a flat
// 50/50 by default.
function DebateTeaser({ matchup, hookText }: { matchup: TodaysMatchup; hookText: string | null }) {
  const router = useRouter();
  const { heroA, heroB, winsA, winsB, verdict } = matchup;
  const { tally } = useMatchupVote(heroA.id, heroB.id);
  const sectionRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [takes, setTakes] = useState<Take[]>([]);

  // Choreograph in when scrolled into view (component-local IO — the global
  // reveal observer only registers first-paint elements, and this section
  // mounts after today's pair resolves).
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Today's real hot takes power the crossfire bubbles.
  useEffect(() => {
    let active = true;
    getTakes(heroA.id, heroB.id)
      .then((rows) => {
        if (active) setTakes(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [heroA.id, heroB.id]);

  // Top takes by agreement, one slot each; editorial camp slogans keep the
  // crossfire alive on days the takes haven't landed yet.
  const bubbles: DebateBubble[] = [...takes]
    .sort((x, y) => y.agreeCount - x.agreeCount)
    .slice(0, 3)
    .map((t) => ({
      body: t.body,
      side: t.pickedId === heroA.id ? ('a' as const) : ('b' as const),
      author: t.displayName ?? 'a fan',
    }));
  if (bubbles.length < 2) {
    const seeds: DebateBubble[] = [
      { body: `${heroA.name} takes this — and it isn't close.`, side: 'a', author: `Team ${heroA.name}` },
      { body: `${heroB.name} wins it nine times out of ten.`, side: 'b', author: `Team ${heroB.name}` },
    ];
    for (const s of seeds) {
      if (bubbles.length >= 2) break;
      if (!bubbles.some((o) => o.side === s.side)) bubbles.push(s);
    }
  }

  const haveTally = !!tally && tally.total > 0;
  const total = haveTally ? tally.total : winsA + winsB;
  const votesA = haveTally ? tally.votesA : winsA;
  const pctA = total > 0 ? Math.round((votesA / total) * 100) : 50;
  const pctB = 100 - pctA;
  // Bar geometry: hold 50/50 until revealed (the CSS width transition then
  // animates to the real split), and never let a side collapse to nothing —
  // a 0/100 tally renders 7/93 visually while the labels stay honest.
  const clampW = (n: number) => Math.min(93, Math.max(7, n));
  const wA = seen ? clampW(pctA) : 50;
  const voteWord = haveTally
    ? `${tally.total.toLocaleString()} ${tally.total === 1 ? 'vote' : 'votes'} in`
    : 'the crowd is deciding';
  const line =
    hookText ?? firstSentence(verdict) ?? `${heroA.name} or ${heroB.name} — who actually wins?`;

  const goVote = () =>
    router.push(`/compare/${heroA.id}/${heroB.id}` as Parameters<typeof router.push>[0]);

  return (
    <section className={`debate-teaser${seen ? ' in' : ''}`} ref={sectionRef}>
      <div className="debate-inner">
        <p className="section-eyebrow debate-eyebrow">
          Today&apos;s debate
          <span className="debate-live" aria-hidden="true">
            <span className="debate-live-dot" />
            LIVE
          </span>
        </p>
        <h2 className="section-heading debate-heading">
          {heroA.name} <span className="debate-vs-text">vs</span> {heroB.name}
        </h2>
        <p className="section-sub debate-sub">{line}</p>

        <div className="debate-stage">
          <DebateSide hero={heroA} side="l" />
          <DebateSide hero={heroB} side="r" />
          <div className="debate-faceoff-seam" aria-hidden="true" />
          {bubbles.map((bubble, idx) => (
            <div key={idx} className={`debate-bubble ${bubble.side} slot${idx + 1}`}>
              {bubble.body}
              <span className="debate-bubble-author">{bubble.author}</span>
            </div>
          ))}
        </div>

        <div className="debate-split">
          <div className="debate-split-bar" aria-hidden="true">
            <div className="debate-split-fill l" style={{ width: `${wA}%` }} />
            <div className="debate-split-fill r" style={{ width: `${100 - wA}%` }} />
            {/* The knot: the contested boundary, straining side to side. */}
            <span className="debate-knot" style={{ left: `${wA}%` }}>
              <span className="debate-knot-core" />
            </span>
          </div>
          <div className="debate-split-labels">
            <span className="l">
              {heroA.name} {pctA}%
            </span>
            <span className="mid">{voteWord}</span>
            <span className="r">
              {pctB}% {heroB.name}
            </span>
          </div>
        </div>

        <button className="btn-primary" onClick={goVote}>
          <svg
            className="btn-icon"
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Join the debate
        </button>
      </div>
    </section>
  );
}

export default function LandingPage({ dom: _dom }: { dom?: import('expo/dom').DOMProps }) {
  const router = useRouter();
  const [fontsReady, setFontsReady] = useState(false);
  const [mode, setMode] = useState<'3d' | 'static'>(() => (detect3DSupport() ? '3d' : 'static'));
  const [summoned, setSummoned] = useState<Summon | null>(null);
  const [debateMatchup, setDebateMatchup] = useState<TodaysMatchup | null>(null);
  const [debateHook, setDebateHook] = useState<string | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SummonEngine | null>(null);

  const fallBack = useCallback(() => setMode('static'), []);

  // Daily debate teaser data — getTodaysMatchup already resolves the
  // server-curated pair with a seeded-pool fallback baked in, so this only
  // comes back null if the pool itself fails (offline, DB down); the teaser
  // section simply doesn't render rather than showing an empty shell.
  useEffect(() => {
    let active = true;
    Promise.all([getTodaysMatchup(), getDailyDebate(todayIso())])
      .then(([matchup, dd]) => {
        if (!active || !matchup) return;
        setDebateMatchup(matchup);
        const pairMatches =
          dd &&
          new Set([dd.heroAId, dd.heroBId]).size === 2 &&
          new Set([dd.heroAId, dd.heroBId, matchup.heroA.id, matchup.heroB.id]).size === 2;
        if (pairMatches) setDebateHook(dd.hookText);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Fonts. The old CSS `@import` (inside the component's injected <style>) only
  // started fetching after JS mounted, and `document.fonts.ready` resolved
  // BEFORE those faces were even registered — so the loader faded while the
  // hero was still in fallback fonts, then everything snapped ("half-baked"
  // first paint). Instead: inject a real <link> (fetch starts immediately,
  // preconnected), wait for its CSS to parse, then wait for the actual display
  // faces before revealing.
  //
  // Choreography: the reveal ALSO waits for the visual viewport to settle.
  // iOS Safari collapses its URL bar on its own clock shortly after load —
  // fading the splash while the toolbar is mid-collapse reads as two unrelated
  // animations fighting. The collapse fires visualViewport resize events, so
  // hold the fade until the viewport has been still for a beat and the reveal
  // always lands on a settled stage.
  useEffect(() => {
    let done = false;
    const ready = () => {
      if (!done) {
        done = true;
        setFontsReady(true);
      }
    };
    let link = document.querySelector<HTMLLinkElement>('link[data-landing-fonts]');
    if (!link) {
      for (const origin of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
        const pre = document.createElement('link');
        pre.rel = 'preconnect';
        pre.href = origin;
        if (origin.includes('gstatic')) pre.crossOrigin = 'anonymous';
        document.head.appendChild(pre);
      }
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONTS_CSS_URL;
      link.setAttribute('data-landing-fonts', '1');
      document.head.appendChild(link);
    }
    const cssReady: Promise<unknown> = link.sheet
      ? Promise.resolve()
      : new Promise((res) => {
          link!.addEventListener('load', res, { once: true });
          link!.addEventListener('error', res, { once: true });
        });
    const fontsP = cssReady.then(() =>
      Promise.all([
        document.fonts.load("400 24px 'Righteous'"),
        document.fonts.load("400 16px 'Poppins'"),
        document.fonts.load("600 16px 'Poppins'"),
      ]),
    );

    // Viewport-settle: resolves once visualViewport has fired no resize for
    // 260ms (the toolbar collapse is a burst of resizes). Immediately settled
    // where visualViewport is unsupported.
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let removeSettle: (() => void) | null = null;
    const viewportP = new Promise<void>((res) => {
      const vv = window.visualViewport;
      if (!vv) return res();
      const fin = () => {
        removeSettle?.();
        res();
      };
      const arm = () => {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(fin, 260);
      };
      vv.addEventListener('resize', arm);
      removeSettle = () => vv.removeEventListener('resize', arm);
      arm();
    });

    Promise.all([fontsP, viewportP]).then(ready, ready);
    const fallback = setTimeout(ready, 3000); // never leave the hero hidden
    return () => {
      clearTimeout(fallback);
      if (settleTimer) clearTimeout(settleTimer);
      removeSettle?.();
    };
  }, []);

  // The Summoning — three.js lifecycle
  useEffect(() => {
    if (mode !== '3d') return;
    const canvas = canvasRef.current;
    const container = heroRef.current;
    const stage = stageRef.current;
    if (!canvas || !container || !stage) return;

    let engine: SummonEngine;
    try {
      engine = createSummoningScene({
        canvas,
        container,
        stage,
        mobile: window.innerWidth < 768,
        onSummon: setSummoned,
        onFail: fallBack,
      });
    } catch {
      // Renderer creation failed (blocked WebGL, headless, driver bug) —
      // defer so the fallback render happens outside this effect pass.
      const t = setTimeout(fallBack, 0);
      return () => clearTimeout(t);
    }
    engineRef.current = engine;

    // Pause when the hero scrolls out of view or the tab is hidden
    let inView = true;
    const applyPause = () => engine.setPaused(!inView || document.hidden);
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
        applyPause();
      },
      { threshold: 0.02 },
    );
    io.observe(container);
    document.addEventListener('visibilitychange', applyPause);

    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', applyPause);
      engine.dispose();
      engineRef.current = null;
    };
  }, [mode, fallBack]);

  // Stats count up the first time the band scrolls into view
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.stat-num[data-target]'));
    if (els.length === 0) return;
    let alive = true;
    const animate = (el: HTMLElement) => {
      const target = Number(el.dataset.target ?? '0');
      const suffix = el.dataset.suffix ?? '';
      const start = performance.now();
      const dur = 1400;
      const tick = (now: number) => {
        if (!alive) return;
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - (1 - p) ** 3;
        el.textContent = `${Math.round(target * eased).toLocaleString('en-US')}${suffix}`;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animate(entry.target as HTMLElement);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      alive = false;
      io.disconnect();
    };
  }, []);

  // Feature cards: spotlight follows the pointer (desktop hover only)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const grid = document.querySelector<HTMLElement>('.features-grid');
    if (!grid) return;
    const onMove = (e: MouseEvent) => {
      grid.querySelectorAll<HTMLElement>('.feature-card').forEach((cardEl) => {
        const r = cardEl.getBoundingClientRect();
        cardEl.style.setProperty('--mx', `${e.clientX - r.left}px`);
        cardEl.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    grid.addEventListener('mousemove', onMove, { passive: true });
    return () => grid.removeEventListener('mousemove', onMove);
  }, []);

  // The page breathes with each summon: the legend's signature colour
  // tints the wordmark glow, the accent wash, and the nameplate dash
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || !summoned) return;
    hero.style.setProperty('--accent', summoned.accent);
    hero.style.setProperty('--accent-soft', hexToRgba(summoned.accent, 0.14));
    hero.style.setProperty('--accent-strong', hexToRgba(summoned.accent, 0.4));
  }, [summoned]);

  // Scroll-linked depth: the hero copy sinks and dims as the page scrolls
  // away, and the VS watermark drifts against the scroll — two quiet
  // parallax notes, transforms only, one rAF per scroll burst.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const panel = document.querySelector<HTMLElement>('.hero-panel, .hero-content');
    const watermark = document.querySelector<HTMLElement>('.tott-watermark');
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      if (panel) {
        const p = Math.min(window.scrollY / (vh * 0.9), 1);
        panel.style.transform = `translateY(${(p * 70).toFixed(1)}px)`;
        panel.style.opacity = (1 - p * 0.85).toFixed(3);
      }
      if (watermark) {
        const r = watermark.getBoundingClientRect();
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        watermark.style.transform = `translate(-50%, calc(-50% + ${(-p * 90).toFixed(1)}px)) rotate(-6deg)`;
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mode]);

  // Scroll-triggered reveals — animate each .reveal element once it enters view
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const is3D = mode === '3d';

  const heroContent = (
    <>
      <div className="hero-badge">
        <svg
          width={14}
          height={14}
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
      <span className="hero-wordmark-large" aria-label="mythique">
        {'mythique'.split('').map((ch, i) => (
          <span
            key={i}
            className="wm-l"
            aria-hidden="true"
            style={{ animationDelay: `${0.12 + i * 0.055}s` }}
          >
            {ch}
          </span>
        ))}
      </span>
      <p className="hero-tagline">Know every icon. Settle every debate.</p>
      <p className="hero-sub">
        Explore 34,000+ characters in rich detail, trace how they&apos;re connected, and pit any two
        head-to-head to settle who&apos;d really win. The whole universe — alive, connected, and
        yours to argue about.
      </p>
      <div className="hero-ctas">
        <button className="btn-primary" onClick={() => router.push('/explore')}>
          <svg
            className="btn-icon"
            width={20}
            height={20}
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
    </>
  );

  return (
    <div
      className={fontsReady ? 'loaded' : undefined}
      style={{
        backgroundColor: '#0b1820',
        color: '#f5ebdc',
        // While the splash is up, the page behind it must be GENUINELY
        // invisible — iOS Safari's toolbar glass frosts the page content
        // UNDERNEATH fixed overlays, so the summon particles showed through
        // the toolbar band while the splash covered the rest of the screen
        // (an unsyncable mismatch). visibility flips in the same commit the
        // splash unmounts, so the band and the page reveal as one.
        // (.page-loader overrides back to visible — visibility is inheritable.)
        visibility: fontsReady ? undefined : 'hidden',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {!fontsReady && (
        <div className="page-loader" aria-hidden="true">
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
      )}

      <nav>
        <div className="nav-brand">
          <svg className="nav-logo" width={32} height={32} viewBox="0 0 1024 1024" aria-hidden="true">
            <path fill="var(--beige)" d={LOGO_PATH} />
          </svg>
          <span className="nav-wordmark">mythique</span>
        </div>
        <button className="nav-cta" onClick={() => router.push('/(auth)/login')}>
          Sign In
        </button>
      </nav>

      {/* HERO */}
      <section className={`hero${is3D ? ' hero--3d' : ''}`} ref={heroRef}>
        {is3D ? (
          <>
            <canvas ref={canvasRef} className="summon-canvas" aria-hidden="true" />
            <div className="hero-accent" aria-hidden="true" />
            <div className="hero-grid">
              <div className="hero-panel">{heroContent}</div>
              <div className="summon-stage" ref={stageRef}>
                {summoned ? (
                  <div className="summon-plate">
                    <span className="plate-name" key={summoned.id} aria-hidden="true">
                      {summoned.name}
                    </span>
                    <span className="plate-universe" aria-hidden="true">
                      {summoned.universe}
                    </span>
                    <button
                      className="plate-summon"
                      onClick={() => engineRef.current?.summonNext()}
                    >
                      Summon another legend ↻
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="hero-collage" aria-hidden="true">
              {collageChars.map(([id], i) => (
                <div key={id} className={`hero-card hc${i + 1}`}>
                  <img src={P(id)} alt="" loading="lazy" />
                </div>
              ))}
            </div>
            <div className="hero-content">{heroContent}</div>
            {/* Mobile hero strip */}
            <div className="hero-strip" aria-hidden="true">
              {stripChars.map(([id]) => (
                <div key={id} className="hero-strip-card">
                  <img src={P(id)} alt="" loading="lazy" />
                </div>
              ))}
            </div>
          </>
        )}

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

      {/* DAILY DEBATE TEASER */}
      {debateMatchup && <DebateTeaser matchup={debateMatchup} hookText={debateHook} />}

      {/* STATS */}
      <div className="stats hairline">
        <div className="stats-inner">
          <div className="stat-item reveal">
            <span className="stat-num" data-target="34000" data-suffix="+">
              34,000+
            </span>
            <span className="stat-tick" style={{ background: '#E77333' }} />
            <span className="stat-label">Characters</span>
          </div>
          <div className="stat-item reveal" style={{ transitionDelay: '80ms' }}>
            <span className="stat-num" data-target="180" data-suffix="+">
              180+
            </span>
            <span className="stat-tick" style={{ background: '#F9B222' }} />
            <span className="stat-label">Universes</span>
          </div>
          <div className="stat-item reveal" style={{ transitionDelay: '160ms' }}>
            <span className="stat-num" data-target="3000" data-suffix="+">
              3,000+
            </span>
            <span className="stat-tick" style={{ background: '#15A1AB' }} />
            <span className="stat-label">Films &amp; Shows</span>
          </div>
          <div className="stat-item reveal" style={{ transitionDelay: '240ms' }}>
            <span className="stat-num" data-target="430" data-suffix="K+">
              430K+
            </span>
            <span
              className="stat-tick"
              style={{ background: 'linear-gradient(90deg,#E77333,#F9B222,#15A1AB)' }}
            />
            <span className="stat-label">Connections</span>
          </div>
        </div>
      </div>

      {/* MARQUEE */}
      <div className="marquee-clip">
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
                  <span key={j} className={j % 2 ? 'mq-outline' : undefined}>
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
      </div>

      {/* FEATURES */}
      <section className="section">
        <div className="section-inner">
          <p className="section-eyebrow reveal rv-wipe">Why it&apos;s different</p>
          <h2 className="section-heading reveal rv-blur" style={{ transitionDelay: '60ms' }}>
            More than a wiki.
            <br />A universe you can play with.
          </h2>
          <p className="section-sub reveal" style={{ transitionDelay: '120ms' }}>
            Explore every character in depth, see how they all connect, and settle the debates a
            static list never could. One living, opinionated multiverse — every franchise, every
            icon.
          </p>
          <div className="features-grid">
            {/* Rivalries & Family Trees — wide cell with a live bond web */}
            <div className="feature-card fc-wide reveal rv-scale">
              <div className="fc-copy">
                <div className="feature-icon">
                  <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </div>
                <h3 className="feature-title">Rivalries &amp; Family Trees</h3>
                <p className="feature-desc">
                  See who they fight, who they love, and who they’re related to — every hero mapped
                  into a living web of allies, enemies and kin.
                </p>
              </div>
              <div className="fc-visual fc-web" aria-hidden="true">
                <svg width="100%" height="100%" viewBox="0 0 200 170" preserveAspectRatio="none">
                  <line
                    x1="84"
                    y1="65"
                    x2="36"
                    y2="122"
                    stroke="#E77333"
                    strokeWidth="1.5"
                    opacity="0.75"
                  />
                  <line
                    x1="84"
                    y1="65"
                    x2="164"
                    y2="126"
                    stroke="#15A1AB"
                    strokeWidth="1.5"
                    opacity="0.75"
                  />
                  <line
                    x1="84"
                    y1="65"
                    x2="160"
                    y2="37"
                    stroke="#F9B222"
                    strokeWidth="1.5"
                    opacity="0.75"
                  />
                </svg>
                <div className="fc-web-node" style={{ left: '42%', top: '38%' }}>
                  <img src={P('69')} alt="" loading="lazy" />
                </div>
                <div
                  className="fc-web-node"
                  style={{ left: '18%', top: '72%', ['--node-c' as never]: '#E77333' }}
                >
                  <img src={P('370')} alt="" loading="lazy" />
                  <span>Enemy</span>
                </div>
                <div
                  className="fc-web-node"
                  style={{ left: '82%', top: '74%', ['--node-c' as never]: '#15A1AB' }}
                >
                  <img src={P('165')} alt="" loading="lazy" />
                  <span>Ally</span>
                </div>
                <div
                  className="fc-web-node"
                  style={{ left: '80%', top: '22%', ['--node-c' as never]: '#F9B222' }}
                >
                  <img src={P('cv-1691')} alt="" loading="lazy" />
                  <span>Kin</span>
                </div>
              </div>
            </div>

            {/* Settle the Debate — tall cell with mini tape bars */}
            <div
              className="feature-card fc-tall reveal rv-scale"
              style={{ transitionDelay: '80ms' }}
            >
              <div className="feature-icon">
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
                  <path d="m13 19 6-6" />
                  <path d="m16 16 4 4" />
                  <path d="m19 21 2-2" />
                  <path d="M14.5 6.5 18 3h3v3l-3.5 3.5" />
                  <path d="m5 14 4 4" />
                  <path d="m7 17-2 2" />
                  <path d="m3 19 2 2" />
                </svg>
              </div>
              <h3 className="feature-title">Settle the Debate</h3>
              <p className="feature-desc">
                Pit any two head-to-head, take a side, and watch the winner reveal — crowd vote plus
                the head to head. The &quot;who’d win&quot; argument, finally settled.
              </p>
              <div className="fc-visual fc-bars" aria-hidden="true">
                {[
                  { label: 'Strength', l: 88, r: 56 },
                  { label: 'Speed', l: 52, r: 81 },
                  { label: 'Intelligence', l: 60, r: 94 },
                ].map((b) => (
                  <div className="fc-bar-row" key={b.label}>
                    <span className="fc-bar-label">{b.label}</span>
                    <div className="fc-bar l">
                      <i style={{ width: `${b.l}%` }} />
                    </div>
                    <div className="fc-bar r">
                      <i style={{ width: `${b.r}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Explore the Universe */}
            <div className="feature-card reveal rv-scale" style={{ transitionDelay: '60ms' }}>
              <div className="feature-icon">
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h3 className="feature-title">Explore the Universe</h3>
              <p className="feature-desc">
                Browse 34,000+ characters across Marvel, DC, Disney, anime, games and beyond —
                curated collections that surface someone new every scroll.
              </p>
            </div>

            {/* Deep Profiles */}
            <div className="feature-card reveal rv-scale" style={{ transitionDelay: '120ms' }}>
              <div className="feature-icon">
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <h3 className="feature-title">Deep Profiles</h3>
              <p className="feature-desc">
                Powers, origins, abilities, real names and did-you-knows — the full dossier behind
                every character, not just a stat block.
              </p>
            </div>

            {/* On Screen — wide cell with poster chips */}
            <div
              className="feature-card fc-wide reveal rv-scale"
              style={{ transitionDelay: '100ms' }}
            >
              <div className="fc-copy">
                <div className="feature-icon">
                  <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <h3 className="feature-title">On Screen</h3>
                <p className="feature-desc">
                  Every film, show and game a character appears in — with trailers and where to
                  stream them next.
                </p>
              </div>
              <div className="fc-visual fc-posters" aria-hidden="true">
                {['346', '620', '720'].map((id) => (
                  <div className="fc-poster" key={id}>
                    <img src={P(id)} alt="" loading="lazy" />
                    <i />
                  </div>
                ))}
              </div>
            </div>

            {/* Instant Search */}
            <div className="feature-card reveal rv-scale" style={{ transitionDelay: '160ms' }}>
              <div className="feature-icon">
                <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h3 className="feature-title">Instant Search</h3>
              <p className="feature-desc">
                Find any of 34,000+ characters in seconds — search by name, power, publisher or team
                affiliation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HEAD TO HEAD */}
      <section className="tott">
        <span className="tott-watermark" aria-hidden="true">
          VS
        </span>
        <div className="tott-inner">
          <p className="section-eyebrow reveal rv-wipe">The big question</p>
          <h2 className="section-heading reveal rv-blur" style={{ transitionDelay: '60ms' }}>
            Who&apos;d actually win?
          </h2>
          <p className="section-sub reveal" style={{ transitionDelay: '120ms' }}>
            Every matchup opens with real power stats, side by side. Then you take a side and watch
            the verdict roll in.
          </p>

          <div className="tott-card reveal rv-scale" style={{ transitionDelay: '160ms' }}>
            <div className="tott-head">
              <div className="tott-field" aria-hidden="true" />
              <span className="tott-seam" aria-hidden="true" />
              <div className="tott-fcard l">
                <img src={P800('332')} alt="Hulk" loading="lazy" />
              </div>
              <div className="tott-id l">
                <span className="tott-name">Hulk</span>
                <span className="tott-univ">Marvel</span>
                <div className="tott-pips l" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <span className="tott-pip-label">Rounds won</span>
              </div>
              <div className="tott-fcard r">
                <img src={P800('346')} alt="Iron Man" loading="lazy" />
              </div>
              <div className="tott-id r">
                <span className="tott-name">Iron Man</span>
                <span className="tott-univ">Marvel</span>
                <div className="tott-pips r" aria-hidden="true">
                  <i />
                  <i />
                </div>
                <span className="tott-pip-label">Rounds won</span>
              </div>
              <div className="tott-vs" aria-hidden="true">
                VS
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
                      <div
                        className={`tott-fill l${hulkWins ? '' : ' lose'}`}
                        style={{ width: `${row.l}%` }}
                      />
                    </div>
                    <span className="tott-label">{row.label}</span>
                    <div className="tott-bar">
                      <div
                        className={`tott-fill r${ironWins ? '' : ' lose'}`}
                        style={{ width: `${row.r}%` }}
                      />
                    </div>
                    <span className={`tott-val r${ironWins ? ' win' : ''}`}>{row.r}</span>
                  </div>
                );
              })}
            </div>

            <p className="tott-verdict">
              <span className="tott-verdict-chip">Stats verdict</span>
              The tape leans <strong>Hulk</strong> — four rounds to two. The crowd gets the final
              word.
            </p>
          </div>

          <button
            className="btn-primary reveal"
            style={{ marginTop: 36, transitionDelay: '220ms' }}
            onClick={() => router.push('/versus')}
          >
            <svg
              className="btn-icon"
              width={20}
              height={20}
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
            <div className="screenshots-phones reveal rv-scale">
              <div className="browser-frame">
                <div className="browser-bar" aria-hidden="true">
                  <span className="browser-dot" />
                  <span className="browser-dot" />
                  <span className="browser-dot" />
                  <span className="browser-url">mythique</span>
                </div>
                <img
                  src={screenshotDesktop}
                  alt="Mythique explore feed on desktop"
                  loading="lazy"
                />
              </div>
              <div className="phone-frame phone-second">
                <img src={screenshotMobile} alt="A character profile on mobile" loading="lazy" />
              </div>
            </div>
            <div className="screenshots-text">
              <p className="section-eyebrow reveal rv-wipe">The experience</p>
              <h2 className="section-heading reveal rv-blur" style={{ transitionDelay: '60ms' }}>
                Made to
                <br />
                get lost in.
              </h2>
              <p className="section-sub reveal" style={{ transitionDelay: '120ms' }}>
                Fast, beautiful, and endlessly deep — on desktop or mobile, right in your browser.
              </p>
              <ul className="feature-list reveal" style={{ transitionDelay: '180ms' }}>
                {[
                  'Rich profiles — powers, origins, abilities & trivia',
                  'Rivalry and family-tree graphs you can explore',
                  'Head-to-head matchups with real power stats',
                  'Film, TV and game appearances for every hero',
                ].map((item, i) => (
                  <li key={i}>
                    <span className="check" aria-hidden="true">
                      <svg width={12} height={12} viewBox="0 0 12 12">
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
          <p className="section-eyebrow reveal rv-wipe">The roster</p>
          <h2 className="section-heading reveal rv-blur" style={{ transitionDelay: '60ms' }}>
            From every universe
          </h2>
          <p className="section-sub reveal" style={{ transitionDelay: '120ms' }}>
            Marvel, DC, anime, video games and beyond — 34,000+ characters, deeply detailed, all in
            one place.
          </p>
          <div className="hero-mosaic">
            {mosaicChars.map(([id, name], i) => (
              <div
                key={id}
                className={`mosaic-card reveal rv-scale${i === 0 ? ' featured' : ''}`}
                style={{ transitionDelay: `${(i % 5) * 60}ms` }}
              >
                <img src={i === 0 ? P800(id) : P(id)} alt={name} loading="lazy" />
                <span className="mosaic-name">{name}</span>
              </div>
            ))}
            <button
              className="mosaic-more reveal"
              onClick={() => router.push('/explore')}
              aria-label="Explore all 34,000+ characters"
            >
              <span className="mosaic-more-num">+33,990</span>
              <span className="mosaic-more-label">
                more legends.
                <br />
                Explore them all →
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="cta-section hairline">
        <div className="cta-inner">
          <p className="section-eyebrow reveal rv-wipe">Dive in</p>
          <h2 className="cta-glow reveal rv-blur" style={{ transitionDelay: '60ms' }}>
            Explore. Compare. Argue.
          </h2>
          <p className="cta-sub reveal" style={{ transitionDelay: '120ms' }}>
            34,000+ characters across every universe, deep profiles, living rivalries, and the only
            place to settle who&apos;d really win — free, no ads, right in your browser.
          </p>
          <button
            className="btn-primary"
            style={{ marginBottom: 28 }}
            onClick={() => router.push('/explore')}
          >
            <svg
              className="btn-icon"
              width={20}
              height={20}
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
                width={28}
                height={28}
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
                width={28}
                height={28}
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
      <footer className="hairline">
        <span className="nav-wordmark" style={{ opacity: 0.6 }}>
          mythique
        </span>
        <span className="footer-tag">Know every icon. Settle every debate.</span>
        <a
          className="footer-support"
          href="/support"
          onClick={(e) => {
            e.preventDefault();
            router.push('/support');
          }}
        >
          Support Mythique
        </a>
        <p>© 2026 Mythique. All rights reserved.</p>
      </footer>
    </div>
  );
}