// Web Audio synth: chiptune-style SFX and a layered lo-fi loop whose
// arrangement grows with the player's progress. Created on first user gesture.

export type Sfx =
  | 'echo'
  | 'resolve'
  | 'post'
  | 'reply'
  | 'buy'
  | 'upgrade'
  | 'milestone'
  | 'unlock'
  | 'viral'
  | 'trend'
  | 'join'
  | 'comment'
  | 'prestige'
  | 'petal'
  | 'ending'
  | 'error'
  | 'click'
  | 'spot';

const NOTE = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

// Fmaj7 – Em7 – Dm7 – Cmaj7 (MIDI notes)
const CHORDS = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];
const PENTA = [72, 74, 76, 79, 81, 84];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private lp: BiquadFilterNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private lastPlayed: Record<string, number> = {};
  musicVol = 0.5;
  sfxVol = 0.7;
  intensity = 0;
  started = false;

  /** Must be called from a user gesture handler. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 2400;
    this.music = ctx.createGain();
    this.music.connect(this.lp);
    this.lp.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.applyVolumes();
    const len = Math.floor(ctx.sampleRate * 0.5);
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.started = true;
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = Math.max(0, Math.min(1, music));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.music || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * 0.32, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol * 0.5, t, 0.02);
  }

  setIntensity(level: number): void {
    this.intensity = Math.max(0, Math.min(5, level));
    if (this.lp && this.ctx) this.lp.frequency.setTargetAtTime(1800 + this.intensity * 700, this.ctx.currentTime, 1.5);
  }

  // ── primitives ────────────────────────────────────────────────────────────
  private tone(bus: GainNode, freq: number, t0: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, attack = 0.004): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(bus: GainNode, t0: number, dur: number, vol: number, hp = 4000, bp?: number): void {
    const ctx = this.ctx!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = bp ? 'bandpass' : 'highpass';
    f.frequency.value = bp ?? hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name: Sfx): void {
    if (!this.ctx || !this.sfxBus || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    const minGap: Partial<Record<Sfx, number>> = { comment: 0.25, post: 0.04, buy: 0.05, reply: 0.05, spot: 0.05 };
    const last = this.lastPlayed[name] ?? -1;
    if (now - last < (minGap[name] ?? 0.03)) return;
    this.lastPlayed[name] = now;
    const b = this.sfxBus;
    const t = now + 0.005;
    switch (name) {
      case 'echo':
        this.tone(b, 740, t, 0.3, 'sine', 0.11);
        this.tone(b, 733, t + 0.09, 0.4, 'triangle', 0.06);
        this.tone(b, 370, t + 0.34, 0.5, 'sine', 0.07);
        break;
      case 'resolve':
        [523, 659, 988, 1047].forEach((f, i) => this.tone(b, f, t + i * 0.09, 0.45, 'sine', 0.11));
        break;
      case 'post':
        this.tone(b, 660 + Math.random() * 40, t, 0.09, 'square', 0.12, 1050);
        this.tone(b, 1320, t + 0.05, 0.08, 'triangle', 0.1);
        break;
      case 'spot':
        this.tone(b, 880, t, 0.12, 'triangle', 0.14, 1760);
        this.tone(b, 1760, t + 0.06, 0.1, 'sine', 0.08);
        break;
      case 'reply':
        this.tone(b, 880, t, 0.06, 'sine', 0.2);
        this.tone(b, 1175, t + 0.06, 0.1, 'sine', 0.18);
        break;
      case 'comment':
        this.tone(b, 1400, t, 0.05, 'sine', 0.05);
        break;
      case 'buy':
        this.tone(b, 523, t, 0.06, 'square', 0.1);
        this.tone(b, 784, t + 0.06, 0.1, 'square', 0.1);
        break;
      case 'upgrade':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(b, f, t + i * 0.05, 0.14, 'square', 0.09));
        break;
      case 'milestone':
        [60, 64, 67, 72].forEach((n, i) => this.tone(b, NOTE(n), t + i * 0.07, 0.6, 'triangle', 0.16));
        [84, 88, 91].forEach((n, i) => this.tone(b, NOTE(n), t + 0.3 + i * 0.06, 0.25, 'sine', 0.08));
        break;
      case 'unlock':
        this.noise(b, t, 0.35, 0.08, 2000);
        this.tone(b, 1568, t + 0.12, 0.4, 'sine', 0.14);
        this.tone(b, 2093, t + 0.2, 0.5, 'sine', 0.1);
        break;
      case 'viral':
        this.tone(b, 300, t, 0.5, 'square', 0.08, 1200);
        [67, 71, 74, 79].forEach((n, i) => this.tone(b, NOTE(n), t + 0.35 + i * 0.05, 0.5, 'triangle', 0.14));
        break;
      case 'trend':
        this.tone(b, 988, t, 0.18, 'triangle', 0.14);
        this.tone(b, 740, t + 0.18, 0.3, 'triangle', 0.14);
        break;
      case 'join':
        this.noise(b, t, 0.12, 0.1, 0, 1800);
        [72, 76, 79, 84].forEach((n, i) => this.tone(b, NOTE(n), t + 0.05 + i * 0.04, 0.12, 'square', 0.07));
        break;
      case 'prestige': {
        const ctx = this.ctx;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(300, t);
        f.frequency.exponentialRampToValueAtTime(5000, t + 2.2);
        f.connect(b);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 1.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
        g.connect(f);
        for (const n of [48, 55, 60, 64, 67]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = NOTE(n);
          o.detune.value = (Math.random() - 0.5) * 12;
          o.connect(g);
          o.start(t);
          o.stop(t + 3.3);
        }
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(b, NOTE(n), t + 1.2 + i * 0.12, 0.8, 'sine', 0.08));
        break;
      }
      case 'petal':
        this.tone(b, 1047, t, 1.4, 'sine', 0.16);
        this.tone(b, 2094, t, 0.9, 'sine', 0.06);
        this.tone(b, 1568, t + 0.15, 1.2, 'sine', 0.08);
        break;
      case 'ending': {
        const mel = [72, 76, 79, 84, 83, 79, 81, 84, 88];
        mel.forEach((n, i) => this.tone(b, NOTE(n), t + i * 0.28, 0.6, 'triangle', 0.14));
        [48, 55, 64].forEach((n) => this.tone(b, NOTE(n), t, 2.6, 'triangle', 0.1, undefined, 0.3));
        break;
      }
      case 'error':
        this.tone(b, 160, t, 0.12, 'square', 0.08);
        break;
      case 'click':
        this.tone(b, 1200, t, 0.03, 'square', 0.05);
        break;
    }
  }

  // ── music ─────────────────────────────────────────────────────────────────
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.music || ctx.state !== 'running') return;
    const spb = 60 / 84 / 2; // eighth notes at 84 BPM
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number, spb: number): void {
    if (this.musicVol <= 0) return;
    const m = this.music!;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = CHORDS[bar];
    const L = this.intensity;
    // pad
    if (s === 0) for (const n of chord) this.tone(m, NOTE(n + 12), t, spb * 15, 'triangle', 0.05, undefined, 0.4);
    // bass
    if (L >= 1 && (s === 0 || s === 8 || (L >= 3 && s === 14))) this.tone(m, NOTE(chord[0] - 12), t, spb * (s === 14 ? 1.5 : 5), 'triangle', 0.16, undefined, 0.01);
    // arp
    if (L >= 2 && s % 2 === 0) {
      const n = chord[(s / 2) % 4] + 12 + (s >= 8 ? 12 : 0);
      this.tone(m, NOTE(n), t, spb * 0.9, 'square', 0.025);
    }
    // drums
    if (L >= 3) {
      if (s === 0 || s === 8 || (L >= 5 && s === 10)) this.tone(m, 120, t, 0.18, 'sine', 0.28, 40);
      if (s % 2 === 1 || L >= 5) this.noise(m, t, 0.04, s % 4 === 3 ? 0.05 : 0.03, 7000);
    }
    if (L >= 4 && (s === 4 || s === 12)) this.noise(m, t, 0.14, 0.09, 0, 1500);
    // lead
    if (L >= 4) {
      const seed = (bar * 16 + s) * 2654435761;
      const h = ((seed >>> 0) % 1000) / 1000;
      if ((s % 4 === 0 && h < 0.6) || (s % 2 === 1 && h < 0.12)) {
        const n = PENTA[Math.floor(h * 997) % PENTA.length] - (L >= 5 ? 0 : 12);
        this.tone(m, NOTE(n), t, spb * 1.6, 'square', 0.035);
      }
    }
  }
}

export const audio = new AudioEngine();
