// ============================================================================
// Procedural Web Audio Synthesizer — Kaya Wood Stone Clack & Dojo Chimes
// ============================================================================

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  _ensureCtx() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(flag) {
    this.enabled = Boolean(flag);
  }

  playStone(isCapture = false) {
    const ctx = this._ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Sharp woody click transient (bandpass-filtered short noise burst)
    const bufferSize = Math.floor(ctx.sampleRate * 0.045);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (ctx.sampleRate * 0.0045));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1650 + Math.random() * 260, now);
    filter.Q.setValueAtTime(1.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // 2. Warm Kaya wood body resonance (short low-mid sine thump)
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const baseFreq = 260 + Math.random() * 28;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(115, now + 0.055);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.24, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);

    // 3. Secondary stone-clink if capturing
    if (isCapture) {
      setTimeout(() => this._playCaptureRattle(), 55);
    }
  }

  _playCaptureRattle() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    for (let k = 0; k < 2; k++) {
      const t = now + k * 0.045;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1900 + k * 340, t);
      osc.frequency.exponentialRampToValueAtTime(980, t + 0.03);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    }
  }

  playSolved() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Warm pentatonic ascending chime (C5 -> E5 -> G5)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const t = now + i * 0.085;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  playSoftError() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 0.14);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }
}

export const sound = new SoundEngine();
