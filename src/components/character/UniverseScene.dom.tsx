'use dom';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { heroNodeTextureSource } from '../../constants/heroImages';

export type Faction = 'family' | 'enemy' | 'ally' | 'teammate';

export interface UniverseNode {
  id: string;
  name: string;
  avatar_url: string | null;
  portrait_url: string | null;
  // No ComicVine image_url: that host sends no CORS header, so WebGL can't take
  // it as a texture. See heroNodeTextureSource.
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

/** Initials on a disc — the last resort, for heroes with no avatar and no portrait. */
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

// 256px is plenty for a head this size; the stored art is 1024px.
const NODE_TEXTURE_WIDTH = 256;

function nodeArt(n: UniverseNode) {
  return heroNodeTextureSource(n.avatar_url, n.portrait_url, NODE_TEXTURE_WIDTH);
}

/**
 * Extra halo strength behind an OPAQUE head. A cut-out shows the glow's bright
 * core through its silhouette; a disc covers the core and leaves only the dim
 * outer tail, so at gain 1 a portrait's faction colour barely reads.
 */
const OPAQUE_GLOW_GAIN = 1.9;

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
  /** Members in drawn order — also the order arrow keys walk them in. */
  ids: string[];
  /** Names, parallel to `ids`, for the screen-reader list. */
  names: string[];
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
      ids: members.map((m) => m.id),
      names: members.map((m) => m.name),
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
  lift = 0,
  onSelect,
  onRecenter,
}: {
  nodes: UniverseNode[];
  edges: UniverseEdge[];
  subjectId: string;
  /** Highlighted node (e.g. picked from search) — read live, never rebuilds. */
  focusId?: string | null;
  /**
   * Raise the whole constellation by this fraction of the visible half-height.
   *
   * On a phone the dossier sheet covers the lower half of the viewport, and the
   * ring is centred in it — so the subject, and whole clusters, end up hidden
   * behind the panel describing them. Lifting the scene keeps the character you
   * are reading about on screen above the text.
   */
  lift?: number;
  onSelect?: (id: string) => Promise<void>;
  onRecenter?: (id: string) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const clusterLayerRef = useRef<HTMLDivElement | null>(null);
  const srLayerRef = useRef<HTMLDivElement | null>(null);
  // Held in refs so the render loop reads the latest values without tearing the
  // whole scene down and rebuilding it every time a callback or focus changes.
  const selectRef = useRef(onSelect);
  const recenterRef = useRef(onRecenter);
  const focusRef = useRef(focusId);
  const liftRef = useRef(lift);
  useEffect(() => {
    selectRef.current = onSelect;
    recenterRef.current = onRecenter;
    focusRef.current = focusId;
    liftRef.current = lift;
  }, [onSelect, onRecenter, focusId, lift]);

  /**
   * Feeds a new cast into the LIVE scene, rather than replacing the scene.
   *
   * Travelling to another character changes `subjectId`, which used to be an
   * effect dependency — so every head was disposed, every texture re-fetched,
   * and the move through what is meant to be one continuous world played as a
   * hard cut. Neighbouring universes overlap heavily (Batman, Harley and
   * Catwoman are in both Wonder Woman's and the Joker's), so the heads present
   * in both can simply travel to their new positions. Keeping them on screen is
   * the whole difference between navigating a place and loading a page.
   */
  const applyRef = useRef<((n: UniverseNode[], e: UniverseEdge[], s: string) => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    // NOTE: document/body scroll locking lives in the SCREEN, not here — see
    // useUniverseScrollLock. Doing it on this effect's mount/unmount only
    // reverted when the component actually unmounted, which happens on back
    // but NOT when navigating forward: expo-router keeps the previous screen
    // mounted in the stack, so `overflow: hidden` outlived the page and every
    // screen opened from here was frozen.

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
    // Focusable, named, and driveable — without this the canvas is a dead
    // rectangle to anyone not using a mouse.
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('role', 'application');
    renderer.domElement.setAttribute(
      'aria-label',
      'Character universe. Arrow keys move between characters, Page Up and Page Down jump between groups, Enter opens a dossier, Shift+Enter travels there.',
    );
    renderer.domElement.style.outlineOffset = '-3px';

    const scene = new THREE.Scene();
    const FOV = 46;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    // Dead-on, aimed at the origin where the subject sits. An unaimed camera
    // lifted on Y still looks straight down -Z, which pushed the subject below
    // the centre of frame — the offset had nothing to do with the layout.
    camera.position.set(0, 0, 7.6);
    camera.lookAt(0, 0, 0);

    // Everything that changes when a new cast lands, or while travelling to one.
    const state = {
      subjectId: '',
      ringRadius: 4,
      /** The character being travelled TO, held until their own cast arrives. */
      travelId: null as string | null,
      dolly: 1,
      dollyTarget: 1,
      /** Opacity multiplier for everyone except the destination, while moving. */
      crowd: 1,
      crowdTarget: 1,
      panTarget: new THREE.Vector3(),
      /** Heads are still easing into a new arrangement until this moment. */
      settleUntil: 0,
      clusters: [] as Cluster[],
      /**
       * The keyboard cursor — a lightweight hover you can drive with arrows,
       * deliberately separate from `focusId`. Stepping through 24 characters
       * shouldn't fire off 24 dossiers; you move the cursor, then choose.
       */
      kbId: null as string | null,
    };

    // How far back the camera must sit for the whole system to fit the frame.
    //
    // three's fov is VERTICAL, so a fixed distance that frames the scene nicely
    // on a wide desktop viewport gives a phone a far narrower horizontal field —
    // which is why mobile came out massively over-zoomed with heads spilling off
    // both edges. Deriving the distance from the aspect ratio fixes every screen
    // shape at once instead of special-casing a breakpoint.
    const HEAD_PAD = 0.72;
    const fitDistance = (aspect: number): number => {
      const half = (FOV * Math.PI) / 360;
      // Rows step radially, so the whole scene is the ring plus one head either
      // side. Vertically that plane is foreshortened by sin(pitch), and
      // measuring it honestly rather than as a sphere is what stops the graph
      // sitting marooned in the middle of a large viewport.
      const vExtent = state.ringRadius * Math.sin(INITIAL_PITCH) + HEAD_PAD + 0.25;
      const hExtent = state.ringRadius * STRETCH_X + HEAD_PAD;
      const forHeight = vExtent / Math.tan(half);
      const forWidth = hExtent / (Math.tan(half) * aspect);
      return Math.max(forHeight, forWidth);
    };
    // User zoom multiplies the fitted distance, so pinching stays sane on any screen.
    let zoom = 1;
    let baseDistance = 8;

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

    // Every head carries its own tween state. `target`/`targetBase` are where
    // the current cast says it belongs; `alpha` is presence, easing 0→1 as a
    // character joins the universe and 1→0 as they leave it.
    //
    // `ready` gates the texture fade. A SpriteMaterial with no map yet renders
    // as an opaque WHITE SQUARE, so the field would flash a grid of blank tiles
    // while textures stream in. Heads start fully transparent and ease in once
    // their texture actually lands; the tinted glow shows immediately, so a
    // loading node reads as a soft coloured ember rather than as a white box.
    type Placed = {
      node: UniverseNode;
      sprite: THREE.Sprite;
      glow: THREE.Sprite;
      mat: THREE.SpriteMaterial;
      glowMat: THREE.SpriteMaterial;
      tex: THREE.Texture | null;
      target: THREE.Vector3;
      colour: THREE.Color;
      /** 1 for a cut-out head, OPAQUE_GLOW_GAIN for a disc. */
      glowGain: number;
      base: number;
      targetBase: number;
      ready: boolean;
      fade: number;
      alpha: number;
      targetAlpha: number;
    };
    const placed = new Map<string, Placed>();
    let sprites: THREE.Sprite[] = [];
    const reindex = () => {
      sprites = [...placed.values()].map((p) => p.sprite);
    };

    const SUBJECT_SCALE = 1.9;
    const SUBJECT_RGB = '224,163,53';
    const colourFor = (n: UniverseNode) =>
      new THREE.Color(
        `rgb(${n.is_subject ? SUBJECT_RGB : (KIND_RGB[n.kind ?? 'ally'] ?? '162,161,155')})`,
      );
    // The subject sits alone at the centre of the ring with nothing to lend her
    // scale, so she has to be decisively larger than the crowd rather than
    // merely the biggest head among many.
    const scaleFor = (n: UniverseNode) =>
      n.is_subject ? SUBJECT_SCALE : 0.66 + 0.36 * ((n.fame_score ?? 0) / 100);

    const spawn = (n: UniverseNode, pos: THREE.Vector3): Placed => {
      // A tight rim, not an aura. At the old 2.1x scale and 0.55 opacity the
      // glows of adjacent heads overlapped and additively summed into one
      // formless cloud — the "green fog" in the middle of the screen. Grouping
      // heads into clusters packs them tighter still, so the halo has to come in
      // well inside the head's own silhouette and stay faint; it now reads as a
      // faction tint on each face instead of weather.
      const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: colourFor(n),
        opacity: 0,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.position.copy(pos);
      // Behind the head, and never occluding anything.
      glow.renderOrder = 0;
      world.add(glow);

      const mat = new THREE.SpriteMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(pos);
      sprite.renderOrder = 1;
      sprite.userData.id = n.id;
      world.add(sprite);

      const art = nodeArt(n);
      const entry: Placed = {
        node: n,
        sprite,
        glow,
        mat,
        glowMat,
        tex: null,
        target: pos.clone(),
        colour: colourFor(n),
        // A monogram is a disc too, so it takes the same lift as a portrait.
        glowGain: art?.tier === 'avatar' ? 1 : OPAQUE_GLOW_GAIN,
        // Arrivals grow in from nothing where they belong, rather than flying in
        // from off-stage, which would fight the clusters for attention.
        base: 0,
        targetBase: scaleFor(n),
        ready: false,
        fade: 0,
        alpha: 0,
        targetAlpha: 1,
      };

      if (art) {
        loader.load(
          art.uri,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            // Trilinear mips + anisotropy: without them a head shrinks to a
            // shimmering, crunchy mess as it rotates away from the camera.
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.anisotropy = maxAnisotropy;
            mat.map = tex;
            mat.needsUpdate = true;
            entry.tex = tex;
            entry.ready = true;
          },
          undefined,
          () => {
            const tex = makeMonogramTexture(n.name, n.id);
            mat.map = tex;
            mat.needsUpdate = true;
            entry.tex = tex;
            entry.ready = true;
            // Fell back to a disc, whatever tier was asked for.
            entry.glowGain = OPAQUE_GLOW_GAIN;
          },
        );
      } else {
        // No art at all: the monogram is generated locally, so it's ready at once.
        const tex = makeMonogramTexture(n.name, n.id);
        mat.map = tex;
        entry.tex = tex;
        entry.ready = true;
      }
      return entry;
    };

    const retire = (p: Placed) => {
      world.remove(p.sprite);
      world.remove(p.glow);
      p.mat.dispose();
      p.glowMat.dispose();
      p.tex?.dispose();
    };

    // ── Edges: drawn on demand, never as a resting state ─────────────────────
    //
    // Where a head SITS says what it is to the subject, so drawing the subject's
    // own ties would restate the layout in lines — the single biggest source of
    // visual noise on the old scene, and the reason it read as a hairball. What
    // position can't express is how the cast relates to *each other*, so the
    // lines are reserved for exactly that: focus a head and its own connections
    // light up across the clusters, which is new information, not decoration.
    //
    // Only the lit segments are ever WRITTEN into the buffer, and the draw range
    // is set to exactly how many there are. The first attempt hid a segment by
    // multiplying its colour to black, on the reasoning that black adds nothing
    // under additive blending — and the whole 257-edge web stayed on screen with
    // nothing focused. Not drawing a line is unambiguous in a way that drawing
    // an invisible one is not, so the state is carried by geometry, not colour.
    type Seg = { a: string; b: string; rgb: [number, number, number] };
    let segs: Seg[] = [];
    let lines: THREE.LineSegments | null = null;
    let posAttr: THREE.Float32BufferAttribute | null = null;
    let colAttr: THREE.Float32BufferAttribute | null = null;

    const buildLines = (es: UniverseEdge[]) => {
      if (lines) {
        world.remove(lines);
        lines.geometry.dispose();
      }
      segs = es.map((e) => {
        const [r, g, b] = (KIND_RGB[e.kind] ?? '162,161,155').split(',').map(Number);
        return { a: e.from, b: e.to, rgb: [r / 255, g / 255, b / 255] as [number, number, number] };
      });
      if (segs.length === 0) {
        lines = null;
        posAttr = null;
        colAttr = null;
        return;
      }
      const geo = new THREE.BufferGeometry();
      posAttr = new THREE.Float32BufferAttribute(new Float32Array(segs.length * 6), 3);
      colAttr = new THREE.Float32BufferAttribute(new Float32Array(segs.length * 6), 3);
      geo.setAttribute('position', posAttr);
      geo.setAttribute('color', colAttr);
      geo.setDrawRange(0, 0);
      const mat = track(
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      lines = new THREE.LineSegments(geo, mat);
      lines.renderOrder = -1;
      lines.visible = false;
      // The bounding sphere is computed from a buffer that's mostly unwritten
      // zeros, so leaving culling on can drop the lines entirely.
      lines.frustumCulled = false;
      world.add(lines);
    };

    /**
     * Draw only the segments touching `id`; pass null to draw none at all.
     *
     * Endpoints are read from the sprites' LIVE positions rather than from a
     * snapshot, so lines stay attached to heads that are still easing towards
     * their new slots after a change of universe.
     */
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
        const A = placed.get(s.a)?.sprite.position;
        const B = placed.get(s.b)?.sprite.position;
        if (!A || !B) continue;
        // Wind each segment so the focused character is always the first
        // vertex, which lets the gradient read as reaching out FROM them.
        const fromFocus = s.a === id;
        const F = fromFocus ? A : B;
        const T = fromFocus ? B : A;
        const o = n * 6;
        p[o] = F.x;
        p[o + 1] = F.y;
        p[o + 2] = F.z;
        p[o + 3] = T.x;
        p[o + 4] = T.y;
        p[o + 5] = T.z;
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
    let chips: { cluster: Cluster; el: HTMLDivElement; w: number; h: number }[] = [];
    const buildChips = (clusters: Cluster[]) => {
      for (const { el } of chips) el.remove();
      chips = clusters.map((c) => {
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
    };

    // ── Applying a cast ──────────────────────────────────────────────────────
    let lastLead: string | null | undefined;

    const applyData = (ns: UniverseNode[], es: UniverseEdge[], sid: string) => {
      if (ns.length === 0) return;
      // Ignore a cast that doesn't belong to this subject.
      //
      // `subjectId` changes the instant you travel, but the new cast is a
      // fetch behind it, so this runs once with the OLD cast under the NEW
      // subject's name. Acting on that pairing broke the transition in three
      // ways at once: the travel state was cleared a frame after it started
      // (because the id matched), the previous subject had no position in the
      // new layout and so was retired mid-flight, and every node resolved its
      // tie against the wrong edge list and collapsed into one "ally" blob.
      // Waiting is the entire fix — the old universe stays up and animating
      // until the real one lands.
      const subject = ns.find((n) => n.is_subject);
      if (!subject || subject.id !== sid) return;
      const { positions, clusters, radius } = factionLayout(ns);
      positions.set(sid, new THREE.Vector3(0, 0, 0));
      state.subjectId = sid;
      state.ringRadius = radius;
      baseDistance = fitDistance(camera.aspect);

      // The destination's own cast has landed. Stop pinning them to the centre
      // and let the crowd come back up — the pan target falls to zero and their
      // new position IS the origin, so the two agree and nothing jumps.
      if (state.travelId === sid) {
        state.travelId = null;
        state.dollyTarget = 1;
        state.crowdTarget = 1;
      }
      // Hover naming and connection lines stay out of the way until the new
      // arrangement has stopped moving. Both point AT a head, and pointing at
      // one that's still travelling — with a line that stretches as it goes —
      // reads as glitching rather than as information.
      state.settleUntil = performance.now() + 620;

      const seen = new Set<string>();
      for (const n of ns) {
        const pos = positions.get(n.id);
        if (!pos) continue;
        seen.add(n.id);
        const existing = placed.get(n.id);
        if (existing) {
          // Already on screen: keep the head, just retarget it. This is the
          // whole point — a character in both universes walks to their new
          // place instead of blinking out and back.
          existing.node = n;
          existing.target.copy(pos);
          existing.targetBase = scaleFor(n);
          existing.targetAlpha = 1;
          existing.colour = colourFor(n);
        } else {
          placed.set(n.id, spawn(n, pos));
        }
      }
      for (const [id, p] of placed) {
        if (seen.has(id)) continue;
        // Not in this universe: shrink away, and get disposed once invisible.
        p.targetAlpha = 0;
        p.targetBase = p.base * 0.35;
      }
      reindex();

      state.clusters = clusters;
      // A cursor left on someone who isn't in this universe any more would be
      // pointing at nothing; start the new one on its first nemesis instead.
      if (state.kbId && !seen.has(state.kbId)) state.kbId = null;

      buildLines(es);
      lastLead = undefined; // force the next frame to re-light
      buildChips(clusters);
      buildScreenReaderList(clusters, subject.name);
    };
    applyRef.current = applyData;

    /**
     * The scene, said in words.
     *
     * Everything above this point is pixels in a canvas: there is no tab order,
     * no roles, and nothing for a screen reader to read — the entire feature was
     * invisible to assistive tech and unusable without a mouse. This mirrors the
     * same cast, in the same groups and the same order, as real buttons.
     *
     * They sit at tabIndex -1 on purpose. Visually-hidden controls in the tab
     * order strand sighted keyboard users on things they cannot see; a screen
     * reader still reaches these in browse mode and can activate them, while
     * sighted keyboard users drive the canvas itself with the arrow keys.
     */
    const srLayer = srLayerRef.current;
    const buildScreenReaderList = (clusters: Cluster[], subjectName: string) => {
      if (!srLayer) return;
      srLayer.replaceChildren();
      const heading = document.createElement('h2');
      heading.textContent = `${subjectName}'s universe`;
      srLayer.appendChild(heading);
      for (const c of clusters) {
        const group = document.createElement('section');
        const title = document.createElement('h3');
        title.textContent = `${c.label} (${c.count})`;
        group.appendChild(title);
        const list = document.createElement('ul');
        c.ids.forEach((id, i) => {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.tabIndex = -1;
          btn.textContent = `${c.names[i]} — ${c.label}`;
          btn.onclick = () => void selectRef.current?.(id);
          li.appendChild(btn);
          list.appendChild(li);
        });
        group.appendChild(list);
        srLayer.appendChild(group);
      }
    };

    /** Flat reading order across the clusters, matching how they're drawn. */
    const kbOrder = (): string[] => state.clusters.flatMap((c) => c.ids);

    const moveCursor = (delta: number) => {
      const order = kbOrder();
      if (order.length === 0) return;
      const at = state.kbId ? order.indexOf(state.kbId) : -1;
      const next =
        at < 0 ? (delta > 0 ? 0 : order.length - 1) : (at + delta + order.length) % order.length;
      state.kbId = order[next];
    };

    /** Up/down jump a whole faction, so a 20-strong cluster isn't a 20-key walk. */
    const moveCluster = (delta: number) => {
      const cs = state.clusters;
      if (cs.length === 0) return;
      const at = state.kbId ? cs.findIndex((c) => c.ids.includes(state.kbId as string)) : -1;
      const next = at < 0 ? 0 : (at + delta + cs.length) % cs.length;
      state.kbId = cs[next].ids[0] ?? null;
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      switch (ev.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          moveCursor(ev.key === 'ArrowDown' ? 1 : 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          moveCursor(-1);
          break;
        case 'PageDown':
          moveCluster(1);
          break;
        case 'PageUp':
          moveCluster(-1);
          break;
        case 'Enter':
        case ' ':
          if (!state.kbId) return;
          // Enter opens the dossier; shift-Enter travels, mirroring the
          // click / double-click pair rather than inventing a third gesture.
          if (ev.shiftKey) startTravel(state.kbId);
          else void selectRef.current?.(state.kbId);
          break;
        case 'Escape':
          state.kbId = null;
          void selectRef.current?.('');
          break;
        default:
          return;
      }
      // Only reached when a key was handled — arrows must not scroll the page.
      ev.preventDefault();
    };

    // ── Interaction ──────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: string | null = null;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
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

    /**
     * Begin travelling to another character.
     *
     * The destination is pinned to the centre of the frame and grows to subject
     * size while the rest of the cast recedes, the camera eases back, and the
     * world spins up — so the move reads as the universe turning to put them at
     * its centre. None of it is on a fixed timeline: the state simply holds
     * until their cast arrives, which makes it immune to how long the fetch
     * takes. Whether the data lands in 50ms or 800ms, the same thing is true at
     * the join — the destination is centred and large in both the old scene and
     * the new one, so there is no cut to hide.
     */
    const startTravel = (id: string) => {
      if (state.travelId === id) return;
      state.travelId = id;
      const p = placed.get(id);
      if (p) {
        p.targetBase = SUBJECT_SCALE;
        p.colour = new THREE.Color(`rgb(${SUBJECT_RGB})`);
      }
      state.dollyTarget = reduced ? 1 : 1.17;
      state.crowdTarget = reduced ? 1 : 0.22;
      setLabel(null);
      void recenterRef.current?.(id);
    };

    // Touch needs its own handling: phones have no hover, and without a pinch
    // there is no way to zoom out of a system that doesn't fit. Tracking every
    // active pointer lets one finger orbit and two fingers pinch, from the same
    // events desktop already uses.
    const active = new Map<number, { x: number; y: number }>();
    let pinchStart: { dist: number; zoom: number } | null = null;
    let movedWhilePressed = 0;
    let lastTap = { id: '', at: 0 };

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
        if (!id) return;
        // Touch has no dblclick event, so travel is a double TAP on the same
        // head — otherwise the only way to move through the graph is a control
        // that exists on desktop and nowhere else.
        const now = performance.now();
        if (lastTap.id === id && now - lastTap.at < 400 && id !== state.subjectId) {
          lastTap = { id: '', at: 0 };
          startTravel(id);
          return;
        }
        lastTap = { id, at: now };
        void selectRef.current?.(id);
      }
    };
    const onLeave = () => {
      pointerInside = false;
      setLabel(null);
    };
    const pick = (): string | null => {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(sprites, false);
      return (hits[0]?.object.userData.id as string) ?? null;
    };

    const onClick = () => {
      const id = hovered ?? pick();
      if (id) void selectRef.current?.(id);
    };
    // Double-click travels: that character becomes the new centre of the universe.
    const onDoubleClick = () => {
      if (hovered && hovered !== state.subjectId) startTravel(hovered);
    };

    const el = renderer.domElement;
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('click', onClick);
    el.addEventListener('dblclick', onDoubleClick);
    el.addEventListener('keydown', onKeyDown);

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
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    window.addEventListener('resize', resize);

    // ── Loop ─────────────────────────────────────────────────────────────────
    let raf = 0;
    const clock = new THREE.Clock();
    let elapsed = 0;
    let entrance = reduced ? 1 : 0;
    const rotM = new THREE.Matrix4();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      // Clamped so a backgrounded tab doesn't return and snap everything to its
      // target in a single enormous step.
      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      // Frame-rate independent smoothing: the fraction of the remaining
      // distance to close this frame, not a fixed per-frame step.
      const k = reduced ? 1 : 1 - Math.exp(-dt * 7.5);
      if (entrance < 1) entrance = Math.min(1, entrance + dt * 1.5);
      const ease = 1 - Math.pow(1 - entrance, 3);

      // While travelling, the destination is pinned to the centre of the frame.
      // Recomputed every frame from its live position and the live rotation, so
      // the world can keep turning and drifting underneath it and the character
      // you are moving towards simply stays put — which is what sells it as the
      // universe rearranging itself around them.
      if (state.travelId) {
        const p = placed.get(state.travelId);
        if (p) {
          rotM.makeRotationFromEuler(world.rotation);
          const wp = p.sprite.position.clone().applyMatrix4(rotM);
          state.panTarget.set(-wp.x, -wp.y, -wp.z);
        }
      } else {
        // Half the frame's world height at the current distance, so the lift is
        // the same proportion of the screen whatever the viewport or zoom.
        const halfH = camera.position.z * Math.tan((FOV * Math.PI) / 360);
        state.panTarget.set(0, (liftRef.current ?? 0) * halfH, 0);
      }
      world.position.lerp(state.panTarget, k);
      state.dolly += (state.dollyTarget - state.dolly) * k;
      state.crowd += (state.crowdTarget - state.crowd) * k;

      // Distance is always the fitted distance for this viewport, scaled by the
      // user's pinch — so the system frames correctly on any screen shape.
      camera.position.z = baseDistance * zoom * state.dolly;
      camera.lookAt(0, 0, 0);

      // Idle drift stops while you're driving, and eases back afterwards. It
      // accelerates hard during travel and decays back down on arrival, which
      // gives the move a sense of momentum without ever snapping.
      const spinCap = !reduced && state.travelId ? 0.0055 : 0.0009;
      if (dragging) spinVel = 0;
      else if (spinVel < spinCap) spinVel = Math.min(spinCap, spinVel + dt * 0.024);
      else spinVel = Math.max(spinCap, spinVel - dt * 0.007);
      if (!dragging && !reduced) yaw += spinVel;
      world.rotation.y = yaw;
      world.rotation.x = pitch;

      const busy = state.travelId !== null || performance.now() < state.settleUntil;

      // Hover test
      if (pointerInside && !dragging) {
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(sprites, false);
        const id = (hits[0]?.object.userData.id as string) ?? null;
        if (id !== hovered) {
          hovered = id;
          el.style.cursor = id ? 'pointer' : 'grab';
        }
      }

      // The name follows the mouse OR the keyboard cursor — the two are the
      // same affordance reached by different means, so they get the same label.
      const namedId = hovered ?? state.kbId;
      const hit = namedId ? placed.get(namedId) : null;
      if (hit && !busy) {
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

      // Lines follow whichever head is being pointed at or held in focus. The
      // buffer is rewritten every frame while one is lit, because the endpoints
      // are live sprite positions that may still be easing into place.
      const focused = focusRef.current;
      const lead = busy ? null : (hovered ?? state.kbId ?? focused);
      if (lead !== lastLead || lead !== null) {
        lastLead = lead;
        litEdgesFor(lead);
      }

      // Cluster headings track their group in screen space.
      for (const { cluster, el, w, h } of chips) {
        const v = cluster.anchor.clone();
        world.localToWorld(v);
        const depth = v.clone().applyMatrix4(camera.matrixWorldInverse).z;
        // -1 at the nearest point of the ring, +1 at the furthest.
        const t = Math.max(-1, Math.min(1, (-depth - camera.position.z) / state.ringRadius));
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
        // hiding one of the four headings would just lose a group's name. The
        // headings also duck out entirely while travelling, because they name
        // groups that are in the middle of being re-formed.
        const travelFade = state.travelId ? state.crowd : 1;
        el.style.opacity = String(
          (1 - 0.45 * Math.max(0, Math.min(1, (t + 1) / 2))) * ease * travelFade,
        );
      }

      const gone: string[] = [];
      for (const p of placed.values()) {
        p.sprite.position.lerp(p.target, k);
        p.glow.position.copy(p.sprite.position);
        p.base += (p.targetBase - p.base) * k;
        p.alpha += (p.targetAlpha - p.alpha) * k;
        p.glowMat.color.lerp(p.colour, k);
        if (p.targetAlpha === 0 && p.alpha < 0.02) {
          gone.push(p.node.id);
          continue;
        }

        const isDestination = state.travelId === p.node.id;
        const active = p.node.id === hovered || p.node.id === focused || p.node.id === state.kbId;
        const lift = active && !state.travelId ? 1.18 : 1;
        // A slow per-node bob, phase-shifted by id, so the field breathes
        // instead of sitting rigid.
        const bob =
          p.node.is_subject || reduced
            ? 1
            : 1 + Math.sin(elapsed * 0.7 + hash01(p.node.id) * 9) * 0.03;
        const s = p.base * lift * bob * ease;
        p.sprite.scale.setScalar(s);
        p.glow.scale.setScalar(s * GLOW_SCALE);
        // Everyone except the character being travelled to recedes, so the
        // destination is unmistakably the thing the move is about.
        const crowd = isDestination ? 1 : state.crowd;
        p.glowMat.opacity =
          (p.node.is_subject || isDestination ? 0.5 : 0.26) *
          p.glowGain *
          ease *
          p.alpha *
          crowd *
          (active ? 2.4 : 1);
        // Fade the head in once its texture exists. Multiplying by `fade` means
        // a head is never drawn as the blank white square of an unmapped
        // material.
        p.fade = Math.min(1, p.fade + (p.ready ? dt * 4 : 0));
        // A gentle recede, not a blackout. At 0.28 the other 23 heads read as
        // half-loaded rather than as context, which made the whole scene look
        // broken the moment anything was selected; the lit head's own lift and
        // halo carry the emphasis instead.
        const dim = focused && !active && !p.node.is_subject && !state.travelId ? 0.62 : 1;
        p.mat.opacity = p.fade * p.alpha * dim * crowd;
      }
      if (gone.length) {
        for (const id of gone) {
          const p = placed.get(id);
          if (p) retire(p);
          placed.delete(id);
        }
        reindex();
      }

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      applyRef.current = null;
      ro.disconnect();
      window.removeEventListener('resize', resize);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('click', onClick);
      el.removeEventListener('dblclick', onDoubleClick);
      el.removeEventListener('keydown', onKeyDown);
      for (const { el: chip } of chips) chip.remove();
      for (const p of placed.values()) retire(p);
      placed.clear();
      lines?.geometry.dispose();
      for (const d of disposables) d.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
    };
    // Set up ONCE. New casts arrive through applyRef below, so that travelling
    // to another character morphs the scene instead of replacing it.
  }, []);

  useEffect(() => {
    applyRef.current?.(nodes, edges, subjectId);
  }, [nodes, edges, subjectId]);

  return (
    /* `top/left` + `100lvh`, never `inset: 0`: a fixed element pins to the
       layout viewport, which stops at the iOS Safari toolbar, so the scene
       ended at the toolbar instead of running under its glass like every other
       page. Same fix as the boot loader and the landing splash. */
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100lvh' }}>
      <div ref={mountRef} style={{ width: '100vw', height: '100lvh' }} />
      {/* The cast as real markup for assistive tech — visually hidden, but the
          only reason this feature exists for a screen reader at all. */}
      <div
        ref={srLayerRef}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
        }}
      />
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
