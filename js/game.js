// Core race engine: cockpit-view endless-runner style racing with AI opponents
import * as THREE from 'three';
import { buildCar, mat, spinWheels, emojiTexture } from './cars3d.js';
import { OPPONENTS, POWERUPS } from './data.js';
import { Audio } from './audio.js';

const RW = 6.5;               // road half width
const LANES = [-4, 0, 4];
const SEG_LEN = 12, SEG_COUNT = 28;
const VIEW = SEG_LEN * SEG_COUNT;
const BEND_K = 0.00055;
const TRAFFIC_SPEED = 13;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class RaceGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 600);
    this.scene = null;
    this.running = false; this.paused = false;
    this.steerInput = 0; this.tiltInput = 0;
    this.texLoader = new THREE.TextureLoader();
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
    // keep A-pillars and sun visor at the screen edges whatever the aspect ratio
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
    if (this.scene) { this.scene.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose?.(); }); this.scene = null; }
  }
  setPaused(p) { this.paused = p; this.last = performance.now(); Audio.setEngine(0, !p); }

  buildScene(paint, rim, decal) {
    const T = this.track;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(T.sky);
    s.fog = new THREE.Fog(T.fog, 90, VIEW - 20);
    const night = !!T.night;
    s.add(new THREE.HemisphereLight(T.sky, T.ground, night ? 0.5 : 1.1));
    const dir = new THREE.DirectionalLight('#fff4e0', night ? 0.35 : 1.0); dir.position.set(30, 60, 20); s.add(dir);
    s.add(new THREE.AmbientLight('#ffffff', night ? 0.25 : 0.35));

    // ground with sprinkles
    const gt = sprinkleTexture(T.ground, night); gt.repeat.set(60, 60);
    this.groundTex = gt;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, -330); s.add(ground);

    // road ribbon
    const n = SEG_COUNT + 1;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
    for (let i = 0; i < SEG_COUNT; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    rg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const nrm = new Float32Array(n * 2 * 3); for (let i = 0; i < n * 2; i++) nrm[i * 3 + 1] = 1;
    rg.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    rg.setIndex(idx);
    const rt = roadTexture(T.road, T.edge, night);
    this.road = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: rt, roughness: 0.85 }));
    this.road.frustumCulled = false; s.add(this.road);

    // sky decorations
    this.clouds = [];
    if (!night) {
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), fog: false }));
      sun.scale.set(60, 60, 1); sun.position.set(90, 95, -420); s.add(sun);
      const ct = cloudTexture();
      for (let i = 0; i < 9; i++) {
        const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, opacity: 0.95, transparent: true }));
        const sc = rnd(30, 60); c.scale.set(sc, sc * 0.55, 1);
        c.position.set(rnd(-250, 250), rnd(40, 110), -rnd(380, 460)); c.userData.v = rnd(0.5, 1.5); s.add(c); this.clouds.push(c);
      }
    } else {
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture('#fff6c8', '#e6dcff'), fog: false }));
      moon.scale.set(40, 40, 1); moon.position.set(-80, 100, -420); s.add(moon);
      const sg = new THREE.BufferGeometry(); const sp = [];
      for (let i = 0; i < 300; i++) sp.push(rnd(-400, 400), rnd(30, 250), -rnd(380, 480));
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, fog: false })));
      const hl = new THREE.PointLight('#fff2c0', 2.5, 70); hl.position.set(0, 1.5, -8); this.camera.add(hl);
    }

    // roadside decor ring buffer
    this.decos = [];
    for (let i = 0; i < 36; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const d = makeDeco(pick(['lolly', 'cane', 'bear', 'donut', 'ice']), night, T);
      d.userData.side = side; d.userData.dist = Math.floor(i / 2) * 18 + rnd(-4, 4);
      d.userData.off = rnd(3, 9); d.rotation.y = rnd(0, 6.28); s.add(d); this.decos.push(d);
    }

    // cockpit (attached to camera)
    this.camera.position.set(0, 1.55, 0); this.camera.rotation.set(0, 0, 0);
    while (this.camera.children.length > (night ? 1 : 0)) this.camera.remove(this.camera.children[this.camera.children.length - 1]);
    const cp = this.cockpit = new THREE.Group();
    const pm = mat(paint); const dash = mat('#2b1b3f', { rough: 0.7 }); const trim = mat('#ff5fb3');
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 2.8), pm); hood.position.set(0, -0.74, -2.6); hood.rotation.x = -0.09; cp.add(hood);
    const hoodLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 2.6), mat('#ffffff')); hoodLine.position.set(0, -0.74, -2.6); hoodLine.rotation.x = -0.09; cp.add(hoodLine);
    for (const sx of [-1, 1]) { const fd = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 2.2), pm); fd.position.set(sx * 1.3, -0.78, -2.9); fd.rotation.x = -0.09; cp.add(fd); }
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.7), dash); d1.position.set(0, -0.8, -1.0); cp.add(d1);
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 0.74), trim); d2.position.set(0, -0.54, -1.0); cp.add(d2);
    for (const sx of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 0.12), dash); pil.position.set(sx * 1.32, 0.3, -1.05); pil.rotation.z = sx * 0.12; cp.add(pil);
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.12), pm); mir.position.set(sx * 1.42, -0.32, -1.25); cp.add(mir);
    }
    const roof = this.roof = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.5), dash); roof.position.set(0, 0.78, -1.05); cp.add(roof);
    this.pillars = []; cp.children.forEach(c => { if (c.geometry && c.geometry.parameters && c.geometry.parameters.height === 2.2) this.pillars.push(c); });
    this.applyAspect();
    if (decal) {
      const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: emojiTexture(decal), transparent: true }));
      dm.rotation.x = -Math.PI / 2 - 0.09; dm.position.set(0, -0.6, -2.3); cp.add(dm);
    }
    // shield bubble
    this.shieldMesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), new THREE.MeshBasicMaterial({ color: '#7ff4ff', transparent: true, opacity: 0.18, side: THREE.BackSide }));
    this.shieldMesh.position.set(0, -0.3, -1.5); this.shieldMesh.visible = false; cp.add(this.shieldMesh);
    this.camera.add(cp); s.add(this.camera);

    // AI opponents
    this.ais = OPPONENTS.map((o, i) => {
      const mesh = buildCar({ body: pick(['muscle', 'sport', 'beetle', 'lowrider']), color: o.color, rim: '#ffffff', glow: night });
      s.add(mesh);
      return { def: o, mesh, dist: 8 + i * 7, x: LANES[[0, 2, 1][i]], lane: [0, 2, 1][i], speed: 0, finished: false, wobble: rnd(0, 6), laneTimer: rnd(1, 3), bumpCd: 0 };
    });
    this.shared = { cone: new THREE.ConeGeometry(0.6, 1.4, 12), coin: new THREE.CylinderGeometry(0.6, 0.6, 0.16, 18), barrel: new THREE.CylinderGeometry(0.75, 0.75, 1.5, 14), gummy: new THREE.BoxGeometry(1.7, 1.5, 1.6), wall: new THREE.BoxGeometry(7.4, 1.5, 0.9) };
    this.mats = { cone: mat('#ff7a1a'), coneW: mat('#ffffff'), coin: mat('#ffd23f', { metal: 0.6, rough: 0.25, emissive: '#7a5a00', ei: 0.5 }), barrel: new THREE.MeshStandardMaterial({ map: stripeTexture('#ff5fb3', '#ffffff'), roughness: 0.5 }), gummy: mat('#4dff9b', { opacity: 0.85, rough: 0.2 }), wall: new THREE.MeshStandardMaterial({ map: stripeTexture('#ff3b6b', '#ffffff', true), roughness: 0.5 }) };
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
    else if (type === 'traffic') { m = buildCar({ body: 'traffic', color: pick(['#ffe23f', '#4dd2ff', '#b44bff', '#ff8a5b', '#7dff8a', '#ffffff']), rim: '#dddddd' }); }
    else if (type.startsWith('pu_')) { m = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.badge(type.slice(3)), transparent: true })); m.scale.set(2.2, 2.2, 1); }
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
    const ts = E.slowmo > 0 ? 0.55 : 1;   // world time scale
    const wdt = dt * ts;

    // curves
    this.curveTimer -= wdt;
    if (this.curveTimer <= 0) { this.curveTimer = rnd(4, 9); this.curveTarget = Math.random() < 0.3 ? 0 : rnd(-1, 1); }
    this.curve += (this.curveTarget - this.curve) * Math.min(1, wdt * 0.5);

    // steering & lateral
    const input = clamp(this.steerInput + this.tiltInput, -1, 1);
    this.steer += (input - this.steer) * Math.min(1, dt * 10);
    if (!this.finished) {
      const target = this.steer * C.lateral - this.curve * this.speed * 0.075;
      this.latVel += (target - this.latVel) * Math.min(1, dt * 7);
      this.x = clamp(this.x + this.latVel * dt, -RW - 1.6, RW + 1.6);
    }
    // speed
    const off = Math.abs(this.x) > RW - 0.5;
    let max = C.maxSpeed * (E.nitro > 0 ? 1.55 : 1) * (off ? 0.5 : 1);
    if (this.finished) max = 0;
    const accel = this.stun > 0 ? -20 : (E.nitro > 0 ? 34 : 15);
    if (this.speed < max) this.speed = Math.min(max, this.speed + accel * dt); else this.speed = Math.max(max, this.speed - (this.finished ? 18 : 28) * dt);
    if (this.stun > 0) this.stun -= dt;
    if (off && this.speed > 5) this.shake = Math.max(this.shake, 0.08);
    this.playerDist += this.speed * wdt;

    // AI
    for (const ai of this.ais) {
      const gap = ai.dist - this.playerDist;
      let target = C.maxSpeed * T.aiSpeed * ai.def.skill * (1 + 0.06 * Math.sin(this.time * 0.7 + ai.wobble));
      if (gap > 110) target *= 0.85; else if (gap > 50) target *= 0.95; else if (gap < -140) target *= 1.2; else if (gap < -60) target *= 1.08;
      ai.speed += (target - ai.speed) * Math.min(1, wdt * 0.8);
      if (ai.speed < target) ai.speed = Math.min(target, ai.speed + 12 * wdt);
      ai.dist += ai.speed * wdt;
      if (!ai.finished && ai.dist >= T.length) ai.finished = true;
      // lane choice: avoid obstacles ahead
      ai.laneTimer -= wdt;
      const blocked = l => this.objs.some(o => o.kind === 'obs' && !o.hit && o.dist > ai.dist + 2 && o.dist < ai.dist + 40 && Math.abs(o.x - LANES[l]) < o.half + 1.2);
      if (blocked(ai.lane) || ai.laneTimer <= 0) {
        ai.laneTimer = rnd(2, 5);
        const opts = [0, 1, 2].filter(l => !blocked(l));
        if (opts.length) ai.lane = opts.includes(ai.lane) && Math.random() < 0.7 ? ai.lane : pick(opts);
      }
      ai.x += (LANES[ai.lane] - ai.x) * Math.min(1, wdt * 2.2);
      ai.bumpCd -= dt;
      // bump with player
      if (!this.finished && ai.bumpCd <= 0 && Math.abs(gap) < 3.8 && Math.abs(ai.x - this.x) < 2.1) {
        ai.bumpCd = 0.8; const dir = Math.sign(this.x - ai.x) || 1; this.latVel += dir * 6; this.speed *= 0.85; ai.speed *= 0.9; this.shake = 0.15; Audio.bump();
        this.cb.onEvent?.('bump');
      }
    }

    // objects
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

    // finish
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

  updateVisuals(dt) {
    const pd = this.playerDist;
    // road ribbon
    const pos = this.road.geometry.attributes.position.array, uv = this.road.geometry.attributes.uv.array;
    const base = Math.floor(pd / SEG_LEN) * SEG_LEN - SEG_LEN;
    for (let i = 0; i <= SEG_COUNT; i++) {
      const d = base + i * SEG_LEN, rel = d - pd, bx = this.bend(rel);
      const j = i * 6; pos[j] = bx - RW; pos[j + 1] = 0; pos[j + 2] = -rel; pos[j + 3] = bx + RW; pos[j + 4] = 0; pos[j + 5] = -rel;
      const k = i * 4; uv[k] = 0; uv[k + 1] = d / SEG_LEN; uv[k + 2] = 1; uv[k + 3] = d / SEG_LEN;
    }
    this.road.geometry.attributes.position.needsUpdate = true; this.road.geometry.attributes.uv.needsUpdate = true;
    this.road.position.x = -this.x;
    this.groundTex.offset.set(-this.x / 15, pd / 15);
    // decor
    for (const d of this.decos) {
      let rel = d.userData.dist - pd;
      if (rel < -16) { d.userData.dist += 18 * 18; d.userData.off = rnd(3, 9); rel = d.userData.dist - pd; }
      d.position.set(d.userData.side * (RW + d.userData.off) + this.bend(rel) - this.x, 0, -rel);
      d.visible = rel < VIEW;
    }
    // objects
    for (const o of this.objs) {
      const rel = o.dist - pd;
      o.mesh.position.x = o.x + this.bend(rel) - this.x; o.mesh.position.z = -rel;
      if (o.kind === 'coin') o.mesh.rotation.y += 4 * dt, o.mesh.position.y = 0.9;
      else if (o.kind === 'pu') o.mesh.position.y = 1.4 + Math.sin(this.time * 4 + o.dist) * 0.25;
      else if (o.type === 'traffic') spinWheels(o.mesh, TRAFFIC_SPEED * dt * 2);
      o.mesh.visible = rel < VIEW;
    }
    // AI
    for (const ai of this.ais) {
      const rel = ai.dist - pd;
      ai.mesh.position.set(ai.x + this.bend(rel) - this.x, 0, -rel);
      ai.mesh.rotation.y = -(LANES[ai.lane] - ai.x) * 0.08; ai.mesh.visible = rel > -20 && rel < VIEW;
      spinWheels(ai.mesh, ai.speed * dt * 2.5);
    }
    // clouds
    for (const c of this.clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 300) c.position.x = -300; }
    // camera
    this.shake = Math.max(0, this.shake - dt * 1.2);
    const sh = this.shake, sp = this.speed / 62;
    this.camera.position.set(Math.sin(this.time * 41) * sh * 0.25, 1.55 + Math.sin(this.time * 27) * (0.01 * sp + sh * 0.2), 0);
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

