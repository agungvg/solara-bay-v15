// audio.js — fully synthesised sound: no audio files, no network.
// Engine hum (sawtooth through a low-pass, pitch follows speed), two-tone KPD
// siren, gunshot noise bursts, UI blips and a tiny radio jingle. Everything is
// guarded: the AudioContext only starts after a user gesture, and every call
// is a no-op while it is suspended (screenshots stay silent and error-free).
export class SynthAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenTimer = null;
    this.radioTimer = null;
    this.enabled = true;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth + low-pass, always running once started.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      return true;
    } catch { return false; }
  }

  setEngine(speedKmh, inVehicle) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = inVehicle ? 0.05 + Math.min(0.16, speedKmh / 900) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speedKmh * 1.1, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(380 + speedKmh * 6, t, 0.1);
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenTimer) {
      let high = true;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const g = this.ctx.createGain();
      g.gain.value = 0.0;
      osc.connect(g).connect(this.master);
      osc.start();
      this.sirenTimer = setInterval(() => {
        if (!this.ctx) return;
        high = !high;
        osc.frequency.setTargetAtTime(high ? 880 : 660, this.ctx.currentTime, 0.05);
        g.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.05);
      }, 420);
      this._sirenOsc = osc; this._sirenGain = g;
    } else if (!on && this.sirenTimer) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      try { this._sirenOsc.stop(); } catch { /* already stopped */ }
    }
  }

  shot() {
    if (!this.ctx) return;
    const dur = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g).connect(this.master);
    src.start();
  }

  blip(freq = 660) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.18, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    o.connect(g).connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + 0.13);
  }

  // Radio Mango jingle: a tiny 4-note loop on a triangle wave.
  radioJingle() {
    if (!this.ctx || this.radioTimer) return;
    const notes = [523.25, 659.25, 783.99, 659.25];
    let i = 0;
    this.radioTimer = setInterval(() => {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = notes[i % notes.length];
      g.gain.setValueAtTime(0.06, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      o.connect(g).connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + 0.42);
      i++;
    }, 480);
  }

  stopRadio() {
    if (this.radioTimer) { clearInterval(this.radioTimer); this.radioTimer = null; }
  }
}
