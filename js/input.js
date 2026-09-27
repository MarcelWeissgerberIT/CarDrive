// Steering input: virtual steering wheel (drag), swipe anywhere on the lower screen, keyboard, device tilt.
// Handles Pointer Events and falls back to Touch Events (iOS Safari), never both for the same finger.
export class Input {
  constructor({ wheelEl, zoneEl, onSteer }) {
    this.wheelEl = wheelEl; this.zoneEl = zoneEl; this.onSteer = onSteer;
    this.value = 0; this.keys = { left: false, right: false }; this.tilt = 0; this.tiltEnabled = false;
    this.active = null; // { src, id, mode, startX, lastA, acc }
    const cx = () => { const r = wheelEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; };
    const angleOf = (x, y, c) => Math.atan2(y - c.y, x - c.x);

    const begin = (src, id, x, y) => {
      if (this.active) return;
      const c = cx(); const onWheel = Math.hypot(x - c.x, y - c.y) < c.r * 1.25;
      this.active = { src, id, mode: onWheel ? 'wheel' : 'swipe', startX: x, lastA: angleOf(x, y, c), acc: this.value * 150 };
    };
    const move = (src, id, x, y) => {
      const p = this.active; if (!p || p.src !== src || p.id !== id) return;
      if (p.mode === 'wheel') {
        const c = cx(); const a = angleOf(x, y, c); let d = a - p.lastA;
        if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
        p.lastA = a; p.acc = Math.max(-150, Math.min(150, p.acc + d * 180 / Math.PI));
        this.set(p.acc / 150);
      } else {
        const w = Math.max(140, Math.min(window.innerWidth, window.innerHeight) * 0.35);
        this.set(Math.max(-1, Math.min(1, (x - p.startX) / w)));
      }
    };
    const end = (src, id) => { const p = this.active; if (p && p.src === src && p.id === id) { this.active = null; this.set(0); } };

    // Pointer Events
    if (window.PointerEvent) {
      zoneEl.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; begin('p', e.pointerId, e.clientX, e.clientY); try { zoneEl.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
      zoneEl.addEventListener('pointermove', e => { move('p', e.pointerId, e.clientX, e.clientY); if (this.active) e.preventDefault(); });
      zoneEl.addEventListener('pointerup', e => end('p', e.pointerId));
      zoneEl.addEventListener('pointercancel', e => end('p', e.pointerId));
      zoneEl.addEventListener('lostpointercapture', e => end('p', e.pointerId));
    }
    // Touch Events fallback (also blocks Safari scroll / zoom / pull-to-refresh gestures)
    const opts = { passive: false };
    zoneEl.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; if (!this.active) begin('t', t.identifier, t.clientX, t.clientY); }, opts);
    zoneEl.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) move('t', t.identifier, t.clientX, t.clientY); }, opts);
    zoneEl.addEventListener('touchend', e => { e.preventDefault(); for (const t of e.changedTouches) end('t', t.identifier); }, opts);
    zoneEl.addEventListener('touchcancel', e => { for (const t of e.changedTouches) end('t', t.identifier); }, opts);
    // If a pointer stream silently dies (iOS), a new touch takes over after a short idle
    zoneEl.addEventListener('touchstart', e => { const p = this.active; if (p && p.src === 'p' && performance.now() - (this._lastMove || 0) > 600) { this.active = null; const t = e.changedTouches[0]; begin('t', t.identifier, t.clientX, t.clientY); } }, opts);
    zoneEl.addEventListener('pointermove', () => { this._lastMove = performance.now(); });

    window.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true; if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true; this.keyUpdate(); });
    window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false; if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false; this.keyUpdate(); });
    window.addEventListener('deviceorientation', e => {
      if (!this.tiltEnabled) return;
      const landscape = window.innerWidth > window.innerHeight;
      let v = landscape ? (e.beta || 0) : (e.gamma || 0);
      if (landscape && (screen.orientation?.angle === 270 || window.orientation === -90)) v = -v;
      this.tilt = Math.max(-1, Math.min(1, v / 25)); if (!this.active) this.set(this.tilt);
    });
  }
  keyUpdate() { if (this.active) return; this.set((this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0)); }
  set(v) { this.value = v; this.wheelEl.style.transform = `rotate(${v * 150}deg)`; this.onSteer(v); }
  async enableTilt(on) {
    this.tiltEnabled = on;
    if (on && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
      try { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') this.tiltEnabled = false; } catch (e) { this.tiltEnabled = false; }
    }
    return this.tiltEnabled;
  }
}
