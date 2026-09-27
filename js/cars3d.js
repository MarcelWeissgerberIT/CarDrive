// Procedural chunky "toy" car models built from primitives
import * as THREE from 'three';

const geoCache = {};
function box(w, h, d) { const k = `b${w},${h},${d}`; return geoCache[k] || (geoCache[k] = new THREE.BoxGeometry(w, h, d)); }
function cyl(r, h, s = 16) { const k = `c${r},${h},${s}`; return geoCache[k] || (geoCache[k] = new THREE.CylinderGeometry(r, r, h, s)); }
function sph(r, s = 12) { const k = `s${r},${s}`; return geoCache[k] || (geoCache[k] = new THREE.SphereGeometry(r, s, s)); }

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.45, metalness: opts.metal ?? 0.05, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.ei ?? 1, transparent: !!opts.opacity, opacity: opts.opacity ?? 1 });
}

const DIM = {
  beetle: { w: 2.0, h: 0.8, l: 3.6, cab: [1.7, 0.7, 1.9], cabZ: 0.1, wheelR: 0.42, wheelZ: 1.2 },
  muscle: { w: 2.2, h: 0.7, l: 4.4, cab: [1.8, 0.6, 1.8], cabZ: 0.4, wheelR: 0.42, wheelZ: 1.5, spoiler: true },
  sport: { w: 2.1, h: 0.55, l: 4.3, cab: [1.7, 0.5, 1.7], cabZ: 0.5, wheelR: 0.4, wheelZ: 1.45, spoiler: true },
  lowrider: { w: 2.2, h: 0.6, l: 4.6, cab: [1.9, 0.55, 2.2], cabZ: 0.2, wheelR: 0.36, wheelZ: 1.6 },
  truck: { w: 2.3, h: 1.0, l: 4.2, cab: [2.0, 0.8, 1.7], cabZ: 0.3, wheelR: 0.62, wheelZ: 1.4, high: 0.5 },
  hover: { w: 2.0, h: 0.6, l: 4.0, cab: [1.6, 0.55, 1.8], cabZ: 0.2, wheelR: 0, wheelZ: 1.3, hover: true },
  traffic: { w: 2.0, h: 0.75, l: 3.8, cab: [1.7, 0.6, 1.8], cabZ: 0.2, wheelR: 0.4, wheelZ: 1.3 },
};

export function buildCar({ body = 'beetle', color = '#ff6fb5', rim = '#d8d8e6', decal = '', glow = false }) {
  const D = DIM[body] || DIM.traffic;
  const g = new THREE.Group();
  const lift = D.high || (D.hover ? 0.45 : 0);
  const bodyMat = mat(color);
  const dark = mat('#2a1d3a', { rough: 0.6 });
  const glass = mat('#9ff2ff', { rough: 0.1, opacity: 0.85 });
  const rimMat = mat(rim, { rough: 0.3, metal: 0.4 });

  const base = new THREE.Mesh(box(D.w, D.h, D.l), bodyMat);
  base.position.y = D.wheelR + D.h / 2 + lift; g.add(base);
  // rounded bumper look
  const bump = new THREE.Mesh(box(D.w * 0.95, D.h * 0.5, D.l * 1.04), mat('#ffffff', { rough: 0.5 }));
  bump.position.y = base.position.y - D.h * 0.2; g.add(bump);
  const cab = new THREE.Mesh(box(...D.cab), bodyMat);
  cab.position.set(0, base.position.y + D.h / 2 + D.cab[1] / 2, D.cabZ); g.add(cab);
  const win = new THREE.Mesh(box(D.cab[0] * 1.02, D.cab[1] * 0.55, D.cab[2] * 1.02), glass);
  win.position.set(0, cab.position.y + D.cab[1] * 0.1, D.cabZ); g.add(win);
  // headlights & taillights (front = -z)
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(sph(0.16), mat('#fff6b0', { emissive: '#ffe680', ei: 0.9 }));
    hl.position.set(s * D.w * 0.36, base.position.y + 0.05, -D.l / 2 - 0.02); g.add(hl);
    const tl = new THREE.Mesh(box(0.34, 0.14, 0.08), mat('#ff2d55', { emissive: '#ff2d55', ei: 0.8 }));
    tl.position.set(s * D.w * 0.34, base.position.y + 0.05, D.l / 2 + 0.03); g.add(tl);
  }
  if (D.spoiler) {
    const sp = new THREE.Mesh(box(D.w * 0.9, 0.08, 0.4), dark);
    sp.position.set(0, base.position.y + D.h / 2 + 0.35, D.l / 2 - 0.25); g.add(sp);
    for (const s of [-1, 1]) { const st = new THREE.Mesh(box(0.08, 0.35, 0.2), dark); st.position.set(s * D.w * 0.38, base.position.y + D.h / 2 + 0.17, D.l / 2 - 0.25); g.add(st); }
  }
  if (D.hover) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 24), mat('#2ef2ff', { emissive: '#2ef2ff', ei: 1.5 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.3, 0); ring.scale.set(1, 1.9, 1); g.add(ring);
  } else {
    const tire = mat('#2a2233', { rough: 0.9 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wg = new THREE.Group();
      const w = new THREE.Mesh(cyl(D.wheelR, 0.42, 14), tire); w.rotation.z = Math.PI / 2; wg.add(w);
      const r = new THREE.Mesh(cyl(D.wheelR * 0.55, 0.46, 8), rimMat); r.rotation.z = Math.PI / 2; wg.add(r);
      wg.position.set(sx * (D.w / 2 + 0.1), D.wheelR, sz * D.wheelZ); wg.userData.wheel = true; g.add(wg);
    }
  }
  if (decal) {
    const tex = emojiTexture(decal);
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    dm.rotation.x = -Math.PI / 2; dm.position.set(0, base.position.y + D.h / 2 + 0.01, -D.l / 2 + 0.75); g.add(dm);
  }
  if (glow) {
    const gl = new THREE.PointLight(color, 1.2, 8); gl.position.set(0, 0.6, 0); g.add(gl);
  }
  g.userData.length = D.l; g.userData.width = D.w;
  return g;
}

const emojiCache = {};
export function emojiTexture(emoji, size = 128) {
  if (emojiCache[emoji]) return emojiCache[emoji];
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); x.font = `${size * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, size / 2, size / 2 + size * 0.05);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (emojiCache[emoji] = t);
}

export function spinWheels(car, amount) {
  car.children.forEach(c => { if (c.userData.wheel) c.rotation.x -= amount; });
}
