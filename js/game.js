// Core race engine: cockpit-view endless-runner style racing with AI opponents.
// Landscape: rolling candy hills, sky dome + panorama, toon shading, sparkles, GLB props.
import * as THREE from 'three';
import { buildCar, mat, toonMat, spinWheels, emojiTexture } from './cars3d.js';
import { OPPONENTS, POWERUPS } from './data.js';
import { Audio } from './audio.js';
import { Models } from './models.js';

const RW = 6.5;               // road half width
const LANES = [-4, 0, 4];
const SEG_LEN = 12, SEG_COUNT = 30;
const VIEW = SEG_LEN * SEG_COUNT;
const BEND_K = 0.00055;
const TRAFFIC_SPEED = 13;
const GRID_W = 240, GRID_X = 48, GRID_Z = 36, GRID_STEP = 10; // terrain grid
const DECO_MODELS = ['deco_lolly', 'deco_bear', 'deco_house', 'deco_ice', 'deco_donut', 'deco_cupcake', 'deco_cotton'];
const CAR_MODELS = ['car_bubble', 'car_cane', 'car_jelly', 'car_lolly', 'car_gummy', 'car_rocket'];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class RaceGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 900);
    this.scene = null;
    this.running = false; this.paused = false;
    this.steerInput = 0; this.tiltInput = 0;
    this.badgeTex = {};
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w > h ? 72 : 88;
    this.camera.updateProjectionMatrix();
    this.applyAspect();
  }
  applyAspect() {
    const portrait = this.camera.aspect < 1;
    this.pitch = portrait ? -0.16 : -0.07;
    if (this.cockpit) this.cockpit.position.y = portrait ? -0.36 : -0.24;
    const halfW = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.05 * this.camera.aspect;
    if (this.roof) { this.roof.visible = !portrait; this.roof.position.y = 0.80 - this.pitch * 1.05 - this.cockpit.position.y; }
    if (this.pillars) this.pillars.forEach(p => { p.position.x = Math.sign(p.position.x) * (portrait ? 0.95 : Math.max(1.32, halfW * 0.94)); });
  }

  // ---------- setup ----------
  start({ track, car, paint, rim, decal, inventory, cb }) {
    this.track = track; this.car = car; this.cb = cb;
    this.inventory = inventory;
    this.state = 'countdown'; this.countdown = 3.2;
    this.playerDist = 0; this.x = 0; this.speed = 0; this.latVel = 0; this.steer = 0;
    this.curve = 0; this.curveTarget = 0; this.curveTimer = 3;
    this.coins = 0; this.crashes = 0; this.dodged = 0; this.nitroUsed = 0;
    this.stun = 0; this.shake = 0; this.time = 0; this.hudTimer = 0;
    this.effects = { nitro: 0, shield: 0, magnet: 0, slowmo: 0, doubler: 0 };
    if (inventory.doubler > 0) { inventory.doubler--; this.effects.doubler = 1e9; }
    this.finished = false; this.finishTimer = 0; this.place = 4;
    this.spawnDist = 70; this.objs = []; this.pool = {};
    this.buildScene(paint, rim, decal);
    this.running = true; this.paused = false;
    this.last = performance.now();
    Audio.startEngine();
    this.loop = (now) => { if (!this.running) return; this.frame(now); requestAnimationFrame(this.loop); };
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false; Audio.stopEngine();
    if (this.scene) { this.scene.traverse(o => { if (o.geometry && !o.userData.shared && !o.userData.model) o.geometry.dispose?.(); }); this.scene = null; }
  }
  setPaused(p) { this.paused = p; this.last = performance.now(); Audio.setEngine(0, !p); }

  // terrain height in world coords (u = lateral offset from road centre, wz = distance along the track)
  hill(u, wz) {
    const d = Math.abs(u) - (RW + 3.5); if (d <= 0) return 0;
    const t = Math.min(1, d / 24);
    const n = 2.4 + 2.0 * Math.sin(u * 0.09 + wz * 0.021) + 1.7 * Math.sin(wz * 0.043 - u * 0.05) + 0.9 * Math.sin(u * 0.23 + wz * 0.11);
    return t * t * Math.max(0.3, n) * (this.track.hills ?? 1);
  }

  buildScene(paint, rim, decal) {
    const T = this.track; const night = !!T.night;
    const s = this.scene = new THREE.Scene();
    s.fog = new THREE.Fog(T.fog, 140, VIEW + 20);
    s.add(new THREE.HemisphereLight(T.sky, T.ground, night ? 0.6 : 1.0));
    const dir = new THREE.DirectionalLight('#fff4e0', night ? 0.5 : 1.15); dir.position.set(40, 70, 30); s.add(dir);
    s.add(new THREE.AmbientLight('#ffffff', night ? 0.3 : 0.4));

    // sky dome (gradient) + candy-hill panorama, both unaffected by fog
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(T.skyTop || T.sky) }, mid: { value: new THREE.Color(T.sky) }, bottom: { value: new THREE.Color(T.fog) } },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bottom; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h < 0.0 ? bottom : (h < 0.25 ? mix(bottom, mid, h/0.25) : mix(mid, top, min(1.0,(h-0.25)/0.6))); gl_FragColor = vec4(c,1.0); }' });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 12), skyMat); sky.renderOrder = -10; s.add(sky);
    const pano = new THREE.Mesh(new THREE.CylinderGeometry(560, 560, 150, 48, 1, true), new THREE.MeshBasicMaterial({ map: panoramaTexture(T), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    pano.position.y = 40; pano.renderOrder = -9; s.add(pano);

    // terrain grid with rolling hills, vertex colours + sprinkle texture
    const gt = sprinkleTexture(T.ground, night); gt.repeat.set(1, 1); this.groundTex = gt;
    const nx = GRID_X + 1, nz = GRID_Z + 1;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3));
    tg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nx * nz * 2), 2));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3));
    const tidx = [];
    for (let z = 0; z < GRID_Z; z++) for (let x = 0; x < GRID_X; x++) { const a = z * nx + x; tidx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx); }
    tg.setIndex(tidx);
    this.terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ map: gt, vertexColors: true }));
    this.terrain.frustumCulled = false; s.add(this.terrain);
    this.groundCol = new THREE.Color(T.ground); this.hillCol = new THREE.Color(T.hillTop || '#ffb3e0'); this.tmpCol = new THREE.Color();

    // road ribbon + candy curbs
    const n = SEG_COUNT + 1;
    const mkRibbon = (tex, w) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2 * 2), 2));
      const nrm = new Float32Array(n * 2 * 3); for (let i = 0; i < n * 2; i++) nrm[i * 3 + 1] = 1;
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      const idx = []; for (let i = 0; i < SEG_COUNT; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshToonMaterial({ map: tex })); m.frustumCulled = false; m.userData.w = w; s.add(m); return m;
    };
    this.road = mkRibbon(roadTexture(T.road, T.edge, night), RW);
    const curbTex = stripeTexture(T.edge, '#ffffff'); curbTex.repeat.set(1, 1);
    this.curbL = mkRibbon(curbTex, 0.7); this.curbR = mkRibbon(curbTex, 0.7);

    // sky decorations
    this.clouds = [];
    if (!night) {
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), fog: false, depthWrite: false }));
      sun.scale.set(70, 70, 1); sun.position.set(110, 120, -520); s.add(sun);
      const ct = cloudTexture();
      for (let i = 0; i < 10; i++) {
        const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, transparent: true, depthWrite: false }));
        const sc = rnd(36, 70); c.scale.set(sc, sc * 0.55, 1);
        c.position.set(rnd(-320, 320), rnd(50, 140), -rnd(470, 540)); c.userData.v = rnd(0.6, 1.8); s.add(c); this.clouds.push(c);
      }
    } else {
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture('#fff6c8', '#e6dcff'), fog: false, depthWrite: false }));
      moon.scale.set(50, 50, 1); moon.position.set(-100, 130, -520); s.add(moon);
      const sg = new THREE.BufferGeometry(); const sp = [];
      for (let i = 0; i < 400; i++) sp.push(rnd(-500, 500), rnd(40, 320), -rnd(480, 560));
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.4, fog: false })));
      const hl = new THREE.PointLight('#fff2c0', 3, 80); hl.position.set(0, 1.5, -8); this.camera.add(hl);
    }

    // magic sparkles drifting past
    const spg = new THREE.BufferGeometry(); const spp = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) { spp[i * 3] = rnd(-45, 45); spp[i * 3 + 1] = rnd(0.5, 16); spp[i * 3 + 2] = -rnd(0, 180); }
    spg.setAttribute('position', new THREE.BufferAttribute(spp, 3));
    this.sparkles = new THREE.Points(spg, new THREE.PointsMaterial({ map: glowTexture(), color: night ? '#9ff6ff' : '#fff6c0', size: 0.7, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparkles.frustumCulled = false; s.add(this.sparkles);

    // roadside decor (GLB props when loaded, procedural fallback)
    this.decos = [];
    for (let i = 0; i < 44; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const d = this.makeDecoInstance(night);
      d.userData.side = side; d.userData.dist = Math.floor(i / 2) * 15 + rnd(-4, 4);
      d.userData.off = i % 4 < 2 ? rnd(2.5, 7) : rnd(9, 26); d.rotation.y = rnd(-0.6, 0.6) + (side < 0 ? 0.6 : -0.6);
      s.add(d); this.decos.push(d);
    }

    // cockpit (attached to camera)
    this.camera.position.set(0, 1.55, 0); this.camera.rotation.set(0, 0, 0);
    while (this.camera.children.length > (night ? 1 : 0)) this.camera.remove(this.camera.children[this.camera.children.length - 1]);
    const cp = this.cockpit = new THREE.Group();
    const pm = mat(paint); const dash = mat('#2b1b3f'); const trim = mat('#ff5fb3');
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 2.8), pm); hood.position.set(0, -0.74, -2.6); hood.rotation.x = -0.09; cp.add(hood);
    const hoodLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 2.6), mat('#ffffff')); hoodLine.position.set(0, -0.74, -2.6); hoodLine.rotation.x = -0.09; cp.add(hoodLine);
    for (const sx of [-1, 1]) { const fd = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 2.2), pm); fd.position.set(sx * 1.3, -0.78, -2.9); fd.rotation.x = -0.09; cp.add(fd); }
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.7), dash); d1.position.set(0, -0.8, -1.0); cp.add(d1);
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 0.74), trim); d2.position.set(0, -0.54, -1.0); cp.add(d2);
    this.pillars = [];
    for (const sx of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.12), dash); pil.position.set(sx * 1.32, 0.3, -1.05); pil.rotation.z = sx * 0.12; cp.add(pil); this.pillars.push(pil);
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.12), pm); mir.position.set(sx * 1.42, -0.32, -1.25); cp.add(mir);
    }
    this.roof = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.5), dash); this.roof.position.set(0, 0.78, -1.05); cp.add(this.roof);
    if (decal) {
      const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: emojiTexture(decal), transparent: true }));
      dm.rotation.x = -Math.PI / 2 - 0.09; dm.position.set(0, -0.6, -2.3); cp.add(dm);
    }
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), new THREE.MeshBasicMaterial({ color: '#7ff4ff', transparent: true, opacity: 0.18, side: THREE.BackSide }));
    this.shieldMesh.position.set(0, -0.3, -1.5); this.shieldMesh.visible = false; cp.add(this.shieldMesh);
    this.camera.add(cp); s.add(this.camera);
    this.applyAspect();

    // AI opponents (each drives a real car model)
    const aiCars = ['car_gummy', 'car_lolly', 'car_rocket'];
    this.ais = OPPONENTS.map((o, i) => {
      const mesh = this.carInstance(aiCars[i], o.color, night);
      s.add(mesh);
      return { def: o, mesh, dist: 8 + i * 7, x: LANES[[0, 2, 1][i]], lane: [0, 2, 1][i], speed: 0, finished: false, wobble: rnd(0, 6), laneTimer: rnd(1, 3), bumpCd: 0 };
    });
    this.shared = { cone: new THREE.ConeGeometry(0.6, 1.4, 12), coin: new THREE.CylinderGeometry(0.6, 0.6, 0.16, 18), barrel: new THREE.CylinderGeometry(0.75, 0.75, 1.5, 14), gummy: new THREE.BoxGeometry(1.7, 1.5, 1.6), wall: new THREE.BoxGeometry(7.4, 1.5, 0.9) };
    this.mats = { cone: mat('#ff7a1a'), coneW: mat('#ffffff'), coin: mat('#ffd23f', { emissive: '#7a5a00', ei: 0.5 }), barrel: new THREE.MeshToonMaterial({ map: stripeTexture('#ff5fb3', '#ffffff') }), gummy: mat('#4dff9b', { opacity: 0.85 }), wall: new THREE.MeshToonMaterial({ map: stripeTexture('#ff3b6b', '#ffffff', true) }) };
  }

  carInstance(model, fallbackColor, glow) {
    let m = Models.get(model);
    if (!m) m = buildCar({ body: 'muscle', color: fallbackColor, rim: '#ffffff', glow });
    m.add(blobShadow(3.0, 4.6));
    return m;
  }
  makeDecoInstance(night) {
    const name = pick(DECO_MODELS);
    const g = Models.get(name);
    if (g) { g.add(blobShadow(g.userData.size?.x || 4, g.userData.size?.z || 4)); return g; }
    return makeDeco(pick(['lolly', 'cane', 'bear', 'donut', 'ice']), night, this.track);
  }

  // ---------- spawning ----------
  spawnAhead() {
    const T = this.track;
    while (this.spawnDist < this.playerDist + VIEW - 20 && this.spawnDist < T.length - 30) {
      const d = this.spawnDist; const r = Math.random();
      const lane = Math.floor(Math.random() * 3);
      if (r < 0.28) { this.addObstacle(pick(['cone', 'barrel', 'gummy']), d, LANES[lane]); this.coinLine(d + 8, LANES[(lane + 1 + Math.floor(Math.random() * 2)) % 3], 4); }
      else if (r < 0.45) { const free = Math.floor(Math.random() * 3); for (let l = 0; l < 3; l++) if (l !== free) this.addObstacle(pick(['barrel', 'cone', 'gummy']), d + rnd(-1, 1), LANES[l]); this.coinLine(d - 6, LANES[free], 6); }
      else if (r < 0.6) { this.coinLine(d, LANES[lane], 8); }
      else if (r < 0.72) { this.addObstacle('traffic', d, LANES[lane]); }
      else if (r < 0.82) { for (let i = 0; i < 9; i++) this.addCoin(d + i * 3, LANES[Math.round(1 + Math.sin(i * 0.8 + lane))]); }
      else if (r < 0.9) { const side = Math.random() < 0.5 ? -1 : 1; this.addObstacle('wall', d, side * 2.0); this.coinLine(d + 4, LANES[side < 0 ? 2 : 0], 5); }
      else { this.addPickup(d, LANES[lane]); }
      this.spawnDist += rnd(24, 42) / T.density;
    }
  }
  coinLine(d, x, n) { for (let i = 0; i < n; i++) this.addCoin(d + i * 3, x); }
  getMesh(type) {
    const p = this.pool[type] || (this.pool[type] = []);
    if (p.length) { const m = p.pop(); m.visible = true; return m; }
    let m;
    const S = this.shared, M = this.mats;
    if (type === 'cone') { m = new THREE.Group(); const c = new THREE.Mesh(S.cone, M.cone); c.position.y = 0.7; m.add(c); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 6, 14), M.coneW); ring.rotation.x = Math.PI / 2; ring.position.y = 0.75; m.add(ring); }
    else if (type === 'barrel') { m = new THREE.Mesh(S.barrel, M.barrel); m.position.y = 0.75; const g = new THREE.Group(); g.add(m); m = g; }
    else if (type === 'gummy') { m = new THREE.Mesh(S.gummy, M.gummy); m.position.y = 0.75; const g = new THREE.Group(); g.add(m); m = g; }
    else if (type === 'wall') { m = new THREE.Mesh(S.wall, M.wall); m.position.y = 0.75; const g = new THREE.Group(); g.add(m); m = g; }
    else if (type === 'coin') { m = new THREE.Mesh(S.coin, M.coin); m.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(m); m = g; }
    else if (type === 'traffic') { m = this.carInstance(pick(['car_bubble', 'car_cane', 'car_jelly']), pick(['#ffe23f', '#4dd2ff', '#b44bff', '#ff8a5b']), false); }
    else if (type.startsWith('pu_')) { m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.badge(type.slice(3)), transparent: true })); m.scale.set(2.2, 2.2, 1); }
    if (type !== 'coin' && type !== 'traffic' && !type.startsWith('pu_')) m.add(blobShadow(type === 'wall' ? 8 : 2, type === 'wall' ? 2 : 2));
    m.userData.shared = true; this.scene.add(m); return m;
  }
  badge(id) {
    if (this.badgeTex[id]) return this.badgeTex[id];
    const pu = POWERUPS.find(p => p.id === id);
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const draw = (img) => {
      x.clearRect(0, 0, 256, 256);
      x.beginPath(); x.arc(128, 128, 122, 0, 6.29); x.fillStyle = pu.color; x.fill();
      x.beginPath(); x.arc(128, 128, 104, 0, 6.29); x.fillStyle = '#fff'; x.fill();
      if (img) { x.save(); x.beginPath(); x.arc(128, 128, 100, 0, 6.29); x.clip(); x.drawImage(img, 28, 28, 200, 200); x.restore(); }
      tex.needsUpdate = true;
    };
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; draw(null);
    const img = new Image(); img.onload = () => draw(img); img.src = pu.img;
    return (this.badgeTex[id] = tex);
  }
  addObstacle(type, dist, x) {
    const half = type === 'wall' ? 3.6 : type === 'traffic' ? 1.05 : 0.8;
    this.objs.push({ kind: 'obs', type, dist, x, half, mesh: this.getMesh(type), hit: false, passed: false, vy: 0 });
  }
  addCoin(dist, x) { this.objs.push({ kind: 'coin', type: 'coin', dist, x, half: 0.7, mesh: this.getMesh('coin') }); }
  addPickup(dist, x) { const id = pick(['nitro', 'shield', 'magnet', 'slowmo']); this.objs.push({ kind: 'pu', type: 'pu_' + id, pu: id, dist, x, half: 1.0, mesh: this.getMesh('pu_' + id) }); }
  freeObj(o) { o.mesh.visible = false; o.mesh.rotation.set(0, 0, 0); o.mesh.position.y = 0; (this.pool[o.type] || (this.pool[o.type] = [])).push(o.mesh); }

  // ---------- powerups ----------
  usePowerup(id) {
    if (this.state !== 'race' || !this.inventory[id] || this.inventory[id] <= 0) return false;
    if (id === 'doubler') return false;
    this.inventory[id]--; this.activate(id); return true;
  }
  activate(id) {
    if (id === 'nitro') { this.effects.nitro = 4; this.nitroUsed++; Audio.nitro(); }
    if (id === 'shield') { this.effects.shield = 1; Audio.shield(); }
    if (id === 'magnet') { this.effects.magnet = 8; Audio.pickup(); }
    if (id === 'slowmo') { this.effects.slowmo = 5; Audio.pickup(); }
    this.cb.onEvent?.('activate', id);
  }

  // ---------- main loop ----------
  frame(now) {
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.paused) { this.render(); return; }
    this.time += dt;
    if (this.state === 'countdown') {
      const prev = Math.ceil(this.countdown); this.countdown -= dt;
      const cur = Math.ceil(this.countdown);
      if (cur !== prev) { if (cur > 0) Audio.beep(false); else { Audio.beep(true); this.state = 'race'; } this.cb.onCountdown?.(cur); }
    } else this.update(dt);
    this.updateVisuals(dt);
    this.render();
    this.hudTimer += dt;
    if (this.hudTimer > 0.1) { this.hudTimer = 0; this.pushHud(); }
  }

  update(dt) {
    const T = this.track, C = this.car, E = this.effects;
    for (const k of ['nitro', 'magnet', 'slowmo']) if (E[k] > 0) E[k] -= dt;
    const ts = E.slowmo > 0 ? 0.55 : 1;
    const wdt = dt * ts;

    this.curveTimer -= wdt;
    if (this.curveTimer <= 0) { this.curveTimer = rnd(4, 9); this.curveTarget = Math.random() < 0.3 ? 0 : rnd(-1, 1); }
    this.curve += (this.curveTarget - this.curve) * Math.min(1, wdt * 0.5);

    const input = clamp(this.steerInput + this.tiltInput, -1, 1);
    this.steer += (input - this.steer) * Math.min(1, dt * 10);
    if (!this.finished) {
      const target = this.steer * C.lateral - this.curve * this.speed * 0.075;
      this.latVel += (target - this.latVel) * Math.min(1, dt * 7);
      this.x = clamp(this.x + this.latVel * dt, -RW - 1.6, RW + 1.6);
    }
    const off = Math.abs(this.x) > RW - 0.5;
    let max = C.maxSpeed * (E.nitro > 0 ? 1.55 : 1) * (off ? 0.5 : 1);
    if (this.finished) max = 0;
    const accel = this.stun > 0 ? -20 : (E.nitro > 0 ? 34 : 15);
    if (this.speed < max) this.speed = Math.min(max, this.speed + accel * dt); else this.speed = Math.max(max, this.speed - (this.finished ? 18 : 28) * dt);
    if (this.stun > 0) this.stun -= dt;
    if (off && this.speed > 5) this.shake = Math.max(this.shake, 0.08);
    this.playerDist += this.speed * wdt;

    for (const ai of this.ais) {
      const gap = ai.dist - this.playerDist;
      let target = C.maxSpeed * T.aiSpeed * ai.def.skill * (1 + 0.06 * Math.sin(this.time * 0.7 + ai.wobble));
      if (gap > 110) target *= 0.85; else if (gap > 50) target *= 0.95; else if (gap < -140) target *= 1.2; else if (gap < -60) target *= 1.08;
      ai.speed += (target - ai.speed) * Math.min(1, wdt * 0.8);
      if (ai.speed < target) ai.speed = Math.min(target, ai.speed + 12 * wdt);
      ai.dist += ai.speed * wdt;
      if (!ai.finished && ai.dist >= T.length) ai.finished = true;
      ai.laneTimer -= wdt;
      const blocked = l => this.objs.some(o => o.kind === 'obs' && !o.hit && o.dist > ai.dist + 2 && o.dist < ai.dist + 40 && Math.abs(o.x - LANES[l]) < o.half + 1.2);
      if (blocked(ai.lane) || ai.laneTimer <= 0) {
        ai.laneTimer = rnd(2, 5);
        const opts = [0, 1, 2].filter(l => !blocked(l));
        if (opts.length) ai.lane = opts.includes(ai.lane) && Math.random() < 0.7 ? ai.lane : pick(opts);
      }
      ai.x += (LANES[ai.lane] - ai.x) * Math.min(1, wdt * 2.2);
      ai.bumpCd -= dt;
      if (!this.finished && ai.bumpCd <= 0 && Math.abs(gap) < 3.8 && Math.abs(ai.x - this.x) < 2.1) {
        ai.bumpCd = 0.8; const dir = Math.sign(this.x - ai.x) || 1; this.latVel += dir * 6; this.speed *= 0.85; ai.speed *= 0.9; this.shake = 0.15; Audio.bump();
        this.cb.onEvent?.('bump');
      }
    }

    this.spawnAhead();
    const magnet = E.magnet > 0;
    for (let i = this.objs.length - 1; i >= 0; i--) {
      const o = this.objs[i];
      if (o.type === 'traffic') o.dist += TRAFFIC_SPEED * wdt;
      const rel = o.dist - this.playerDist;
      if (rel < -14) { this.freeObj(o); this.objs.splice(i, 1); continue; }
      if (o.kind === 'coin') {
        if (magnet && rel < 22 && rel > -2) { o.x += (this.x - o.x) * Math.min(1, dt * 6); o.dist -= 10 * dt; }
        if (Math.abs(rel) < 1.6 && Math.abs(o.x - this.x) < 1.7) { const v = E.doubler > 0 ? 2 : 1; this.coins += v; Audio.coin(); this.cb.onEvent?.('coin', v); this.freeObj(o); this.objs.splice(i, 1); continue; }
      } else if (o.kind === 'pu') {
        if (Math.abs(rel) < 1.8 && Math.abs(o.x - this.x) < 2.0) { this.activate(o.pu); this.freeObj(o); this.objs.splice(i, 1); continue; }
      } else if (o.kind === 'obs') {
        if (o.hit) { o.vy -= 25 * wdt; o.mesh.position.y += o.vy * wdt; o.mesh.rotation.z += 4 * wdt; o.x += o.fling * wdt; continue; }
        if (!this.finished && rel > -2.2 && rel < 2.2 && Math.abs(o.x - this.x) < o.half + 1.0) {
          o.hit = true; o.vy = 9; o.fling = (Math.sign(o.x - this.x) || 1) * 8;
          if (E.shield > 0) { E.shield = 0; Audio.shield(); this.cb.onEvent?.('shieldPop'); }
          else { this.crashes++; this.speed *= 0.3 * (2 - C.crashMul) * 0.6; this.stun = 0.45; this.shake = 0.6; Audio.crash(); this.cb.onEvent?.('crash'); }
        } else if (!o.passed && rel < -2.5) { o.passed = true; this.dodged++; }
      }
    }

    if (!this.finished && this.playerDist >= T.length) {
      this.finished = true; this.place = 1 + this.ais.filter(a => a.finished).length;
      Audio.fanfare(); this.cb.onFinishLine?.(this.place);
    }
    if (this.finished) { this.finishTimer += dt; if (this.finishTimer > 2.2 && this.state === 'race') { this.state = 'done'; this.endRace(); } }
    Audio.setEngine(this.speed / 62, true);
  }

  endRace() {
    Audio.stopEngine();
    this.cb.onFinish?.({ place: this.place, coins: this.coins, crashes: this.crashes, dodged: this.dodged, nitroUsed: this.nitroUsed, distance: this.track.length, inventory: this.inventory });
  }

  bend(rel) { const r = Math.max(0, rel); return this.curve * r * r * BEND_K; }

  updateRibbon(mesh, xOff, w, pd) {
    const pos = mesh.geometry.attributes.position.array, uv = mesh.geometry.attributes.uv.array;
    const base = Math.floor(pd / SEG_LEN) * SEG_LEN - SEG_LEN;
    for (let i = 0; i <= SEG_COUNT; i++) {
      const d = base + i * SEG_LEN, rel = d - pd, bx = this.bend(rel) - this.x + xOff;
      const j = i * 6; pos[j] = bx - w; pos[j + 1] = 0.02; pos[j + 2] = -rel; pos[j + 3] = bx + w; pos[j + 4] = 0.02; pos[j + 5] = -rel;
      const k = i * 4; uv[k] = 0; uv[k + 1] = d / SEG_LEN; uv[k + 2] = 1; uv[k + 3] = d / SEG_LEN;
    }
    mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.attributes.uv.needsUpdate = true;
  }

  updateTerrain(pd) {
    const g = this.terrain.geometry, pos = g.attributes.position.array, uv = g.attributes.uv.array, col = g.attributes.color.array;
    const nx = GRID_X + 1;
    const base = Math.floor(pd / GRID_STEP) * GRID_STEP - 30;
    let i = 0;
    for (let z = 0; z <= GRID_Z; z++) {
      const wz = base + z * GRID_STEP, rel = wz - pd, bx = this.bend(rel) - this.x;
      for (let x = 0; x <= GRID_X; x++, i++) {
        const u = -GRID_W / 2 + x * (GRID_W / GRID_X);
        const h = this.hill(u, wz);
        pos[i * 3] = u + bx; pos[i * 3 + 1] = h - 0.05; pos[i * 3 + 2] = -rel;
        uv[i * 2] = u / 14; uv[i * 2 + 1] = wz / 14;
        const t = Math.min(1, h / 9);
        this.tmpCol.copy(this.groundCol).lerp(this.hillCol, t * t).multiplyScalar(0.62);
        col[i * 3] = this.tmpCol.r; col[i * 3 + 1] = this.tmpCol.g; col[i * 3 + 2] = this.tmpCol.b;
      }
    }
    g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; g.attributes.color.needsUpdate = true;
    g.computeVertexNormals();
  }

  updateVisuals(dt) {
    const pd = this.playerDist;
    this.updateRibbon(this.road, 0, RW, pd);
    this.updateRibbon(this.curbL, -RW - 0.7, 0.7, pd);
    this.updateRibbon(this.curbR, RW + 0.7, 0.7, pd);
    this.updateTerrain(pd);
    // decor
    for (const d of this.decos) {
      let rel = d.userData.dist - pd;
      if (rel < -16) { d.userData.dist += 22 * 15; rel = d.userData.dist - pd; }
      const u = d.userData.side * (RW + d.userData.off);
      d.position.set(u + this.bend(rel) - this.x, this.hill(u, d.userData.dist) - 0.1, -rel);
      d.visible = rel < VIEW;
      if (d.children.length > 1) d.children[1].visible = rel < 110; // outline hull only nearby
    }
    for (const o of this.objs) {
      const rel = o.dist - pd;
      o.mesh.position.x = o.x + this.bend(rel) - this.x; o.mesh.position.z = -rel;
      if (o.kind === 'coin') o.mesh.rotation.y += 4 * dt, o.mesh.position.y = 0.9;
      else if (o.kind === 'pu') o.mesh.position.y = 1.4 + Math.sin(this.time * 4 + o.dist) * 0.25;
      else if (o.type === 'traffic') spinWheels(o.mesh, TRAFFIC_SPEED * dt * 2);
      o.mesh.visible = rel < VIEW;
    }
    for (const ai of this.ais) {
      const rel = ai.dist - pd;
      ai.mesh.position.set(ai.x + this.bend(rel) - this.x, 0, -rel);
      ai.mesh.rotation.y = -(LANES[ai.lane] - ai.x) * 0.08; ai.mesh.visible = rel > -20 && rel < VIEW;
      spinWheels(ai.mesh, ai.speed * dt * 2.5);
    }
    for (const c of this.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 340) c.position.x = -340; }
    // sparkles drift towards the camera with the world
    const sp = this.sparkles.geometry.attributes.position.array; const adv = this.speed * dt * 0.7;
    for (let i = 0; i < sp.length; i += 3) { sp[i + 2] += adv; sp[i + 1] += Math.sin(this.time * 2 + i) * dt * 0.4; if (sp[i + 2] > 2) { sp[i + 2] -= 180; sp[i] = rnd(-45, 45); sp[i + 1] = rnd(0.5, 16); } }
    this.sparkles.geometry.attributes.position.needsUpdate = true;
    this.sparkles.material.opacity = 0.6 + Math.sin(this.time * 5) * 0.25;
    // camera
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const sh = this.shake, spd = this.speed / 62;
    this.camera.position.set(Math.sin(this.time * 41) * sh * 0.25, 1.55 + Math.sin(this.time * 27) * (0.01 * spd + sh * 0.2), 0);
    this.camera.rotation.z = -this.steer * 0.05 - this.latVel * 0.005 + Math.sin(this.time * 37) * sh * 0.05;
    this.camera.rotation.y = -this.steer * 0.12 - this.bend(60) * 0.004;
    this.camera.rotation.x = (this.pitch ?? -0.07) + Math.sin(this.time * 23) * sh * 0.03;
    this.shieldMesh.visible = this.effects.shield > 0;
    if (this.shieldMesh.visible) this.shieldMesh.material.opacity = 0.14 + Math.sin(this.time * 6) * 0.06;
  }

  render() { this.renderer.render(this.scene, this.camera); }

  pushHud() {
    const T = this.track;
    const racers = [{ id: 'you', dist: this.playerDist, finished: this.finished }, ...this.ais.map(a => ({ id: a.def.id, dist: a.dist, finished: a.finished }))];
    racers.sort((a, b) => b.dist - a.dist);
    const place = this.finished ? this.place : racers.findIndex(r => r.id === 'you') + 1;
    this.cb.onHud?.({ speed: this.speed, place, progress: Math.min(1, this.playerDist / T.length), racers: racers.map(r => ({ id: r.id, p: Math.min(1, r.dist / T.length) })), coins: this.coins, effects: this.effects, inventory: this.inventory, steer: this.steer, state: this.state });
  }
}

