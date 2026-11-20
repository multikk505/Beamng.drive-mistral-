/* Dźwięk: silnik (oscylator modulowany obrotami) + szum uderzeń */
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engine = null;
    this._lastCrash = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      this.enabled = false;
      return;
    }
    const ctx = this.ctx;

    // silnik
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(lp); osc2.connect(lp); lp.connect(g); g.connect(ctx.destination);
    osc.start(); osc2.start();
    this.engine = { osc, osc2, filter: lp, gain: g };

    // bufor szumu (uderzenia, ślizganie)
    const len = ctx.sampleRate * 0.6;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    this.noiseBuf = buf;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  update(dt, speedNorm, throttle, enabled) {
    if (!this.engine || !this.enabled || !enabled) {
      if (this.engine) this.engine.gain.gain.value = 0;
      return;
    }
    const rpm = 0.14 + speedNorm * 0.75 + throttle * 0.12;
    const t = this.ctx.currentTime;
    this.engine.osc.frequency.setTargetAtTime(46 + rpm * 190, t, 0.05);
    this.engine.osc2.frequency.setTargetAtTime(46 + rpm * 190, t / 2 + 0.01, 0.05);
    this.engine.filter.frequency.setTargetAtTime(300 + rpm * 900 + throttle * 400, t, 0.08);
    this.engine.gain.gain.setTargetAtTime(0.045 + throttle * 0.05, t, 0.1);
    void dt;
  }

  crash(intensity) {
    if (!this.ctx || !this.enabled || intensity < 2.2) return;
    const now = performance.now();
    if (now - this._lastCrash < 160) return;
    this._lastCrash = now;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500 + Math.min(intensity * 90, 2400);
    const g = this.ctx.createGain();
    const vol = Math.min(0.5, intensity * 0.05);
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start();
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v && this.engine) this.engine.gain.gain.value = 0;
  }
}
