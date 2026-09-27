// Steering input: virtual steering wheel (drag), swipe anywhere on the lower screen, keyboard, device tilt
export class Input {
  constructor({ wheelEl, zoneEl, onSteer }) {
    this.wheelEl = wheelEl; this.zoneEl = zoneEl; this.onSteer = onSteer;
    this.value = 0; this.keys = { left: false, right: false }; this.tilt = 0; this.tiltEnabled = false;
    this.pointer = null;
    const cx = () => { const r = wheelEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; };
    const angleOf = (e, c) => Math.atan2(e.clientY - c.y, e.clientX - c.x);
    const down = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const c = cx(); const dx = e.clientX - c.x, dy = e.clientY - c.y;
      const onWheel = Math.hypot(dx, dy) < c.r * 1.3;
      this.pointer = { id: e.pointerId, mode: onWheel ? 'wheel' : 'swipe', startX: e.clientX, lastA: angleOf(e, c), acc: this.value * 150 };
      zoneEl.setPointerCapture?.(e.pointerId); e.preventDefault();
    };
    const move = (e) => {
      if (!this.pointer || e.pointerId !== this.pointer.id) return;
      const p = this.pointer;
      if (p.mode === 'wheel') {
        const c = cx(); const a = angleOf(e, c); let d = a - p.lastA;
        if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        p.lastA = a; p.acc = Math.max(-150, Math.min(150, p.acc + d * 180 / Math.PI));
        this.set(p.acc / 150);
      } else {
        const w = Math.max(160, window.innerWidth * 0.22);
        this.set(Math.max(-1, Math.min(1, (e.clientX - p.startX) / w)));
      }
      e.preventDefault();
    };
    const up = (e) => { if (this.pointer && e.pointerId === this.pointer.id) { this.pointer = null; this.set(0); } };
    zoneEl.addEventListener('pointerdown', down); zoneEl.addEventListener('pointermove', move);
    zoneEl.addEventListener('pointerup', up); zoneEl.addEventListener('pointercancel', up);
    window.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true; if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true; this.keyUpdate(); });
    window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false; if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false; this.keyUpdate(); });
    window.addEventListener('deviceorientation', e => {
      if (!this.tiltEnabled) return;
      const landscape = window.innerWidth > window.innerHeight;
      let v = landscape ? (e.beta || 0) : (e.gamma || 0);
      if (landscape && (screen.orientation?.angle === 270 || window.orientation === -90)) v = -v;
      this.tilt = Math.max(-1, Math.min(1, v / 25)); if (!this.pointer) this.set(this.tilt);
    });
  }
  keyUpdate() { if (this.pointer) return; this.set((this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0)); }
  set(v) { this.value = v; this.wheelEl.style.transform = `rotate(${v * 150}deg)`; this.onSteer(v); }
  async enableTilt(on) {
    this.tiltEnabled = on;
    if (on && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      try { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') this.tiltEnabled = false; } catch (e) { this.tiltEnabled = false; }
    }
    return this.tiltEnabled;
  }
}
