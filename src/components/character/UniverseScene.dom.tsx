'use dom';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type Faction = 'family' | 'enemy' | 'ally' | 'teammate';

export interface UniverseNode {
  id: string;
  name: string;
  avatar_url: string | null;
  portrait_url: string | null;
  image_md_url: string | null;
  image_url: string | null;
  fame_score: number | null;
  is_subject: boolean;
  /** Tie to the subject; null for the subject itself. */
  kind: Faction | null;
}

export interface UniverseEdge {
  from: string;
  to: string;
  kind: Faction;
}

const KIND_RGB: Record<string, string> = {
  enemy: '181,48,43',
  ally: '99,169,54',
  teammate: '21,161,171',
  family: '124,58,237',
};

/**
 * Fixed order and fixed names. The point of this layout is that WHERE a head
 * sits tells you what it is, and that only pays off if the arrangement is the
 * same on every character — a hashed or force-derived arrangement has to be
 * re-read from scratch each time.
 */
/** Halo size as a multiple of the head. Kept under 1.5 so haloes never merge. */
const GLOW_SCALE = 1.34;

/**
 * Opening tilt, in radians (~59°). See the `pitch` declaration for why it can't
 * be 0; the reason it's this STEEP is that the heads are billboards which always
 * face the camera, so depth buys no information here — all a shallow angle did
 * was squash the ring to 41% of its width and let the far clusters land on top
 * of the near ones. Near plan view the ring reads as an actual ring.
 */
const INITIAL_PITCH = 1.03;

/**
 * The ring is a CIRCLE, deliberately.
 *
 * Widening it into an ellipse to spend the dead margins a widescreen viewport
 * leaves either side is tempting and wrong: the scene drifts and can be
 * orbited, and a baked-in stretch rotates with it, so the moment the long axis
 * swings front-to-back the vertical extent grows by the stretch factor and the
 * near cluster clips off the bottom of the frame. Sizing the camera for that
 * worst case cancels out the gain exactly. A circle has the same silhouette at
 * every yaw, so it can be framed tightly and stay framed.
 */
const STRETCH_X = 1;

/** Faction heading pill. Set as one string so it can't be reflowed per frame. */
const CHIP_CSS = [
  'position:absolute',
  'left:0',
  'top:0',
  'white-space:nowrap',
  'pointer-events:none',
  'font:700 10px/1 ui-sans-serif,system-ui,sans-serif',
  'letter-spacing:0.14em',
  'text-transform:uppercase',
  'padding:5px 9px',
  'border-radius:999px',
  'border:1px solid',
  'background:rgba(11,24,32,0.72)',
  'backdrop-filter:blur(3px)',
  'transition:opacity 180ms ease',
].join(';');

const FACTIONS: Faction[] = ['enemy', 'teammate', 'ally', 'family'];
const FACTION_LABEL: Record<Faction, string> = {
  enemy: 'Nemeses',
  teammate: 'Teammates',
  ally: 'Allies',
  family: 'Bloodline',
};

/** Deterministic 0–1 hash, so a character's universe is identical every visit. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Soft radial glow sprite — the aura behind each head, tinted by relationship. */
function makeGlowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

/** Initials on a disc — the stand-in for heroes with no avatar yet. */
function makeMonogramTexture(name: string, seed: string): THREE.Texture {
  const palette = ['#293C43', '#502314', '#7c3aed', '#b07d00', '#15A1AB', '#63A936', '#B5302B'];
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fillStyle = palette[Math.floor(hash01(seed) * palette.length) % palette.length];
    ctx.fill();
    const initials =
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase() || '?';
    ctx.fillStyle = '#f5ebdc';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 64, 68);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * Cloudinary derivative — 256px is plenty for a head this size.
 *
 * Explicitly WebP, never `f_auto`: f_auto picks PNG8 for these cut-outs, and a
 * 256-colour palette can't hold a smooth alpha ramp (29 distinct alpha levels
 * instead of 73 on Batman), which stair-steps every silhouette. WebP keeps the
 * full ramp at roughly half the bytes.
 */
function textureUrl(n: UniverseNode): string | null {
  const url = n.avatar_url;
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/f_webp,q_auto,w_256/');
}

