// The audience globe's three.js scene, kept imperative and React-free so the
// component only feeds it data. Land is a field of ~5.7k dots (globeDots.ts),
// each tagged with its country, so colouring a country by its traffic is just a
// per-dot attribute — a dot-matrix choropleth. On top: a light spike per active
// country, pulsing beacons for people on the site right now, and DOM labels for
// the top countries that hide as they roll behind the limb.
//
// Web-only (WebGL + DOM). Rendering pauses while the canvas is off-screen or the
// tab is hidden, and auto-spin is off under prefers-reduced-motion.
import * as THREE from 'three';
import { COUNTRY_ANCHORS, DOT_STEP_DEG, LAND_DOTS } from './globeDots';

export interface GlobeCountry {
  code: string;
  value: number;
}
export interface GlobeBeacon {
  id: string;
  code: string;
  /** Spreads several beacons in one country apart (e.g. the city name). */
  seed: string;
}
export interface GlobeHover {
  code: string;
  x: number;
  y: number;
}
export interface GlobeLabel {
  code: string;
  text: string;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DEG = Math.PI / 180;
const RADIUS = 1;
// Fits the atmosphere shell (r 1.14) with a margin on the short side.
const CAMERA_Z = 4.7;
const IDLE_SPIN_MS = 2500;
const SPIN_RATE = 0.045; // rad/s

/** Decodes globeDots' 4-char dots. Pure; exported for tests. */
export function decodeDots(packed: string): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 3 < packed.length; i += 4) {
    let n = 0;
    for (let k = 0; k < 4; k++) n = n * 64 + B64.indexOf(packed[i + k]);
    out.push([Math.floor(n / 4096) / 10 - 90, (n % 4096) / 10 - 180]);
  }
  return out;
}

/** lat/lon (deg) → point on the sphere. lon 0 faces +z; east is +x. Pure. */
export function toVec3(lat: number, lon: number, r = RADIUS): THREE.Vector3 {
  const p = lat * DEG;
  const l = lon * DEG;
  return new THREE.Vector3(
    r * Math.cos(p) * Math.sin(l),
    r * Math.sin(p),
    r * Math.cos(p) * Math.cos(l),
  );
}

/** Traffic → 0..1 heat on a log scale, so one big country doesn't wash out the rest. Pure. */
export function heatOf(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.log1p(value) / Math.log1p(max);
}

function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const DOT_VERT = /* glsl */ `
  attribute float aHeat;
  attribute float aCountry;
  uniform float uHover;
  uniform float uSelected;
  uniform float uPixelRatio;
  uniform float uScale;
  varying float vHeat;
  varying float vFacing;
  varying float vFocus;
  void main() {
    vHeat = aHeat;
    vFocus = (abs(aCountry - uHover) < 0.5 ? 1.0 : 0.0) + (abs(aCountry - uSelected) < 0.5 ? 1.0 : 0.0);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(world.xyz);
    vFacing = dot(n, normalize(cameraPosition - world.xyz));
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    float base = 2.1 + aHeat * 1.3 + min(vFocus, 1.0) * 0.9;
    gl_PointSize = base * uPixelRatio * uScale;
  }
`;
const DOT_FRAG = /* glsl */ `
  varying float vHeat;
  varying float vFacing;
  varying float vFocus;
  vec3 ramp(float t) {
    vec3 ember = vec3(0.48, 0.20, 0.09);
    vec3 orange = vec3(0.906, 0.451, 0.200);
    vec3 gold = vec3(0.976, 0.698, 0.133);
    vec3 hot = vec3(1.0, 0.86, 0.55);
    if (t < 0.45) return mix(ember, orange, t / 0.45);
    if (t < 0.85) return mix(orange, gold, (t - 0.45) / 0.4);
    return mix(gold, hot, (t - 0.85) / 0.15);
  }
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.28, d);
    // Fade toward the limb so the sphere reads as round, not a flat disc.
    float limb = smoothstep(-0.05, 0.45, vFacing);
    vec3 cold = vec3(0.56, 0.64, 0.66);
    vec3 col = vHeat > 0.0 ? ramp(vHeat) : cold;
    float alpha = vHeat > 0.0 ? 0.55 + vHeat * 0.45 : 0.26;
    if (vFocus > 0.5) { col = mix(col, vec3(1.0), 0.35); alpha = 1.0; }
    gl_FragColor = vec4(col, alpha * edge * limb);
  }
`;
const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize((viewMatrix * world).xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const ATMO_FRAG = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, -vView)), 3.2);
    vec3 warm = vec3(0.906, 0.451, 0.200);
    vec3 cool = vec3(0.30, 0.50, 0.56);
    gl_FragColor = vec4(mix(cool, warm, 0.55), rim * 0.55);
  }
