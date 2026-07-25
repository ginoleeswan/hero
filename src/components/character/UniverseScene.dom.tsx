'use dom';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

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
  kind: 'enemy' | 'ally' | 'teammate' | null;
}

export interface UniverseEdge {
  from: string;
  to: string;
  kind: 'enemy' | 'ally' | 'teammate';
}

const KIND_RGB: Record<string, string> = {
  enemy: '181,48,43',
  ally: '99,169,54',
  teammate: '21,161,171',
};

// Relationship sets the shell a character sits on — closer bond, tighter orbit.
// This is the 2D orbital idea that failed on rings: Supergirl's 22 teammates
// couldn't fit one circle without overlapping into a blob. A sphere's surface
// grows with the square of its radius, so the same 22 spread out comfortably.
const KIND_RADIUS: Record<string, number> = {
  teammate: 2.05,
  ally: 2.5,
  enemy: 3.05,
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

/**
 * Place every node on its relationship shell using a Fibonacci sphere, which
 * distributes points near-evenly over a sphere with no clustering at the poles.
 * Each shell is rotated by a hash of the subject id so the universes of two
 * characters don't look like the same constellation.
 */
function shellPositions(nodes: UniverseNode[], subjectId: string): Map<string, THREE.Vector3> {
  const out = new Map<string, THREE.Vector3>();
  const byKind = new Map<string, UniverseNode[]>();
  for (const n of nodes) {
    if (n.is_subject) continue;
    const k = n.kind ?? 'enemy';
    byKind.set(k, [...(byKind.get(k) ?? []), n]);
  }

  for (const [kind, members] of byKind) {
    const radius = KIND_RADIUS[kind] ?? 2.5;
    const count = members.length;
    const offset = hash01(subjectId + kind) * Math.PI * 2;
    const golden = Math.PI * (3 - Math.sqrt(5));

    members.forEach((n, i) => {
      // Squash the shell vertically: a full sphere puts characters directly
      // behind the subject where they're unreadable, while an oblate shell keeps
      // everyone nearer the equator and so nearer the camera.
      const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i + offset;
      out.set(
        n.id,
        new THREE.Vector3(
          Math.cos(theta) * r * radius,
          y * radius * 0.55,
          Math.sin(theta) * r * radius,
        ),
      );
    });
  }
  return out;
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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.set(0, 0.6, 7.4);

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

    const positions = shellPositions(nodes, subjectId);
    positions.set(subjectId, new THREE.Vector3(0, 0, 0));

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
      const scale = n.is_subject ? 1.5 : 0.62 + 0.5 * fame;

      const glowMat = track(
        new THREE.SpriteMaterial({
          map: glowTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          color: new THREE.Color(
            `rgb(${n.is_subject ? '224,163,53' : (KIND_RGB[n.kind ?? 'enemy'] ?? '162,161,155')})`,
          ),
          opacity: n.is_subject ? 0.85 : 0.55,
        }),
      );
      const glow = new THREE.Sprite(glowMat);
      glow.position.copy(pos);
      glow.scale.setScalar(scale * 2.1);
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

    // ── Edges: only the subject's own ties ───────────────────────────────────
    // Everything else is neighbour-to-neighbour trivia that turns the field into
    // a hairball — the same call the 2D version makes, and it matters more here
    // because crossing lines in perspective read as noise from every angle.
    const linePts: number[] = [];
    const lineCols: number[] = [];
    for (const e of edges) {
      if (e.from !== subjectId && e.to !== subjectId) continue;
      const a = positions.get(e.from);
      const b = positions.get(e.to);
      if (!a || !b) continue;
      const [r, g, bl] = (KIND_RGB[e.kind] ?? '162,161,155').split(',').map(Number);
      // Fade along the line so it emerges from the subject rather than tying two
      // objects together with a hard stroke.
      linePts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      lineCols.push((r / 255) * 0.15, (g / 255) * 0.15, (bl / 255) * 0.15);
      lineCols.push(r / 255, g / 255, bl / 255);
    }
    if (linePts.length) {
      const lineGeo = track(new THREE.BufferGeometry());
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
      lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineCols, 3));
      const lineMat = track(
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      lines.renderOrder = -1;
      world.add(lines);
    }

    // ── Interaction ──────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: string | null = null;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let spinVel = 0.0016;
    let yaw = 0;
    let pitch = 0;
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

    const onPointerMove = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      pointerInside = true;
      if (dragging) {
        yaw += (ev.clientX - lastX) * 0.005;
        pitch = Math.max(-0.5, Math.min(0.5, pitch + (ev.clientY - lastY) * 0.003));
        lastX = ev.clientX;
        lastY = ev.clientY;
      }
    };
    const onPointerDown = (ev: PointerEvent) => {
      dragging = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onPointerUp = () => {
      dragging = false;
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    };
    const onLeave = () => {
      pointerInside = false;
      setLabel(null);
    };
    const onClick = () => {
      if (hovered) void selectRef.current?.(hovered);
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
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    window.addEventListener('resize', resize);

    // ── Loop ─────────────────────────────────────────────────────────────────
    let raf = 0;
    const clock = new THREE.Clock();
    let entrance = reduced ? 1 : 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      if (entrance < 1) entrance = Math.min(1, entrance + 0.02);
      const ease = 1 - Math.pow(1 - entrance, 3);

      // Idle drift stops while you're driving, and eases back afterwards.
      if (!dragging && !reduced) yaw += spinVel;
      spinVel = dragging ? 0 : Math.min(0.0016, spinVel + 0.00004);
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

      const focused = focusRef.current;
      for (const p of placed) {
        const active = p.node.id === hovered || p.node.id === focused;
        const lift = active ? 1.18 : 1;
        // A slow per-node bob, phase-shifted by id, so the field breathes
        // instead of sitting rigid.
        const bob = p.node.is_subject || reduced ? 1 : 1 + Math.sin(t * 0.7 + hash01(p.node.id) * 9) * 0.03;
        const s = p.base * lift * bob * ease;
        p.sprite.scale.setScalar(s);
        p.glow.scale.setScalar(s * 2.1);
        (p.glow.material as THREE.SpriteMaterial).opacity =
          (p.node.is_subject ? 0.85 : 0.5) * ease * (active ? 1.6 : 1);
        // Fade the head in once its texture exists, and dim everything unrelated
        // while one character holds focus. Multiplying by `fade` means a head is
        // never drawn as the blank white square of an unmapped material.
        p.fade = Math.min(1, p.fade + (p.ready ? 0.06 : 0));
        const dim = focused && !active && !p.node.is_subject ? 0.28 : 1;
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
      el.removeEventListener('click', onClick);
      el.removeEventListener('dblclick', onDoubleClick);
      for (const d of disposables) d.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, [nodes, edges, subjectId]);

  return (
    <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }}>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
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