/** Reorder so the first (most famous) entries land in the MIDDLE of the row. */
function centreOut<T>(arr: T[]): T[] {
  const out: T[] = [];
  arr.forEach((v, i) => (i % 2 === 0 ? out.push(v) : out.unshift(v)));
  return out;
}

export interface Cluster {
  faction: Faction;
  label: string;
  count: number;
  /** Where the heading floats — above the middle of the group. */
  anchor: THREE.Vector3;
}

/**
 * Arrange the cast as FACTIONS STANDING TOGETHER around the subject, rather
 * than as a simulated network.
 *
 * The previous layout placed each relationship kind on its own sphere shell.
 * That encoded the tie in the *radius*, which perspective destroys — a
 * near teammate and a far enemy project to the same place — so position ended
 * up carrying no readable information and the field looked like scattered fog.
 * Here each faction owns an angular SECTOR instead, which survives projection:
 * a group reads as a group from any angle you orbit to.
 *
 * Sectors, not rings, is also what makes unbalanced casts work. Rings failed
 * because Supergirl's 22 teammates and 2 enemies had to share equal
 * circumference. A sector's width is proportional to its membership, so a big
 * faction simply gets a wider arc and every head keeps the same spacing.
 */
function factionLayout(nodes: UniverseNode[]): {
  positions: Map<string, THREE.Vector3>;
  clusters: Cluster[];
  radius: number;
} {
  const positions = new Map<string, THREE.Vector3>();
  const clusters: Cluster[] = [];

  const byFaction = new Map<Faction, UniverseNode[]>();
  for (const n of nodes) {
    if (n.is_subject) continue;
    const f = n.kind ?? 'ally';
    byFaction.set(f, [...(byFaction.get(f) ?? []), n]);
  }
  // Most famous first, so centreOut puts the recognisable faces at the heart of
  // each group and the deep cuts out at the edges.
  for (const list of byFaction.values()) {
    list.sort((a, b) => (b.fame_score ?? 0) - (a.fame_score ?? 0));
  }

  const present = FACTIONS.filter((f) => (byFaction.get(f)?.length ?? 0) > 0);
  if (present.length === 0) return { positions, clusters, radius: 3.2 };

  const total = present.reduce((s, f) => s + (byFaction.get(f)?.length ?? 0), 0);
  const GAP = 0.34; // empty arc between neighbouring factions, in radians
  const MIN_SPAN = 0.42;
  const usable = Math.PI * 2 - GAP * present.length;

  const spans = present.map((f) =>
    Math.max(MIN_SPAN, (usable * (byFaction.get(f)!.length / total)) as number),
  );
  // Re-normalise: the MIN_SPAN floor can push the total past a full turn.
  const spanSum = spans.reduce((a, b) => a + b, 0);
  const k = usable / spanSum;
  const finalSpans = spans.map((s) => s * k);

  const rowsFor = (n: number) => (n <= 4 ? 1 : n <= 11 ? 2 : 3);

  // Rows step OUTWARD in the ring plane, not upward.
  //
  // The scene is viewed on a steep tilt, and rotating the world about X maps
  // world-Y onto screen DEPTH by cos(pitch) — so rows stacked in Y flatten into
  // each other exactly as the view gets steep enough to separate the clusters.
  // Stepping in radius instead puts the rows along the same axis the tilt keeps
  // visible, so a faction reads as a wedge at any angle.
  const ROW_STEP = 1.06;

  // Radius is derived, not fixed: every head needs roughly HEAD_ARC of arc
  // length, and arc length is radius x angle, so the ring has to be pushed out
  // far enough for the most crowded row in the widest faction to breathe. The
  // binding row is the INNERMOST one, which has the least circumference.
  const HEAD_ARC = 0.92;
  let radius = 3.4;
  present.forEach((f, i) => {
    const n = byFaction.get(f)!.length;
    const rowCount = rowsFor(n);
    const perRow = Math.ceil(n / rowCount);
    const inset = ((rowCount - 1) / 2) * ROW_STEP;
    radius = Math.max(radius, (perRow * HEAD_ARC) / finalSpans[i] + inset);
  });
  radius = Math.min(radius, 7.6);

  // Start enemies at the front-left so the default camera opens on conflict,
  // and the rest of the world unwraps as you orbit right.
  let cursor = Math.PI * 0.82;
  // Tracks the furthest thing from the centre — including the headings, which
  // sit beyond the outermost row. Leaving them out of the measurement is what
  // pushed the Bloodline label off the bottom of the viewport.
  let outerRadius = radius;

  present.forEach((faction, i) => {
    const members = byFaction.get(faction)!;
    const span = finalSpans[i];
    const start = cursor;
    const mid = start + span / 2;
    cursor += span + GAP;

    const rowCount = rowsFor(members.length);
    const inset = ((rowCount - 1) / 2) * ROW_STEP;
    // Deal round-robin so each row gets a mix of prominence rather than one row
    // of stars in front of a row of nobodies.
    const rows: UniverseNode[][] = Array.from({ length: rowCount }, () => []);
    members.forEach((m, idx) => rows[idx % rowCount].push(m));

    rows.forEach((row, r) => {
      const ordered = centreOut(row);
      const rowRadius = radius - inset + r * ROW_STEP;
      outerRadius = Math.max(outerRadius, rowRadius);
      ordered.forEach((n, c) => {
        const frac = ordered.length === 1 ? 0.5 : (c + 0.5) / ordered.length;
        // Outer rows are staggered half a slot so heads don't line up radially
        // into spokes, and a touch of deterministic scatter keeps a group
        // looking like a crowd rather than a spreadsheet.
        const stagger = r % 2 === 1 ? span / (ordered.length * 2) : 0;
        const jitter = (hash01(n.id) - 0.5) * 0.1;
        const theta = start + frac * span + stagger + jitter;
        positions.set(
          n.id,
          new THREE.Vector3(
            Math.cos(theta) * rowRadius * STRETCH_X,
            (hash01(n.id + 'y') - 0.5) * 0.22,
            Math.sin(theta) * rowRadius,
          ),
        );
      });
    });

    const labelRadius = radius - inset + (rowCount - 1) * ROW_STEP + 0.95;
    outerRadius = Math.max(outerRadius, labelRadius);
    clusters.push({
      faction,
      label: FACTION_LABEL[faction],
      count: members.length,
      // Just beyond the outermost row, on the faction's centre line — outside
      // the heads it names rather than floating over them.
      anchor: new THREE.Vector3(
        Math.cos(mid) * labelRadius * STRETCH_X,
        0,
        Math.sin(mid) * labelRadius,
      ),
    });
  });

  return { positions, clusters, radius: outerRadius };
}