// ---------- textures ----------
function roadTexture(road, edge, night) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = road; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? edge : '#ffffff'; x.fillRect(0, i * 64, 14, 64); x.fillRect(242, i * 64, 14, 64); }
  x.fillStyle = night ? '#9df6ff' : '#ffffff';
  for (const lx of [85, 171]) { x.fillRect(lx - 3, 40, 6, 200); x.fillRect(lx - 3, 296, 6, 200); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function sprinkleTexture(base, night) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 128);
  const cols = night ? ['#ff5fb3', '#2ef2ff', '#b44bff', '#ffe23f'] : ['#ff5fb3', '#2ee6ff', '#ffe23f', '#ffffff', '#b44bff'];
  for (let i = 0; i < 26; i++) { x.save(); x.translate(rnd(0, 128), rnd(0, 128)); x.rotate(rnd(0, 3.14)); x.fillStyle = pick(cols); x.fillRect(-5, -1.5, 10, 3); x.restore(); }
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

// ---------- roadside decorations ----------
function makeDeco(type, night, T) {
  const g = new THREE.Group();
  const em = night ? 0.9 : 0;
  const cm = (c) => mat(c, night ? { emissive: c, ei: 0.6 } : {});
  if (type === 'lolly') {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 8), mat('#ffffff')); stick.position.y = 1.75; g.add(stick);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 14), cm(pick(['#ff5fb3', '#2ee6ff', '#ffe23f', '#b44bff']))); head.position.y = 4.4; head.scale.z = 0.5; g.add(head);
  } else if (type === 'cane') {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4.5, 10), new THREE.MeshStandardMaterial({ map: stripeTexture('#ff3b3b', '#ffffff'), roughness: 0.5 })); s.position.y = 2.25; g.add(s);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.35, 8, 12, Math.PI), new THREE.MeshStandardMaterial({ map: stripeTexture('#ff3b3b', '#ffffff', true), roughness: 0.5 })); hook.position.set(0.9, 4.5, 0); g.add(hook);
  } else if (type === 'bear') {
    const c = pick(['#ff9a2e', '#4dff9b', '#ff3b6b', '#ffe23f']); const m = mat(c, { opacity: 0.9, rough: 0.25, emissive: night ? c : '#000', ei: 0.5 });
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
