import type { Settings } from './game/types';
export class AudioGarden {
  private context: AudioContext | null = null;
  private music: GainNode | null = null;
  private fx: GainNode | null = null;
  private timer = 0;
  private next = 0;
  private step = 0;
  constructor(private settings: Settings) {}
  unlock(): void {
    if (!this.context) {
      this.context = new AudioContext(); this.music = this.context.createGain(); this.fx = this.context.createGain();
      this.music.connect(this.context.destination); this.fx.connect(this.context.destination);
      this.configure(this.settings); this.next = this.context.currentTime + 0.08;
      this.timer = window.setInterval(() => this.schedule(), 180);
    }
    this.context.resume().catch(() => {});
  }
  configure(settings: Settings): void {
    this.settings = settings;
    if (this.context) { this.music!.gain.setTargetAtTime(settings.music * 0.14, this.context.currentTime, 0.04); this.fx!.gain.setTargetAtTime(settings.sfx * 0.2, this.context.currentTime, 0.02); }
  }
  private tone(freq: number, at: number, duration: number, gain: number, dest: GainNode, type: OscillatorType): void {
    const c = this.context!; const o = c.createOscillator(), env = c.createGain();
    o.type = type; o.frequency.value = freq; env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(gain, at + 0.015); env.gain.exponentialRampToValueAtTime(0.001, at + duration);
    o.connect(env); env.connect(dest); o.start(at); o.stop(at + duration + 0.05); o.onended = () => { o.disconnect(); env.disconnect(); };
  }
  private schedule(): void {
    const c = this.context; if (!c || c.state !== 'running') return;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    const melody = [64, 67, 71, 74, 71, 67, 62, 67, 60, 64, 67, 72, 67, 64, 59, 62];
    while (this.next < c.currentTime + 0.5) {
      const note = melody[this.step % melody.length];
      this.tone(440 * 2 ** ((note - 69) / 12), this.next, 0.5, 0.3, this.music!, 'triangle');
      if (this.step % 4 === 0) this.tone(440 * 2 ** (([40, 43, 36, 38][Math.floor(this.step / 4) % 4] - 69) / 12), this.next, 1.1, 0.24, this.music!, 'sine');
      this.next += 0.35; this.step++;
    }
  }
  sound(kind: 'post' | 'purchase' | 'unlock' | 'meta' | 'ending' | 'event'): void {
    if (!this.context || !this.fx) return;
    const notes = kind === 'post' ? [72, 79] : kind === 'purchase' ? [64, 71, 76] : kind === 'ending' ? [60, 64, 67, 72, 76, 79, 84] : kind === 'meta' ? [79, 76, 71, 67, 72, 79] : [67, 72, 76, 84];
    notes.forEach((n, i) => this.tone(440 * 2 ** ((n - 69) / 12), this.context!.currentTime + i * 0.075, 0.25, 0.24, this.fx!, 'triangle'));
  }
  suspend(): void { this.context?.suspend().catch(() => {}); }
  dispose(): void { clearInterval(this.timer); this.context?.close().catch(() => {}); }
}