`;

export class GlobeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  private globe = new THREE.Group();
  private dots: THREE.Points;
  private dotMat: THREE.ShaderMaterial;
  private heatAttr: THREE.BufferAttribute;
  private dotCountry: Int16Array;
  private dotUnit: Float32Array;
  private codes: string[];
  private codeIndex = new Map<string, number>();
  private spikes = new THREE.Group();
  private beacons = new THREE.Group();
  private ocean: THREE.Mesh;
  private labelLayer: HTMLDivElement;
  private labels = new Map<string, { el: HTMLDivElement; pos: THREE.Vector3 }>();
  private raycaster = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private frame = 0;
  private ro: ResizeObserver;
  private reducedMotion: boolean;
  // Orientation: rotation.x = tilt (lat to front), rotation.y = -lon.
  private rotX = 0.3;
  private rotY = 0;
  private velX = 0;
  private velY = 0;
  private targetRot: { x: number; y: number } | null = null;
  private dragging: { x: number; y: number; moved: number } | null = null;
  private lastInteract = 0;
  private hoverCode: string | null = null;
  private insetTop = 0;

  onHover: (h: GlobeHover | null) => void = () => {};
  onPick: (code: string) => void = () => {};

  constructor(private host: HTMLElement) {
    this.reducedMotion =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    const canvas = this.renderer.domElement;
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      cursor: 'grab',
      // Vertical swipes still scroll the page on touch; horizontal ones spin.
      touchAction: 'pan-y',
    });
    host.appendChild(canvas);

    this.labelLayer = document.createElement('div');
    Object.assign(this.labelLayer.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
    });
    host.appendChild(this.labelLayer);

    this.camera.position.set(0, 0, CAMERA_Z);
    this.scene.add(this.globe);

    // Ocean: an opaque ink sphere just under the dots, so the far side is hidden.
    this.ocean = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 0.996, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x0f1f27 }),
    );
    this.globe.add(this.ocean);

    // Faint graticule every 30° — orientation cue without competing with data.
    const grat = new THREE.Group();
    const gratMat = new THREE.LineBasicMaterial({
      color: 0x5f7a84,
      transparent: true,
      opacity: 0.12,
    });
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = Array.from({ length: 121 }, (_, i) => toVec3(lat, i * 3, RADIUS * 1.001));
      grat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const pts = Array.from({ length: 61 }, (_, i) => toVec3(-90 + i * 3, lon, RADIUS * 1.001));
      grat.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gratMat));
    }
    this.globe.add(grat);

    // Land dots, one buffer for the whole world.
    this.codes = Object.keys(LAND_DOTS);
    this.codes.forEach((c, i) => this.codeIndex.set(c, i));
    const decoded = this.codes.map((c) => decodeDots(LAND_DOTS[c]));
    const total = decoded.reduce((n, d) => n + d.length, 0);
    const pos = new Float32Array(total * 3);
    const country = new Float32Array(total);
    this.dotCountry = new Int16Array(total);
    this.dotUnit = new Float32Array(total * 3);
    let k = 0;
    decoded.forEach((list, ci) => {
      for (const [lat, lon] of list) {
        const v = toVec3(lat, lon, RADIUS * 1.003);
        pos.set([v.x, v.y, v.z], k * 3);
        this.dotUnit.set(
          [v.x, v.y, v.z].map((n) => n / (RADIUS * 1.003)),
          k * 3,
        );
        country[k] = ci;
        this.dotCountry[k] = ci;
        k++;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCountry', new THREE.BufferAttribute(country, 1));
    this.heatAttr = new THREE.BufferAttribute(new Float32Array(total), 1);
    geo.setAttribute('aHeat', this.heatAttr);
    this.dotMat = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uHover: { value: -1 },
        uSelected: { value: -1 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uScale: { value: 1 },
      },
    });
    this.dots = new THREE.Points(geo, this.dotMat);
    this.globe.add(this.dots);
    this.globe.add(this.spikes);
    this.globe.add(this.beacons);

    // Atmosphere: a back-faced shell with a fresnel rim — the warm seam, on a planet.
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(RADIUS * 1.14, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(atmo);

    canvas.addEventListener('pointerdown', this.handleDown);
    window.addEventListener('pointermove', this.handleMove);
    window.addEventListener('pointerup', this.handleUp);
    canvas.addEventListener('pointerleave', this.handleLeave);
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.start();
  }

  /** Recolour land, rebuild spikes. `focus` turns the globe to the top country. */
  setData(countries: GlobeCountry[], focus: boolean) {
    const max = countries.reduce((m, c) => Math.max(m, c.value), 0);
    const heatByIdx = new Float32Array(this.codes.length);
    for (const c of countries) {
      const i = this.codeIndex.get(c.code);
      if (i != null) heatByIdx[i] = heatOf(c.value, max);
    }
    const arr = this.heatAttr.array as Float32Array;
    for (let d = 0; d < arr.length; d++) arr[d] = heatByIdx[this.dotCountry[d]];
    this.heatAttr.needsUpdate = true;

    this.clearGroup(this.spikes);
    for (const c of countries) {
      const anchor = COUNTRY_ANCHORS[c.code];
      if (!anchor || c.value <= 0) continue;
      const h = 0.05 + 0.32 * Math.sqrt(c.value / max);
      const base = toVec3(anchor[0], anchor[1], RADIUS * 1.004);
      const tip = toVec3(anchor[0], anchor[1], RADIUS * (1.004 + h));
      const g = new THREE.BufferGeometry().setFromPoints([base, tip]);
      g.setAttribute(
        'color',
        new THREE.BufferAttribute(new Float32Array([0.98, 0.7, 0.13, 0.91, 0.45, 0.2]), 3),
      );
      const line = new THREE.Line(
        g,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.009 + 0.01 * heatOf(c.value, max), 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xf9d27a, transparent: true }),
      );
      cap.position.copy(tip);
      const spike = new THREE.Group();
      spike.userData.normal = base.clone().normalize();
      spike.add(line, cap);
      this.spikes.add(spike);
    }
    if (focus && countries[0]) this.focus(countries[0].code);
    this.start();
  }

  setLabels(list: GlobeLabel[]) {
    const keep = new Set(list.map((l) => l.code));
    for (const [code, l] of this.labels) {
      if (!keep.has(code)) {
        l.el.remove();
        this.labels.delete(code);
      }
    }
    for (const { code, text } of list) {
      const anchor = COUNTRY_ANCHORS[code];
      if (!anchor) continue;
      let l = this.labels.get(code);
      if (!l) {
        const el = document.createElement('div');
        Object.assign(el.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          padding: '3px 8px',
          borderRadius: '999px',
          background: 'rgba(11,24,32,0.78)',
          border: '1px solid rgba(231,115,51,0.35)',
          color: '#f5ebdc',
          font: '700 11px Nunito_700Bold, Nunito, system-ui, sans-serif',
          whiteSpace: 'nowrap',
          opacity: '0',
          transition: 'opacity 160ms ease',
          backdropFilter: 'blur(4px)',
        });
        this.labelLayer.appendChild(el);
        l = { el, pos: toVec3(anchor[0], anchor[1], RADIUS * 1.02) };
        this.labels.set(code, l);
      }
      l.el.textContent = text;
    }
    this.start();
  }

  setBeacons(list: GlobeBeacon[]) {
    this.clearGroup(this.beacons);
    for (const b of list) {
      const anchor = COUNTRY_ANCHORS[b.code];
      if (!anchor) continue;
      // A deterministic nudge (≤ ~3 dot steps) so two cities don't stack exactly.
      const j = hash01(b.seed);
      const lat = anchor[0] + (j - 0.5) * DOT_STEP_DEG * 3;
      const lon = anchor[1] + (hash01(b.seed + '~') - 0.5) * DOT_STEP_DEG * 3;
      const p = toVec3(lat, lon, RADIUS * 1.006);
      const holder = new THREE.Group();
      holder.position.copy(p);
      holder.lookAt(p.clone().multiplyScalar(2));
      const core = new THREE.Mesh(
        new THREE.CircleGeometry(0.012, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }),
      );
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.02, 0.026, 32),
        new THREE.MeshBasicMaterial({
          color: 0xe77333,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.userData.phase = j;
      holder.add(core, ring);
      this.beacons.add(holder);
    }
    this.start();
  }

  /** Px of overlaid header at the top of the host; the globe centres below it. */
  setInsetTop(px: number) {
    this.insetTop = px;
    this.resize();
  }

  setSelected(code: string | null) {
    this.dotMat.uniforms.uSelected.value = code ? (this.codeIndex.get(code) ?? -1) : -1;
    if (code) this.focus(code);
  }

  /** Ease the globe round until `code` faces the camera. */
  focus(code: string) {
    const a = COUNTRY_ANCHORS[code];
    if (!a) return;
    const tilt = Math.max(-0.9, Math.min(0.9, a[0] * DEG * 0.85));
    // Shortest way round from the current spin.
    let y = -a[1] * DEG;
    const twoPi = Math.PI * 2;
    y = this.rotY + ((((y - this.rotY) % twoPi) + twoPi * 1.5) % twoPi) - Math.PI;
    this.targetRot = { x: tilt, y };
    this.lastInteract = performance.now();
    this.start();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.ro.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handleDown);
    window.removeEventListener('pointermove', this.handleMove);
    window.removeEventListener('pointerup', this.handleUp);
    canvas.removeEventListener('pointerleave', this.handleLeave);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
    canvas.remove();
    this.labelLayer.remove();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private clearGroup(g: THREE.Group) {
    for (const child of [...g.children]) {
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      g.remove(child);
    }
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait hosts: back off so the globe fits the width, not the height.
    this.camera.position.z = CAMERA_Z * Math.max(1, (h / w) * 0.92);
    // Shift the frame up so the globe sits centred in the space below the header.
    if (this.insetTop) this.camera.setViewOffset(w, h, 0, -this.insetTop / 2, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.dotMat.uniforms.uScale.value = Math.max(0.75, Math.min(1.35, Math.min(w, h) / 420));
    this.start();
  }

  private start() {
    if (!this.frame) {
      this.clock.getDelta();
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private tick = () => {
    this.frame = 0;
    // Off-screen (scrolled away): keep the loop alive but skip the GPU work.
    // A per-frame rect check rather than an IntersectionObserver, whose first
    // report can land before layout settles and leave the loop paused.
    const r = this.host.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || !r.width) {
      this.frame = requestAnimationFrame(this.tick);
      return;
    }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    if (this.targetRot && !this.dragging) {
      const k = 1 - Math.pow(0.0015, dt);
      this.rotX += (this.targetRot.x - this.rotX) * k;
      this.rotY += (this.targetRot.y - this.rotY) * k;
      if (Math.abs(this.targetRot.x - this.rotX) + Math.abs(this.targetRot.y - this.rotY) < 0.001) {
        this.targetRot = null;
      }
    } else if (!this.dragging) {
      // Inertia, then a slow idle spin once the hand has been off for a moment.
      this.rotY += this.velY;
      this.rotX = Math.max(-1.1, Math.min(1.1, this.rotX + this.velX));
      this.velX *= Math.pow(0.04, dt);
      this.velY *= Math.pow(0.04, dt);
      if (!this.reducedMotion && !this.hoverCode && now - this.lastInteract > IDLE_SPIN_MS) {
        this.rotY += SPIN_RATE * dt;
      }
    }
    this.globe.rotation.set(this.rotX, this.rotY, 0, 'XYZ');

    // Beacon rings expand and fade on a ~2s loop, out of phase with each other.
    const t = now / 1000;
    for (const holder of this.beacons.children) {
      const ring = holder.children[1] as THREE.Mesh;
      const ph = (t / 2 + (ring.userData.phase as number)) % 1;
      ring.scale.setScalar(1 + ph * 2.6);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - ph);
    }

    this.fadeSpikes();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();

    const settling =
      this.targetRot || Math.abs(this.velX) + Math.abs(this.velY) > 1e-5 || this.dragging;
    const spinning = !this.reducedMotion;
    if (settling || spinning || this.beacons.children.length) {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  /** Spikes on the far side would poke past the limb as stray pins — fade them out. */
  private fadeSpikes() {
    const cam = this.camera.position.clone().normalize();
    const n = new THREE.Vector3();
    for (const spike of this.spikes.children) {
      n.copy(spike.userData.normal as THREE.Vector3).applyQuaternion(this.globe.quaternion);
      const o = Math.max(0, Math.min(1, (n.dot(cam) - 0.05) * 3.5));
      spike.visible = o > 0;
      const [line, cap] = spike.children as THREE.Mesh[];
      (line.material as THREE.Material).opacity = 0.85 * o;
      (cap.material as THREE.Material).opacity = o;
    }
  }

  private placeLabels() {
    if (!this.labels.size) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const cam = this.camera.position;
    const world = new THREE.Vector3();
    for (const { el, pos } of this.labels.values()) {
      world.copy(pos).applyMatrix4(this.globe.matrixWorld);
      const facing = world.clone().normalize().dot(cam.clone().sub(world).normalize());
      const p = world.clone().project(this.camera);
      el.style.opacity = facing > 0.25 ? String(Math.min(1, (facing - 0.25) * 4)) : '0';
      el.style.transform = `translate(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px) translate(-50%, -135%)`;
    }
  }

  private pointerNdc(e: PointerEvent): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  }

  /** Country under the pointer, or null over ocean / space. */
  private pick(e: PointerEvent): string | null {
    this.raycaster.setFromCamera(this.pointerNdc(e), this.camera);
    const hit = this.raycaster.intersectObject(this.ocean, false)[0];
    if (!hit) return null;
    const local = this.globe.worldToLocal(hit.point.clone()).normalize();
    // Nearest land dot within ~1.6 grid steps; further than that is open water.
    const minDot = Math.cos(DOT_STEP_DEG * 1.6 * DEG);
    let best = -1;
    let bestDot = minDot;
    const u = this.dotUnit;
    for (let i = 0; i < this.dotCountry.length; i++) {
      const d = u[i * 3] * local.x + u[i * 3 + 1] * local.y + u[i * 3 + 2] * local.z;
      if (d > bestDot) {
        bestDot = d;
        best = i;
      }
    }
    return best >= 0 ? this.codes[this.dotCountry[best]] : null;
  }

  private setHover(code: string | null, e?: PointerEvent) {
    if (code !== this.hoverCode) {
      this.hoverCode = code;
      this.dotMat.uniforms.uHover.value = code ? (this.codeIndex.get(code) ?? -1) : -1;
      this.renderer.domElement.style.cursor = this.dragging
        ? 'grabbing'
        : code
          ? 'pointer'
          : 'grab';
      this.start();
    }
    if (code && e) {
      const r = this.host.getBoundingClientRect();
      this.onHover({ code, x: e.clientX - r.left, y: e.clientY - r.top });
    } else if (!code) {
      this.onHover(null);
    }
  }

  private handleDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.dragging = { x: e.clientX, y: e.clientY, moved: 0 };
    this.targetRot = null;
    this.velX = this.velY = 0;
    this.lastInteract = performance.now();
    this.renderer.domElement.style.cursor = 'grabbing';
    this.start();
  };

  private handleMove = (e: PointerEvent) => {
    if (this.dragging) {
      const dx = e.clientX - this.dragging.x;
      const dy = e.clientY - this.dragging.y;
      this.dragging.x = e.clientX;
      this.dragging.y = e.clientY;
      this.dragging.moved += Math.abs(dx) + Math.abs(dy);
      const k = 2.4 / Math.max(this.host.clientHeight, 1);
      this.velY = dx * k;
      this.velX = dy * k;
      this.rotY += this.velY;
      this.rotX = Math.max(-1.1, Math.min(1.1, this.rotX + this.velX));
      this.lastInteract = performance.now();
      this.onHover(null);
      return;
    }
    if (e.target !== this.renderer.domElement) return;
    this.setHover(this.pick(e), e);
  };

  private handleUp = (e: PointerEvent) => {
    const drag = this.dragging;
    if (!drag) return;
    this.dragging = null;
    this.lastInteract = performance.now();
    if (drag.moved < 5) {
      const code = this.pick(e);
      if (code) this.onPick(code);
    }
    this.renderer.domElement.style.cursor = this.hoverCode ? 'pointer' : 'grab';
    this.start();
  };

  private handleLeave = () => {
    if (!this.dragging) this.setHover(null);
  };

  private handleVisibility = () => {
    if (!document.hidden) this.start();
  };
}
