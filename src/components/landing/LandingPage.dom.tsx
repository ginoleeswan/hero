'use dom';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as THREE from 'three';
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
  bonds: Bond[];
}

const REL_COLOR: Record<Rel, string> = {
  enemy: '#E77333',
  ally: '#15A1AB',
  kin: '#F9B222',
};

// The summonable roster. Bonds are real relationships from the graph,
// hardcoded here so the landing page never blocks on the DB.
const SUMMONS: Summon[] = [
  {
    id: '69',
    name: 'Batman',
    universe: 'DC',
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
const GROUP_W = 3.7;
const GROUP_H = 3.5;

const PARTICLE_VERT = `
  attribute vec2 aUv;
  attribute vec3 aScatter;
  attribute float aSeed;
  uniform sampler2D uTex;
  uniform float uAssemble;
  uniform float uTime;
  uniform float uScale;
  uniform float uSpacing;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 tex = texture2D(uTex, aUv).rgb;
    float lum = dot(tex, vec3(0.299, 0.587, 0.114));

    // Staggered per-particle assembly, eased
    float t = clamp(uAssemble * 1.45 - aSeed * 0.45, 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);

    // Assembled home on the portrait plane, with a gentle breathing wave
    vec3 home = vec3(
      (aUv.x - 0.5) * ${PLANE_W.toFixed(1)},
      (aUv.y - 0.5) * ${PLANE_H.toFixed(1)},
      (aSeed - 0.5) * 0.06
    );
    home.x += 0.012 * sin(uTime * 1.3 + aUv.y * 9.0 + aSeed * 6.2831);
    home.z += 0.035 * sin(uTime * 0.9 + aUv.x * 7.0 + aSeed * 6.2831);

    // Dispersed stardust, slowly swirling
    vec3 sc = aScatter;
    float sw = uTime * 0.22 + aSeed * 6.2831;
    sc.x += 0.28 * sin(sw);
    sc.y += 0.2 * cos(sw * 1.3);
    sc.z += 0.22 * sin(sw * 0.7);

    vec3 pos = mix(sc, home, t);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float worldSize = uSpacing * (0.85 + lum * 0.9) * mix(0.5, 1.25, t);
    gl_PointSize = min(uScale * worldSize / -mv.z, 64.0);

    vColor = tex;
    vAlpha = mix(0.3, 1.0, t);
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
  const W = 220;
  const H = 280;
  const cx = W / 2;
  const cy = 96;
  const r = 74;
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
    ctx.font = "700 44px 'Righteous', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bond.name.charAt(0), cx, cy);
  }
  ctx.restore();

  // Relation ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Name + relation label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f5ebdc';
  ctx.font = "600 21px 'Poppins', sans-serif";
  ctx.fillText(bond.name, cx, cy + r + 36);
  ctx.fillStyle = color;
  ctx.font = "600 13px 'Poppins', sans-serif";
  const rel = bond.rel.toUpperCase().split('').join('  ');
  ctx.fillText(rel, cx, cy + r + 60);

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
  const COLS = mobile ? 64 : 88;
  const ROWS = mobile ? 96 : 132;
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
        uAssemble: { value: 0 },
        uTime: { value: 0 },
        uScale: { value: 1 },
        uSpacing: { value: (PLANE_H / ROWS) * 1.25 },
      },
    }),
  );
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.frustumCulled = false;
  group.add(particles);

  /* --- Texture + halo caches -------------------------------------- */
  const texCache = new Map<string, THREE.Texture>();
  const texLoader = new THREE.TextureLoader();
  const loadPortrait = (id: string): Promise<THREE.Texture> => {
    const hit = texCache.get(id);
    if (hit) return Promise.resolve(hit);
    return texLoader.loadAsync(P(id)).then((tex) => {
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
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
    dispose(): void;
  }

  const buildHalo = async (s: Summon): Promise<Halo> => {
    const g = new THREE.Group();
    const materials: (THREE.MeshBasicMaterial | THREE.LineBasicMaterial)[] = [];
    const nodes: Halo['nodes'] = [];
    const owned: { dispose(): void }[] = [];
    const slots = BOND_SLOTS[Math.min(s.bonds.length, 4)] ?? BOND_SLOTS[4];
    const textures = await Promise.all(s.bonds.slice(0, 4).map(buildNodeTexture));

    s.bonds.slice(0, 4).forEach((bond, i) => {
      const [sx, sy, sz] = slots[i];
      const base = new THREE.Vector3(sx, sy, sz);

      // Node card
      const nodeGeo = new THREE.PlaneGeometry(0.68, 0.86);
      const nodeMat = new THREE.MeshBasicMaterial({
        map: textures[i],
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      owned.push(nodeGeo, nodeMat);
      const mesh = new THREE.Mesh(nodeGeo, nodeMat);
      mesh.position.copy(base);
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
      g.add(new THREE.Line(lineGeo, lineMat));
    });

    return {
      group: g,
      materials,
      nodes,
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
  type Phase = 'waiting' | 'assemble' | 'hold' | 'disperse';
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

  const ASSEMBLE_S = 2.0;
  const HOLD_S = 6.2;
  const DISPERSE_S = 1.1;

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

  const summonNext = () => {
    if (disposed) return;
    if (phase === 'hold' || (phase === 'assemble' && phaseT / ASSEMBLE_S > 0.5)) {
      phase = 'disperse';
      phaseT = 0;
    }
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
    group.position.y = -stageCy * worldPerPxY + 0.04;

    const scale = Math.min(
      (sRect.width * worldPerPxX) / GROUP_W,
      (sRect.height * 0.92 * worldPerPxY) / GROUP_H,
    );
    const s = THREE.MathUtils.clamp(scale, 0.42, 1.05);
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
    if (
      performance.now() - downAt < 350 &&
      Math.hypot(e.clientX - downX, e.clientY - downY) < 12
    ) {
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
      if (phaseT >= HOLD_S) {
        phase = 'disperse';
        phaseT = 0;
      }
    } else if (phase === 'disperse') {
      particleMat.uniforms.uAssemble.value = Math.max(1 - phaseT / DISPERSE_S, 0);
      if (phaseT >= DISPERSE_S) {
        phase = 'waiting';
        phaseT = 0;
        index = (index + 1) % SUMMONS.length;
        beginSummon(SUMMONS[index]);
      }
    }

    // Halo fades in late in assembly, out early in dispersal
    const assembleV = particleMat.uniforms.uAssemble.value as number;
    const haloTarget = (phase === 'hold' || phase === 'assemble') && assembleV > 0.75 ? 1 : 0;
    haloAlpha += (haloTarget - haloAlpha) * Math.min(dt * 3.2, 1);
    if (activeHalo) {
      activeHalo.materials.forEach((m) => {
        m.opacity =
          m instanceof THREE.LineBasicMaterial ? haloAlpha * 0.65 : haloAlpha;
      });
      activeHalo.nodes.forEach((n) => {
        n.mesh.position.y = n.base.y + Math.sin(elapsed * 0.8 + n.phase) * 0.045;
        n.mesh.position.x = n.base.x + Math.cos(elapsed * 0.6 + n.phase) * 0.02;
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

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Righteous&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#0b1820; --surface:#142130; --card:#1a2d3e;
    --orange:#E77333; --yellow:#F9B222; --beige:#f5ebdc;
    --muted:#7a93a3; --border:#253d50; --teal:rgb(21,161,171); --radius:16px;
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

  /* --- The Summoning (3D hero) --- */
  .summon-canvas {
    position:absolute; inset:0; width:100%; height:100%;
    opacity:0; transition:opacity 1.1s ease; z-index:1;
    touch-action:pan-y; /* orbit-free: taps summon, scroll stays native */
  }
  .summon-canvas.ready { opacity:1; }
  .hero--3d {
    text-align:left;
    padding:110px 24px 64px;
  }
  .hero-grid {
    position:relative; z-index:2;
    display:grid; grid-template-columns:minmax(400px,1fr) minmax(0,1.05fr);
    gap:40px; align-items:center;
    width:100%; max-width:1220px; margin:0 auto;
    min-height:calc(100dvh - 190px);
  }
  .hero-panel {
    position:relative;
    background:linear-gradient(160deg,rgba(20,33,48,0.66) 0%,rgba(11,24,32,0.42) 100%);
    -webkit-backdrop-filter:blur(18px) saturate(1.25);
    backdrop-filter:blur(18px) saturate(1.25);
    border:1px solid rgba(245,235,220,0.09);
    border-radius:28px;
    padding:44px 42px;
    box-shadow:0 24px 80px rgba(0,0,0,0.45);
  }
  .hero-panel::before {
    content:''; position:absolute; inset:0 0 auto 0; height:1px; border-radius:28px 28px 0 0;
    background:linear-gradient(90deg,transparent,rgba(245,235,220,0.22),transparent);
    pointer-events:none;
  }
  .hero--3d .hero-wordmark-large {
    font-size:clamp(52px,7vw,92px); margin-bottom:28px; letter-spacing:-2px;
  }
  .hero--3d .hero-tagline { margin-bottom:14px; }
  .hero--3d .hero-sub { margin:0 0 34px; max-width:440px; }
  .hero--3d .hero-ctas { justify-content:flex-start; }

  .summon-stage {
    position:relative; align-self:stretch;
    min-height:420px; pointer-events:none;
  }
  .summon-plate {
    position:absolute; left:50%; bottom:-6px; transform:translateX(-50%);
    display:flex; flex-direction:column; align-items:center; gap:6px;
    pointer-events:none; white-space:nowrap;
  }
  .plate-name {
    font-family:'Righteous',sans-serif; font-size:24px; color:var(--beige);
    letter-spacing:0.5px; text-shadow:0 2px 18px rgba(11,24,32,0.9);
    animation:plateIn .6s cubic-bezier(.22,.7,.25,1) both;
  }
  .plate-universe {
    font-size:10px; font-weight:600; letter-spacing:3px; text-transform:uppercase;
    color:var(--muted);
  }
  .plate-legend {
    display:flex; gap:14px; margin-top:2px;
    font-size:10px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase;
    color:var(--muted);
  }
  .plate-legend span { display:inline-flex; align-items:center; gap:5px; }
  .legend-dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
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

  .stats {
    background:
      radial-gradient(ellipse 50% 90% at 50% 0%,rgba(231,115,51,0.07) 0%,transparent 70%),
      var(--surface);
    border-top:1px solid var(--border);
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
    transition:border-color 250ms,transform 200ms,box-shadow 250ms;
  }
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
  .tott-portrait.r img { transform:scaleX(-1); }
  .tott-name { font-family:'Righteous',sans-serif; font-size:18px; }
  .tott-univ { font-size:11px; color:var(--muted); letter-spacing:1.5px; text-transform:uppercase; }
  .tott-vs {
    font-family:'Righteous',sans-serif; font-size:24px;
    width:54px; height:54px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,var(--orange),var(--yellow));
    color:#0b1820; box-shadow:0 6px 24px rgba(231,115,51,0.4);
    animation:vsPulse 3.2s ease-in-out infinite;
  }
  @keyframes vsPulse {
    0%,100% { box-shadow:0 6px 24px rgba(231,115,51,0.4); }
    50%      { box-shadow:0 6px 34px rgba(249,178,34,0.55); }
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
  .tott-fill { position:absolute; top:0; bottom:0; border-radius:6px; transform:scaleX(0); transition:transform .9s cubic-bezier(.2,.8,.2,1); }
  .tott-fill.l { right:0; background:var(--hulk); transform-origin:right; }
  .tott-fill.r { left:0; background:var(--iron); transform-origin:left; }
  .tott-card.in .tott-fill { transform:scaleX(1); }
  .tott-card.in .tott-row:nth-child(1) .tott-fill { transition-delay:.05s; }
  .tott-card.in .tott-row:nth-child(2) .tott-fill { transition-delay:.12s; }
  .tott-card.in .tott-row:nth-child(3) .tott-fill { transition-delay:.19s; }
  .tott-card.in .tott-row:nth-child(4) .tott-fill { transition-delay:.26s; }
  .tott-card.in .tott-row:nth-child(5) .tott-fill { transition-delay:.33s; }
  .tott-card.in .tott-row:nth-child(6) .tott-fill { transition-delay:.40s; }

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

  @media (max-width:900px) {
    .hero-grid { grid-template-columns:1fr; gap:8px; min-height:auto; }
    .hero--3d { text-align:center; padding:100px 20px 40px; }
    .hero--3d .hero-sub { margin:0 auto 30px; }
    .hero--3d .hero-ctas { justify-content:center; }
    .hero-panel { padding:30px 24px; }
    .summon-stage { min-height:56vh; }
  }

  @media (max-width:768px) {
    /* Nav */
    nav { padding:14px 20px; }

    /* Hero — tighter, no min-height */
    .hero { padding:88px 20px 52px; min-height:auto; }
    .hero--3d { min-height:100dvh; padding:88px 16px 36px; }
    .hc1,.hc2,.hc3,.hc4,.hc5,.hc6,.hc7,.hc8,.hc9,.hc10 { display:none; }
    .scroll-hint { display:none; }
    .plate-name { font-size:19px; }
    .plate-legend { gap:10px; font-size:9px; }

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
    .summon-stage { min-height:52vh; }

    /* Store badges */
    .cta-buttons { flex-direction:column; align-items:center; width:100%; }
    .app-store-badge { width:100%; max-width:260px; justify-content:center; }

    /* Footer */
    footer { justify-content:center; text-align:center; flex-direction:column; align-items:center; }
  }

  /* Scroll reveals */
  .reveal { opacity:0; transform:translateY(26px); transition:opacity .7s cubic-bezier(.22,.7,.25,1), transform .7s cubic-bezier(.22,.7,.25,1); will-change:opacity,transform; }
  .reveal.in { opacity:1; transform:none; }
  .feature-card.reveal { transition:opacity .55s cubic-bezier(.22,.7,.25,1), transform .55s cubic-bezier(.22,.7,.25,1), border-color .25s ease, box-shadow .25s ease; }
  .mosaic-card.reveal { transition:opacity .55s cubic-bezier(.22,.7,.25,1), transform .55s cubic-bezier(.22,.7,.25,1), box-shadow .3s ease; }

  /* Hero load-in sequence */
  .hero-content > *, .hero-panel > * { opacity:0; }
  .hero-panel::before { opacity:1; }
  .loaded .hero-content > *, .loaded .hero-panel > * { animation:heroIn .8s cubic-bezier(.22,.7,.25,1) both; }
  .loaded .hero-content .hero-wordmark-large, .loaded .hero-panel .hero-wordmark-large { animation-delay:.12s; }
  .loaded .hero-content .hero-tagline, .loaded .hero-panel .hero-tagline { animation-delay:.26s; }
  .loaded .hero-content .hero-sub, .loaded .hero-panel .hero-sub { animation-delay:.38s; }
  .loaded .hero-content .hero-ctas, .loaded .hero-panel .hero-ctas { animation-delay:.5s; }
  @keyframes heroIn { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:none; } }

  @media (prefers-reduced-motion:reduce) {
    .hero-card,.scroll-hint,.marquee-track,.tott-vs,.plate-name { animation:none; }
    * { transition-duration:0.01ms !important; }
    .reveal { opacity:1 !important; transform:none !important; }
    .tott-fill { transform:scaleX(1) !important; }
    .hero-content > *, .hero-panel > * { opacity:1 !important; animation:none !important; }
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

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

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

export default function LandingPage({ dom: _dom }: { dom?: import('expo/dom').DOMProps }) {
  const router = useRouter();
  const [fontsReady, setFontsReady] = useState(false);
  const [mode, setMode] = useState<'3d' | 'static'>(() => (detect3DSupport() ? '3d' : 'static'));
  const [summoned, setSummoned] = useState<Summon | null>(null);

  const heroRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SummonEngine | null>(null);

  const fallBack = useCallback(() => setMode('static'), []);

  useEffect(() => {
    let done = false;
    const ready = () => {
      if (!done) {
        done = true;
        setFontsReady(true);
      }
    };
    document.fonts.ready.then(ready);
    const fallback = setTimeout(ready, 2000); // never leave the hero hidden
    return () => clearTimeout(fallback);
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
    </>
  );

  return (
    <div
      className={fontsReady ? 'loaded' : undefined}
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
                    <div className="plate-legend" aria-hidden="true">
                      <span>
                        <span className="legend-dot" style={{ background: REL_COLOR.enemy }} />
                        Enemy
                      </span>
                      <span>
                        <span className="legend-dot" style={{ background: REL_COLOR.ally }} />
                        Ally
                      </span>
                      <span>
                        <span className="legend-dot" style={{ background: REL_COLOR.kin }} />
                        Kin
                      </span>
                    </div>
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

      {/* STATS */}
      <div className="stats">
        <div className="stat-item reveal">
          <span className="stat-num">34,000+</span>
          <span className="stat-label">Characters</span>
        </div>
        <div className="stat-item reveal" style={{ transitionDelay: '80ms' }}>
          <span className="stat-num">180+</span>
          <span className="stat-label">Universes</span>
        </div>
        <div className="stat-item reveal" style={{ transitionDelay: '160ms' }}>
          <span className="stat-num">3,000+</span>
          <span className="stat-label">Films &amp; Shows</span>
        </div>
        <div className="stat-item reveal" style={{ transitionDelay: '240ms' }}>
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
          <p className="section-eyebrow reveal">Why it&apos;s different</p>
          <h2 className="section-heading reveal" style={{ transitionDelay: '60ms' }}>
            More than a wiki.
            <br />A universe you can play with.
          </h2>
          <p className="section-sub reveal" style={{ transitionDelay: '120ms' }}>
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
              <div
                key={i}
                className="feature-card reveal"
                style={{ transitionDelay: `${(i % 3) * 80}ms` }}
              >
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
          <p className="section-eyebrow reveal">The big question</p>
          <h2 className="section-heading reveal" style={{ transitionDelay: '60ms' }}>
            Who&apos;d actually win?
          </h2>
          <p className="section-sub reveal" style={{ transitionDelay: '120ms' }}>
            Every matchup opens with the tale of the tape — real power stats, side by side. Then you
            take a side and watch the verdict roll in.
          </p>

          <div className="tott-card reveal" style={{ transitionDelay: '160ms' }}>
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
            className="btn-primary reveal"
            style={{ marginTop: 36, transitionDelay: '220ms' }}
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
            <div className="screenshots-phones reveal">
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
              <p className="section-eyebrow reveal">The experience</p>
              <h2 className="section-heading reveal" style={{ transitionDelay: '60ms' }}>
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
          <p className="section-eyebrow reveal">The roster</p>
          <h2 className="section-heading reveal" style={{ transitionDelay: '60ms' }}>
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
                className="mosaic-card reveal"
                style={{ transitionDelay: `${(i % 5) * 60}ms` }}
              >
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
          <p className="section-eyebrow reveal">Dive in</p>
          <h2 className="cta-glow reveal" style={{ transitionDelay: '60ms' }}>
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
