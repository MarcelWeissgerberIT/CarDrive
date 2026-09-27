// Tiny WebAudio synth: no audio files needed
export const Audio = {
  ctx: null, enabled: true, engine: null, engineGain: null, master: null,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.6 : 0;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? 0.6 : 0; },
  tone(freq, dur = 0.1, type = 'sine', vol = 0.3, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.3, vol = 0.4, freq = 800) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  },
  click() { this.tone(700, 0.07, 'triangle', 0.25, 300); },
  coin() { this.tone(1180, 0.09, 'square', 0.12, 500); },
  pickup() { [660, 880, 1320].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'triangle', 0.25), i * 70)); },
  crash() { this.noise(0.45, 0.6, 500); this.tone(90, 0.3, 'sawtooth', 0.4, -60); },
  bump() { this.noise(0.15, 0.3, 700); },
  nitro() { this.noise(0.8, 0.35, 2500); this.tone(200, 0.6, 'sawtooth', 0.15, 600); },
  shield() { this.tone(400, 0.25, 'sine', 0.3, 400); },
  beep(hi) { this.tone(hi ? 1040 : 520, hi ? 0.5 : 0.18, 'square', 0.2); },
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'triangle', 0.3), i * 130)); },
  buy() { [880, 1174].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'square', 0.15), i * 90)); },
  fail() { this.tone(220, 0.3, 'sawtooth', 0.2, -100); },
  startEngine() {
    if (!this.ctx || this.engine) return;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = this.ctx.createGain(); g.gain.value = 0.0;
    o.connect(f); f.connect(g); g.connect(this.master); o.start();
    this.engine = o; this.engineGain = g;
  },
  setEngine(speed01, on) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(50 + speed01 * 140, t, 0.05);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
  },
  stopEngine() { if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); },
};