export default function UniverseScene({
  nodes,
  edges,
  subjectId,
  focusId = null,
  onSelect,
  onRecenter,
}: {
  nodes: UniverseNode[];
  edges: UniverseEdge[];
  subjectId: string;
  /** Highlighted node (e.g. picked from search) — read live, never rebuilds. */
  focusId?: string | null;
  onSelect?: (id: string) => Promise<void>;
  onRecenter?: (id: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const clusterLayerRef = useRef<HTMLDivElement | null>(null);
  // Held in refs so the render loop reads the latest values without tearing the
  // whole scene down and rebuilding it every time a callback or focus changes.
  const selectRef = useRef(onSelect);
  const recenterRef = useRef(onRecenter);
  const focusRef = useRef(focusId);
  useEffect(() => {
    selectRef.current = onSelect;
    recenterRef.current = onRecenter;
    focusRef.current = focusId;
  }, [onSelect, onRecenter, focusId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || nodes.length === 0) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    // The DOM component gets its own document, which still carries the UA's
    // default body margin — that alone shifts the whole canvas off-centre.
    document.documentElement.style.margin = '0';
    document.documentElement.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'grab';
    // Without this the browser claims the gestures first: one finger scrolls the
    // page and two fingers zoom the document, so neither orbit nor pinch ever
    // reaches the scene on mobile Safari.
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.overscrollBehavior = 'none';

    const scene = new THREE.Scene();
    const FOV = 46;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    // Dead-on, aimed at the origin where the subject sits. An unaimed camera
    // lifted on Y still looks straight down -Z, which pushed the subject below
    // the centre of frame — the offset had nothing to do with the layout.
    camera.position.set(0, 0, 7.6);
    camera.lookAt(0, 0, 0);

    const { positions, clusters, radius: ringRadius } = factionLayout(nodes);
    positions.set(subjectId, new THREE.Vector3(0, 0, 0));

    // How far back the camera must sit for the whole system to fit the frame.
    //
    // three's fov is VERTICAL, so a fixed distance that frames the scene nicely
    // on a wide desktop viewport gives a phone a far narrower horizontal field —
    // which is why mobile came out massively over-zoomed with heads spilling off
    // both edges. Deriving the distance from the aspect ratio fixes every screen
    // shape at once instead of special-casing a breakpoint.
    // The ring is wide but, seen on a tilt, not nearly as tall — its height on
    // screen is only radius x sin(pitch) plus the stacked rows and their
    // heading. Measuring both axes honestly instead of treating the scene as a
    // sphere is what stops it sitting marooned in the middle of a big viewport.
    const HEAD_PAD = 0.72;
    const fitDistance = (aspect: number): number => {
      const half = (FOV * Math.PI) / 360;
      // Rows now step radially, so the whole scene is the ring plus one head
      // either side. Vertically that plane is foreshortened by sin(pitch), and
      // measuring it honestly rather than as a sphere is what stops the graph
      // sitting marooned in the middle of a large viewport.
      const vExtent = ringRadius * Math.sin(INITIAL_PITCH) + HEAD_PAD + 0.25;
      const hExtent = ringRadius * STRETCH_X + HEAD_PAD;
      const forHeight = vExtent / Math.tan(half);
      const forWidth = hExtent / (Math.tan(half) * aspect);
      return Math.max(forHeight, forWidth);
    };
    // User zoom multiplies the fitted distance, so pinching stays sane on any screen.
    let zoom = 1;

    const disposables: { dispose(): void }[] = [renderer];
    const track = <T extends { dispose(): void }>(d: T): T => {
      disposables.push(d);
      return d;
    };

    // ── Starfield: cheap parallax reference so rotation reads as depth ────────
    const starGeo = track(new THREE.BufferGeometry());
    const STARS = 700;
    const starPos = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      // Shell well outside the graph so stars never intersect the heads.
      const t = Math.acos(2 * Math.random() - 1);
      const p = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 16;
      starPos[i * 3] = Math.sin(t) * Math.cos(p) * r;
      starPos[i * 3 + 1] = Math.cos(t) * r;
      starPos[i * 3 + 2] = Math.sin(t) * Math.sin(p) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = track(
      new THREE.PointsMaterial({
        size: 0.06,
        color: new THREE.Color('#f5ebdc'),
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
        depthWrite: false,
      }),
    );
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Nodes ────────────────────────────────────────────────────────────────
    const world = new THREE.Group();
    scene.add(world);

    const glowTex = track(makeGlowTexture());
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    // `ready` gates the head's fade-in. A SpriteMaterial with no map yet renders
    // as an opaque WHITE SQUARE, so the field flashes a grid of blank tiles while
    // textures stream in. Heads start fully transparent and ease in once their
    // texture actually lands; the tinted glow shows immediately, so a loading node
    // reads as a soft coloured ember rather than as nothing (or as a white box).
    type Placed = {
      node: UniverseNode;
      sprite: THREE.Sprite;
      glow: THREE.Sprite;
      base: number;
      ready: boolean;
      fade: number;
    };
    const placed: Placed[] = [];

    for (const n of nodes) {
      const pos = positions.get(n.id);
      if (!pos) continue;

      const fame = (n.fame_score ?? 0) / 100;
      // The subject sits alone at the centre of the ring with nothing to lend
      // her scale, so she has to be decisively larger than the crowd rather
      // than merely the biggest head among many.
      const scale = n.is_subject ? 1.9 : 0.66 + 0.36 * fame;

      // A tight rim, not an aura. At the old 2.1x scale and 0.55 opacity the
      // glows of adjacent heads overlapped and additively summed into one
      // formless cloud — the "green fog" in the middle of the screen. Grouping
      // heads into clusters packs them tighter still, so the halo has to come in
      // well inside the head's own silhouette and stay faint; it now reads as a
      // faction tint on each face instead of weather.
      const glowMat = track(
        new THREE.SpriteMaterial({
          map: glowTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          color: new THREE.Color(
            `rgb(${n.is_subject ? '224,163,53' : (KIND_RGB[n.kind ?? 'ally'] ?? '162,161,155')})`,
          ),
          opacity: n.is_subject ? 0.5 : 0.26,
        }),
      );
      const glow = new THREE.Sprite(glowMat);
      glow.position.copy(pos);
      glow.scale.setScalar(scale * GLOW_SCALE);
      // Behind the head, and never occluding anything.
      glow.renderOrder = 0;
      world.add(glow);

      const spriteMat = track(
        new THREE.SpriteMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: false,
          opacity: 0,
        }),
      );

      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(pos);
      sprite.scale.setScalar(scale);
      sprite.renderOrder = 1;
      sprite.userData.id = n.id;
      world.add(sprite);

      const entry: Placed = { node: n, sprite, glow, base: scale, ready: false, fade: 0 };
      const url = textureUrl(n);
      if (url) {
        loader.load(
          url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            // Trilinear mips + anisotropy: without them a head shrinks to a
            // shimmering, crunchy mess as it rotates away from the camera.
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.anisotropy = maxAnisotropy;
            spriteMat.map = tex;
            spriteMat.needsUpdate = true;
            track(tex);
            entry.ready = true;
          },
          undefined,
          () => {
            spriteMat.map = track(makeMonogramTexture(n.name, n.id));
            spriteMat.needsUpdate = true;
            entry.ready = true;
          },
        );
      } else {
        // No avatar: the monogram is generated locally, so it's ready at once.
        spriteMat.map = track(makeMonogramTexture(n.name, n.id));
        entry.ready = true;
      }
      placed.push(entry);
    }

    // ── Edges: drawn on demand, never as a resting state ─────────────────────
    //
    // Where a head SITS now says what it is to the subject, so drawing the
    // subject's own ties would restate the layout in lines — the single biggest
    // source of visual noise on the old scene, and the reason it read as a
    // hairball. What position can't express is how the cast relates to *each
    // other*, so the lines are reserved for exactly that: focus a head and its
    // own connections light up across the clusters (Ares also fights Hippolyta),
    // which is new information rather than decoration.
    //
    // Only the lit segments are ever WRITTEN into the buffer, and the draw range
    // is set to exactly how many there are. The first attempt hid a segment by
    // multiplying its colour to black, on the reasoning that black adds nothing
    // under additive blending — and the whole 257-edge web stayed on screen with
    // nothing focused. Not drawing a line is unambiguous in a way that drawing an
    // invisible one is not, so the state is carried by geometry, not by colour.
    const segs = edges.flatMap((e) => {
      const a = positions.get(e.from);
      const b = positions.get(e.to);
      if (!a || !b) return [];
      const [r, g, bl] = (KIND_RGB[e.kind] ?? '162,161,155').split(',').map(Number);
      return [
        {
          a: e.from,
          b: e.to,
          pts: [a.x, a.y, a.z, b.x, b.y, b.z],
          rgb: [r / 255, g / 255, bl / 255] as [number, number, number],
        },
      ];
    });

    let lines: THREE.LineSegments | null = null;
    let posAttr: THREE.Float32BufferAttribute | null = null;
    let colAttr: THREE.Float32BufferAttribute | null = null;
    if (segs.length) {
      const lineGeo = track(new THREE.BufferGeometry());
      posAttr = new THREE.Float32BufferAttribute(new Float32Array(segs.length * 6), 3);
      colAttr = new THREE.Float32BufferAttribute(new Float32Array(segs.length * 6), 3);
      lineGeo.setAttribute('position', posAttr);
      lineGeo.setAttribute('color', colAttr);
      lineGeo.setDrawRange(0, 0);
      const lineMat = track(
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      lines = new THREE.LineSegments(lineGeo, lineMat);
      lines.renderOrder = -1;
      lines.visible = false;
      // The bounding sphere is computed from a buffer that's mostly unwritten
      // zeros, so leaving culling on can drop the lines entirely.
      lines.frustumCulled = false;
      world.add(lines);
    }

    /** Draw only the segments touching `id`; pass null to draw none at all. */
    const litEdgesFor = (id: string | null) => {
      if (!lines || !posAttr || !colAttr) return;
      if (!id) {
        lines.visible = false;
        lines.geometry.setDrawRange(0, 0);
        return;
      }
      const p = posAttr.array as Float32Array;
      const c = colAttr.array as Float32Array;
      let n = 0;
      for (const s of segs) {
        if (s.a !== id && s.b !== id) continue;
        const o = n * 6;
        // Wind each segment so the focused character is always the first
        // vertex, which lets the gradient read as reaching out FROM them.
        const [x1, y1, z1, x2, y2, z2] = s.pts;
        const fromFocus = s.a === id;
        p[o] = fromFocus ? x1 : x2;
        p[o + 1] = fromFocus ? y1 : y2;
        p[o + 2] = fromFocus ? z1 : z2;
        p[o + 3] = fromFocus ? x2 : x1;
        p[o + 4] = fromFocus ? y2 : y1;
        p[o + 5] = fromFocus ? z2 : z1;
        const [r, g, b] = s.rgb;
        c[o] = r;
        c[o + 1] = g;
        c[o + 2] = b;
        c[o + 3] = r * 0.12;
        c[o + 4] = g * 0.12;
        c[o + 5] = b * 0.12;
        n++;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      lines.geometry.setDrawRange(0, n * 2);
      lines.visible = n > 0;
    };

    // ── Cluster headings ─────────────────────────────────────────────────────
    // The whole design rests on the viewer knowing that this group is the
    // nemeses and that one is the bloodline, so the groups are named outright.
    // These are DOM, not sprites: text stays crisp at any zoom, costs no
    // texture, and inherits real font rendering.
    const layer = clusterLayerRef.current;
    const chips = clusters.map((c) => {
      const el = document.createElement('div');
      el.textContent = `${c.label} · ${c.count}`;
      el.setAttribute('style', CHIP_CSS);
      el.style.color = `rgb(${KIND_RGB[c.faction]})`;
      el.style.borderColor = `rgba(${KIND_RGB[c.faction]},0.42)`;
      layer?.appendChild(el);
      // Measured once, here, rather than per frame: reading offsetWidth in the
      // render loop forces a synchronous layout on every tick.
      return { cluster: c, el, w: el.offsetWidth / 2, h: el.offsetHeight / 2 };
    });

    // ── Interaction ──────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: string | null = null;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    // Slower than the old free-floating field: the arrangement now MEANS
    // something, so it should drift enough to feel alive and not so much that
    // the viewer is chasing a carousel.
    let spinVel = 0.0009;
    let yaw = 0;
    // The clusters ring the subject in the horizontal plane, and a camera at
    // y = 0 looks straight down that plane — every group would collapse onto a
    // single horizontal line. Opening on a tilt turns the ring into an ellipse,
    // which is what separates the clusters on screen. The clamp keeps the view
    // off both degenerate extremes: edge-on at 0, and a flat plan view at π/2.
    let pitch = INITIAL_PITCH;
    let pointerInside = false;

    const setLabel = (text: string | null, x = 0, y = 0) => {
      const el = labelRef.current;
      if (!el) return;
      if (!text) {
        el.style.opacity = '0';
        return;
      }
      el.textContent = text;
      el.style.opacity = '1';
      el.style.transform = `translate(-50%, -140%) translate(${x}px, ${y}px)`;
    };

    // Touch needs its own handling: phones have no hover, and without a pinch
    // there is no way to zoom out of a system that doesn't fit. Tracking every
    // active pointer lets one finger orbit and two fingers pinch, from the same
    // events desktop already uses.
    const active = new Map<number, { x: number; y: number }>();
    let pinchStart: { dist: number; zoom: number } | null = null;
    let movedWhilePressed = 0;

    const spread = (): number => {
      const pts = [...active.values()];
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onPointerMove = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      pointerInside = true;

      if (active.has(ev.pointerId)) {
        active.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      }

      if (active.size >= 2) {
        // Pinch. Distance is a ratio against the spread at gesture start, so it
        // tracks the fingers exactly rather than drifting.
        const d = spread();
        if (pinchStart && d > 0) {
          zoom = Math.max(0.45, Math.min(2.2, pinchStart.zoom * (pinchStart.dist / d)));
        }
        return;
      }

      if (dragging) {
        movedWhilePressed += Math.abs(ev.clientX - lastX) + Math.abs(ev.clientY - lastY);
        yaw += (ev.clientX - lastX) * 0.005;
        pitch = Math.max(0.45, Math.min(1.42, pitch + (ev.clientY - lastY) * 0.003));
        lastX = ev.clientX;
        lastY = ev.clientY;
      }
    };

    const onPointerDown = (ev: PointerEvent) => {
      active.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (active.size === 2) {
        pinchStart = { dist: spread(), zoom };
        dragging = false;
        return;
      }
      dragging = true;
      movedWhilePressed = 0;
      lastX = ev.clientX;
      lastY = ev.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    };

    const onPointerUp = (ev?: PointerEvent) => {
      if (ev) active.delete(ev.pointerId);
      if (active.size < 2) pinchStart = null;
      if (active.size === 0) dragging = false;
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';

      // Touch never hovers, so a tap has to be resolved here — and only if the
      // finger stayed put, otherwise every orbit would end in a selection.
      if (ev && ev.pointerType !== 'mouse' && movedWhilePressed < 10 && !pinchStart) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        const id = pick();
        if (id) void selectRef.current?.(id);
      }
    };
    const onLeave = () => {
      pointerInside = false;
      setLabel(null);
    };
    const pick = (): string | null => {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(
        placed.map((p) => p.sprite),
        false,
      );
      return (hits[0]?.object.userData.id as string) ?? null;
    };

    const onClick = () => {
      const id = hovered ?? pick();
      if (id) void selectRef.current?.(id);
    };
    // Double-click travels: that character becomes the new centre of the universe.
    const onDoubleClick = () => {
      if (hovered && hovered !== subjectId) void recenterRef.current?.(hovered);
    };

    const el = renderer.domElement;
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('click', onClick);
    el.addEventListener('dblclick', onDoubleClick);

    // ── Resize ───────────────────────────────────────────────────────────────
    // Measure the viewport, not the mount. This component renders inside its own
    // DOM-component document, where a percentage-height chain doesn't resolve —
    // clientHeight came back 0, the aspect ratio blew up, and the scene rendered
    // enormous and off in a corner. The iframe IS the stage, so vw/vh is the
    // honest measurement. `setSize` also updates the canvas CSS size (no third
    // argument), otherwise the element stays at its default 300x150.
    const resize = () => {
      const w = window.innerWidth || mount.clientWidth || 1;
      const h = window.innerHeight || mount.clientHeight || 1;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      baseDistance = fitDistance(camera.aspect);
    };
    let baseDistance = 8;
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    window.addEventListener('resize', resize);

    // ── Loop ─────────────────────────────────────────────────────────────────
    let raf = 0;
    const clock = new THREE.Clock();
    let entrance = reduced ? 1 : 0;
    // `undefined` rather than null, so the first frame always writes the buffer.
    let lastLead: string | null | undefined;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      if (entrance < 1) entrance = Math.min(1, entrance + 0.02);
      const ease = 1 - Math.pow(1 - entrance, 3);

      // Distance is always the fitted distance for this viewport, scaled by the
      // user's pinch — so the system frames correctly on any screen shape.
      camera.position.z = baseDistance * zoom;
      camera.lookAt(0, 0, 0);

      // Idle drift stops while you're driving, and eases back afterwards.
      if (!dragging && !reduced) yaw += spinVel;
      spinVel = dragging ? 0 : Math.min(0.0009, spinVel + 0.00003);
      world.rotation.y = yaw;
      world.rotation.x = pitch;

      // Hover test
      if (pointerInside && !dragging) {
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(
          placed.map((p) => p.sprite),
          false,
        );
        const id = (hits[0]?.object.userData.id as string) ?? null;
        if (id !== hovered) {
          hovered = id;
          el.style.cursor = id ? 'pointer' : 'grab';
        }
        if (hovered) {
          const hit = placed.find((p) => p.node.id === hovered)!;
          const v = hit.sprite.position.clone();
          world.localToWorld(v);
          v.project(camera);
          const rect = el.getBoundingClientRect();
          setLabel(
            hit.node.name,
            (v.x * 0.5 + 0.5) * rect.width - rect.width / 2,
            (-v.y * 0.5 + 0.5) * rect.height - rect.height / 2,
          );
        } else {
          setLabel(null);
        }
      }

      // Lines follow whichever head is being pointed at or held in focus, and
      // the buffer is only rewritten when that actually changes.
      const focused = focusRef.current;
      const lead = hovered ?? focused;
      if (lead !== lastLead) {
        lastLead = lead;
        litEdgesFor(lead);
      }

      // Cluster headings track their group in screen space, and fade out as the
      // group swings round the back so labels never read against the wrong pile.
      for (const { cluster, el, w, h } of chips) {
        const v = cluster.anchor.clone();
        world.localToWorld(v);
        const depth = v.clone().applyMatrix4(camera.matrixWorldInverse).z;
        // -1 at the nearest point of the ring, +1 at the furthest.
        const t = Math.max(-1, Math.min(1, (-depth - camera.position.z) / ringRadius));
        v.project(camera);
        const rect = el.parentElement?.getBoundingClientRect();
        if (!rect) continue;
        // The anchors sit outside the ring, which on a narrow viewport is past
        // the edge of the frame — the headings were being sliced into "EMESES"
        // and "ALLIES ·". Clamping keeps a group's name readable; it can drift
        // a little off its centre line, which costs far less than losing it.
        const sx = Math.min(Math.max((v.x * 0.5 + 0.5) * rect.width, w + 8), rect.width - w - 8);
        const sy = Math.min(Math.max((-v.y * 0.5 + 0.5) * rect.height, h + 8), rect.height - h - 8);
        el.style.transform = `translate(-50%,-50%) translate(${sx}px, ${sy}px)`;
        // Recede with depth, never disappear. Fading the far label out was
        // right when the ring was near edge-on and the back half sat behind the
        // subject; from a steep view all four clusters are equally visible, so
        // hiding one of the four headings would just lose a group's name.
        el.style.opacity = String((1 - 0.45 * Math.max(0, Math.min(1, (t + 1) / 2))) * ease);
      }

      for (const p of placed) {
        const active = p.node.id === hovered || p.node.id === focused;
        const lift = active ? 1.18 : 1;
        // A slow per-node bob, phase-shifted by id, so the field breathes
        // instead of sitting rigid.
        const bob =
          p.node.is_subject || reduced ? 1 : 1 + Math.sin(t * 0.7 + hash01(p.node.id) * 9) * 0.03;
        const s = p.base * lift * bob * ease;
        p.sprite.scale.setScalar(s);
        p.glow.scale.setScalar(s * GLOW_SCALE);
        (p.glow.material as THREE.SpriteMaterial).opacity =
          (p.node.is_subject ? 0.5 : 0.26) * ease * (active ? 2.4 : 1);
        // Fade the head in once its texture exists, and dim everything unrelated
        // while one character holds focus. Multiplying by `fade` means a head is
        // never drawn as the blank white square of an unmapped material.
        p.fade = Math.min(1, p.fade + (p.ready ? 0.06 : 0));
        // A gentle recede, not a blackout. At 0.28 the other 23 heads read as
        // half-loaded rather than as context, which made the whole scene look
        // broken the moment anything was selected; the lit head's own lift and
        // halo carry the emphasis instead.
        const dim = focused && !active && !p.node.is_subject ? 0.62 : 1;
        (p.sprite.material as THREE.SpriteMaterial).opacity = p.fade * dim;
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('click', onClick);
      el.removeEventListener('dblclick', onDoubleClick);
      for (const { el: chip } of chips) chip.remove();
      for (const d of disposables) d.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, [nodes, edges, subjectId]);

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
      {/* Faction headings live here, positioned per frame from the scene. */}
      <div
        ref={clusterLayerRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
      />
      <div
        ref={labelRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 140ms ease',
          background: 'rgba(11,24,32,0.92)',
          color: '#f5ebdc',
          font: '600 12px/1.2 system-ui, sans-serif',
          padding: '5px 9px',
          borderRadius: 7,
          whiteSpace: 'nowrap',
        }}
      />
    </div>
  );
}
