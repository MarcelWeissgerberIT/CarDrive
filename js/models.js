// GLB model loading (generated with Higgsfield image-to-3D from the OpenArt artwork), normalised + toon shaded
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toonMat, gradientMap } from './cars3d.js';

// size = target length (cars, along the driving axis) or height (decor)
export const MODEL_DEFS = {
  car_bubble: { url: 'assets/models/car_bubble.glb', length: 3.8 },
  car_cane: { url: 'assets/models/car_cane.glb', length: 4.4 },
  car_jelly: { url: 'assets/models/car_jelly.glb', length: 4.3 },
  car_lolly: { url: 'assets/models/car_lolly.glb', length: 4.6 },
  car_gummy: { url: 'assets/models/car_gummy.glb', length: 4.3 },
  car_rocket: { url: 'assets/models/car_rocket.glb', length: 4.2 },
  deco_lolly: { url: 'assets/models/deco_lolly.glb', height: 9 },
  deco_bear: { url: 'assets/models/deco_bear.glb', height: 5.5 },
  deco_house: { url: 'assets/models/deco_house.glb', height: 7 },
  deco_ice: { url: 'assets/models/deco_ice.glb', height: 7.5 },
  deco_donut: { url: 'assets/models/deco_donut.glb', height: 5 },
  deco_cupcake: { url: 'assets/models/deco_cupcake.glb', height: 5.5 },
  deco_cotton: { url: 'assets/models/deco_cotton.glb', height: 8.5 },
};

const OUTLINE = new THREE.MeshBasicMaterial({ color: '#2a1636', side: THREE.BackSide });

export const Models = {
  cache: {}, promises: {}, loader: new GLTFLoader(), progress: 0,
  load(name) {
    if (this.promises[name]) return this.promises[name];
    const def = MODEL_DEFS[name];
    this.promises[name] = new Promise((resolve) => {
      this.loader.load(def.url, (gltf) => { this.cache[name] = normalise(gltf.scene, def); resolve(this.cache[name]); },
        undefined, (err) => { console.warn('model failed', name, err); resolve(null); });
    });
    return this.promises[name];
  },
  preload(names, onProgress) {
    let done = 0; const all = names.map(n => this.load(n).then(() => { done++; this.progress = done / names.length; onProgress?.(this.progress); }));
    return Promise.all(all);
  },
  has(name) { return !!this.cache[name]; },
  // returns a fresh instance (shared geometry + materials) or null when not loaded
  get(name, { outline = true } = {}) {
    const src = this.cache[name]; if (!src) return null;
    const g = new THREE.Group();
    const inst = src.clone(); g.add(inst);
    if (outline) { const hull = src.clone(); hull.traverse(o => { if (o.isMesh) o.material = OUTLINE; }); hull.scale.multiplyScalar(1.035); g.add(hull); }
    g.userData.model = name;
    return g;
  },
};

function normalise(scene, def) {
  const grad = gradientMap();
  scene.traverse(o => {
    if (o.isMesh) {
      const old = o.material; const m = toonMat('#ffffff');
      if (old.map) { m.map = old.map; m.map.colorSpace = THREE.SRGBColorSpace; }
      if (old.color) m.color.copy(old.color);
      m.gradientMap = grad; o.material = m; o.castShadow = false; o.receiveShadow = false;
    }
  });
  const box = new THREE.Box3().setFromObject(scene); const size = new THREE.Vector3(); box.getSize(size);
  // cars: longest horizontal axis becomes the driving axis (z), front towards -z
  const g = new THREE.Group(); g.add(scene);
  if (def.length) {
    scene.rotation.y = (size.x > size.z ? Math.PI / 2 : 0) + Math.PI; // front towards -z
    const b2 = new THREE.Box3().setFromObject(g); const s2 = new THREE.Vector3(); b2.getSize(s2);
    const k = def.length / s2.z; g.scale.setScalar(k);
  } else {
    g.scale.setScalar(def.height / size.y);
  }
  const b3 = new THREE.Box3().setFromObject(g); const c = new THREE.Vector3(); b3.getCenter(c);
  scene.position.x -= c.x / g.scale.x; scene.position.z -= c.z / g.scale.z; scene.position.y -= b3.min.y / g.scale.y;
  const wrap = new THREE.Group(); wrap.add(g); wrap.userData.size = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
  return wrap;
}
