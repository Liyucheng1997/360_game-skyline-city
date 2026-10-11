// 轻量合成音效（WebAudio，无需音频文件）
export class Audio {
  constructor() {
    this.on = true;
    this.ctx = null;
    this.last = {};
  }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.on = false; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  toggle() { this.on = !this.on; return this.on; }

  tone(freq, dur, type = 'sine', vol = 0.12, delay = 0, slide = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noise(dur, vol = 0.15, freq = 800) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination);
    s.start();
  }
  play(name) {
    if (!this.on || !this.ensure()) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 60) return;
    this.last[name] = now;
    switch (name) {
      case 'click': this.tone(880, 0.06, 'triangle', 0.05); break;
      case 'build': this.tone(180, 0.12, 'square', 0.06, 0, -80); this.noise(0.15, 0.12, 600); break;
      case 'zone': this.tone(660, 0.08, 'sine', 0.07); this.tone(990, 0.1, 'sine', 0.05, 0.05); break;
      case 'bulldoze': this.noise(0.35, 0.22, 400); this.tone(90, 0.3, 'sawtooth', 0.04, 0, -40); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.04); this.tone(1319, 0.18, 'square', 0.04, 0.08); break;
      case 'bad': this.tone(220, 0.15, 'sawtooth', 0.05); this.tone(180, 0.2, 'sawtooth', 0.05, 0.1); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.08, i * 0.11)); break;
    }
  }
}