// ---------- helpers ----------
let _blobTex = null;
function blobShadow(w, d) {
  if (!_blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(40,10,60,0.45)'); g.addColorStop(1, 'rgba(40,10,60,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); _blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: _blobTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.userData.shared = true; return m;
}

// ---------- textures ----------
function roadTexture(road, edge, night) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = road; x.fillRect(0, 0, 256, 512);
  // subtle asphalt speckles
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`; x.fillRect(Math.random() * 256, Math.random() * 512, 3, 3); }
  x.fillStyle = night ? '#9df6ff' : '#ffffff';
  for (const lx of [85, 171]) { x.fillRect(lx - 3, 40, 6, 200); x.fillRect(lx - 3, 296, 6, 200); }
  x.fillStyle = edge; x.fillRect(0, 0, 6, 512); x.fillRect(250, 0, 6, 512);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function sprinkleTexture(base, night) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 128);
  // light texture variation (multiplied with vertex colour)
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, rnd(4, 14), 0, 6.3); x.fill(); }
  const cols = night ? ['#ff5fb3', '#2ef2ff', '#b44bff', '#ffe23f'] : ['#ff5fb3', '#2ee6ff', '#ffe23f', '#ffffff', '#b44bff'];
  for (let i = 0; i < 22; i++) { x.save(); x.translate(rnd(0, 128), rnd(0, 128)); x.rotate(rnd(0, 3.14)); x.fillStyle = pick(cols); x.fillRect(-5, -1.5, 10, 3); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function stripeTexture(a, b, horizontal = false) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; if (horizontal) x.fillRect(i * 16, 0, 16, 128); else x.fillRect(0, i * 16, 128, 16); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(horizontal ? 3 : 1, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sunTexture(col = '#ffe14d', col2 = '#ffb300') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(0.75, col2); g.addColorStop(1, 'rgba(255,200,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#3a1d4f'; x.lineWidth = 4; x.beginPath(); x.arc(52, 56, 4, 0, 6.3); x.arc(76, 56, 4, 0, 6.3); x.stroke();
  x.beginPath(); x.arc(64, 66, 14, 0.3, 2.8); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function cloudTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  for (const [cx, cy, r] of [[60, 80, 40], [110, 60, 50], [170, 70, 45], [210, 88, 32], [130, 95, 40]]) { x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
// Panoramic backdrop: layered candy hills with lollipops, drawn once per track
function panoramaTexture(T) {
  const W = 2048, H = 512; const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const layers = T.pano || [['#c9b3ff', 0.62], ['#ffb3e0', 0.7], ['#9fe8ff', 0.78]];
  layers.forEach(([col, base], li) => {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, H);
    for (let px = 0; px <= W; px += 8) {
      const t = px / W * Math.PI * 2;
      const y = H * base - (Math.sin(t * 3 + li) * 28 + Math.sin(t * 7 + li * 2) * 16 + Math.sin(t * 13) * 8) * (1 + li * 0.3);
      x.lineTo(px, y);
    }
    x.lineTo(W, H); x.closePath(); x.fill();
    // lollipops and candy canes on this ridge
    for (let i = 0; i < 26; i++) {
      const px = (i / 26) * W + (li * 37) % 60; const t = px / W * Math.PI * 2;
      const gy = H * base - (Math.sin(t * 3 + li) * 28 + Math.sin(t * 7 + li * 2) * 16 + Math.sin(t * 13) * 8) * (1 + li * 0.3);
      const hgt = 26 + (i * 13) % 30 - li * 6;
      x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4; x.beginPath(); x.moveTo(px, gy); x.lineTo(px, gy - hgt); x.stroke();
      x.fillStyle = ['#ff5fb3', '#ffe23f', '#2ee6ff', '#b44bff', '#4dff9b'][(i + li) % 5]; x.beginPath(); x.arc(px, gy - hgt - 10, 11 - li * 2, 0, 6.3); x.fill();
      x.strokeStyle = 'rgba(58,29,79,0.35)'; x.lineWidth = 2; x.stroke();
    }
  });
  // fog band at the bottom blends with the scene fog colour
  const g = x.createLinearGradient(0, H * 0.72, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, T.fog);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.x = 5; return t;
}

// ---------- procedural fallback decorations ----------
function makeDeco(type, night, T) {
  const g = new THREE.Group();
  const cm = (c) => mat(c, night ? { emissive: c, ei: 0.6 } : {});
  if (type === 'lolly') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 8), mat('#ffffff')); stick.position.y = 1.75; g.add(stick);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 14), cm(pick(['#ff5fb3', '#2ee6ff', '#ffe23f', '#b44bff']))); head.position.y = 4.4; head.scale.z = 0.5; g.add(head);
  } else if (type === 'cane') {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.5, 10), new THREE.MeshToonMaterial({ map: stripeTexture('#ff3b3b', '#ffffff') })); s.position.y = 2.25; g.add(s);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.35, 8, 12, Math.PI), new THREE.MeshToonMaterial({ map: stripeTexture('#ff3b3b', '#ffffff', true) })); hook.position.set(0.9, 4.5, 0); g.add(hook);
  } else if (type === 'bear') {
    const c = pick(['#ff9a2e', '#4dff9b', '#ff3b6b', '#ffe23f']); const m = mat(c, { opacity: 0.9, emissive: night ? c : '#000', ei: 0.5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12), m); body.position.y = 1.4; body.scale.y = 1.2; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 12), m); head.position.y = 3.3; g.add(head);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), m); ear.position.set(s * 0.8, 4.1, 0); g.add(ear); }
  } else if (type === 'donut') {
    const d = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.6, 10, 20), cm(pick(['#ff5fb3', '#b44bff', '#7a4a2a']))); d.position.y = 2.2; g.add(d);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.6, 8), mat('#ffffff')); base.position.y = 0.3; g.add(base);
  } else {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 10), mat('#e8b06a')); cone.position.y = 1.2; cone.rotation.x = Math.PI; g.add(cone);
    const scoop = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 12), cm(pick(['#ff9ecf', '#fff2b0', '#a8f0d0', '#c9a27a']))); scoop.position.y = 3.0; g.add(scoop);
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mat('#ff2d55')); cherry.position.y = 4.1; g.add(cherry);
  }
  const sc = rnd(0.8, 1.3); g.scale.set(sc, sc, sc);
  return g;
}
