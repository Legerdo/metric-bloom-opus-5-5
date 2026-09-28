// Pooled particles in world space (hearts, post cards, sparks, petals) and
// screen-space text popups. Visual only: never touches the economy.
import { PAL, rect, px, type Ctx } from './pix';

export type PKind = 'heart' | 'card' | 'spark' | 'petal' | 'confetti' | 'ring';

export interface Particle {
  on: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  col2: string;
  size: number;
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  spin: number;
}

export interface Popup {
  on: boolean;
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  col: string;
  big: boolean;
}

const MAX_P = 420;
const MAX_POP = 40;

export class Fx {
  ps: Particle[] = [];
  pops: Popup[] = [];
  reduced = false;

  constructor() {
    for (let i = 0; i < MAX_P; i++)
      this.ps.push({ on: false, kind: 'heart', x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: PAL.pink, col2: PAL.pinkL, size: 1, tx: 0, ty: 0, sx: 0, sy: 0, spin: 0 });
    for (let i = 0; i < MAX_POP; i++) this.pops.push({ on: false, text: '', x: 0, y: 0, vy: 0, life: 0, max: 1, col: PAL.white, big: false });
  }

  count(): number {
    let n = 0;
    for (const p of this.ps) if (p.on) n++;
    return n;
  }

  private alloc(): Particle | null {
    for (const p of this.ps) if (!p.on) return p;
    return null;
  }

  spawn(kind: PKind, x: number, y: number, vx: number, vy: number, life: number, col: string = PAL.pink, extra: Partial<Particle> = {}): Particle | null {
    if (this.reduced && kind === 'ring') return null;
    if (this.reduced && (kind === 'spark' || kind === 'confetti') && Math.random() < 0.6) return null;
    const p = this.alloc();
    if (!p) return null;
    p.on = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = 0;
    p.max = life;
    p.col = col;
    p.col2 = extra.col2 ?? PAL.pinkL;
    p.size = extra.size ?? 1;
    p.tx = extra.tx ?? x;
    p.ty = extra.ty ?? y;
    p.sx = x;
    p.sy = y;
    p.spin = extra.spin ?? Math.random() * 6;
    return p;
  }

  /** A post card that flies from (x,y) to (tx,ty) on an arc, then bursts into hearts. */
  card(x: number, y: number, tx: number, ty: number, col: string, dur = 1.1): void {
    this.spawn('card', x, y, 0, 0, dur, col, { tx, ty });
  }

  hearts(x: number, y: number, n: number, spread = 6): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 6 + Math.random() * 14;
      this.spawn('heart', x + (Math.random() - 0.5) * spread, y, Math.cos(a) * s * 0.6, -12 - Math.random() * 16 + Math.sin(a) * 4, 1.4 + Math.random() * 0.9, Math.random() < 0.2 ? PAL.red : PAL.pink);
    }
  }

  sparks(x: number, y: number, n: number, col: string = PAL.lamp, speed = 30): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.spawn('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.6, col);
    }
  }

  confetti(x: number, y: number, n: number): void {
    const cols = [PAL.pink, PAL.lamp, PAL.teal, PAL.lavender, PAL.greenL, PAL.orange];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const s = 40 + Math.random() * 60;
      this.spawn('confetti', x, y, Math.cos(a) * s, Math.sin(a) * s, 1.6 + Math.random(), cols[i % cols.length]);
    }
  }

  petals(x0: number, x1: number, y: number, n: number, cols: string[]): void {
    for (let i = 0; i < n; i++) {
      this.spawn('petal', x0 + Math.random() * (x1 - x0), y + Math.random() * 10, (Math.random() - 0.5) * 8, 8 + Math.random() * 10, 5 + Math.random() * 4, cols[i % cols.length]);
    }
  }

  ringPulse(x: number, y: number, col: string, life = 0.8, size = 20): void {
    this.spawn('ring', x, y, 0, 0, life, col, { size });
  }

  popup(text: string, x: number, y: number, col: string = PAL.white, big = false): void {
    let slot: Popup | null = null;
    let oldest: Popup | null = null;
    for (const p of this.pops) {
      if (!p.on) {
        slot = p;
        break;
      }
      if (!oldest || p.life / p.max > oldest.life / oldest.max) oldest = p;
    }
    if (!slot) slot = oldest;
    if (!slot) return;
    slot.on = true;
    slot.text = text;
    slot.x = x;
    slot.y = y;
    slot.vy = big ? -10 : -16;
    slot.life = 0;
    slot.max = big ? 2.2 : 1.2;
    slot.col = col;
    slot.big = big;
  }

  update(dt: number): void {
    for (const p of this.ps) {
      if (!p.on) continue;
      p.life += dt;
      if (p.life >= p.max) {
        if (p.kind === 'card') this.hearts(p.tx, p.ty, 3, 4);
        p.on = false;
        continue;
      }
      switch (p.kind) {
        case 'card': {
          const k = p.life / p.max;
          const e = k * k * (3 - 2 * k);
          p.x = p.sx + (p.tx - p.sx) * e;
          p.y = p.sy + (p.ty - p.sy) * e - Math.sin(k * Math.PI) * 18;
          break;
        }
        case 'heart':
          p.vx *= 0.96;
          p.vy += -2 * dt;
          p.x += (p.vx + Math.sin(p.life * 5 + p.spin) * 4) * dt;
          p.y += p.vy * dt;
          break;
        case 'spark':
          p.vx *= 0.92;
          p.vy = p.vy * 0.92 + 20 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case 'confetti':
          p.vx *= 0.97;
          p.vy += 60 * dt;
          p.vy *= 0.97;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        case 'petal':
          p.x += (p.vx + Math.sin(p.life * 1.7 + p.spin) * 10) * dt;
          p.y += p.vy * dt;
          break;
        case 'ring':
          break;
      }
    }
    for (const p of this.pops) {
      if (!p.on) continue;
      p.life += dt;
      p.y += p.vy * dt;
      p.vy *= 0.97;
      if (p.life >= p.max) p.on = false;
    }
  }

  /** Draw world particles into the low-res buffer, applying the camera transform. */
  draw(c: Ctx, camX: number, camY: number, zoom: number): void {
    for (const p of this.ps) {
      if (!p.on) continue;
      const x = Math.round((p.x - camX) * zoom);
      const y = Math.round((p.y - camY) * zoom);
      const k = p.life / p.max;
      switch (p.kind) {
        case 'heart': {
          if (k > 0.85 && ((p.life * 20) | 0) % 2 === 0) break;
          heart(c, x - 2, y - 2, p.col, zoom >= 2);
          break;
        }
        case 'card': {
          const s = zoom >= 2 ? 2 : 1;
          const w = 5 * s;
          const h = 6 * s;
          rect(c, x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2, PAL.ink);
          rect(c, x - w / 2, y - h / 2, w, h, PAL.white);
          rect(c, x - w / 2 + s, y - h / 2 + s, w - 2 * s, 2 * s, p.col);
          rect(c, x - w / 2 + s, y + s, w - 3 * s, s, PAL.grayD);
          break;
        }
        case 'spark':
          if (k < 0.5 || ((p.life * 30) | 0) % 2 === 0) px(c, x, y, p.col);
          break;
        case 'confetti':
          rect(c, x, y, 2, (p.life * 8) % 2 < 1 ? 1 : 2, p.col);
          break;
        case 'petal': {
          const f = ((p.life * 3 + p.spin) | 0) % 3;
          if (f === 0) rect(c, x, y, 2, 1, p.col);
          else if (f === 1) rect(c, x, y, 1, 2, p.col);
          else px(c, x, y, p.col);
          if (k > 0.9) break;
          break;
        }
        case 'ring': {
          const r = Math.round(p.size * k * zoom);
          ringPix(c, x, y, r, p.col, k);
          break;
        }
      }
    }
  }
}

export function heart(c: Ctx, x: number, y: number, col: string, big = false): void {
  if (big) {
    // 7x6
    rect(c, x + 1, y, 2, 1, col);
    rect(c, x + 4, y, 2, 1, col);
    rect(c, x, y + 1, 7, 2, col);
    rect(c, x + 1, y + 3, 5, 1, col);
    rect(c, x + 2, y + 4, 3, 1, col);
    px(c, x + 3, y + 5, col);
    px(c, x + 1, y + 1, PAL.white);
    return;
  }
  // 5x4
  px(c, x + 1, y, col);
  px(c, x + 3, y, col);
  rect(c, x, y + 1, 5, 1, col);
  rect(c, x + 1, y + 2, 3, 1, col);
  px(c, x + 2, y + 3, col);
}

function ringPix(c: Ctx, cx: number, cy: number, r: number, col: string, k: number): void {
  if (r <= 0) return;
  c.fillStyle = col;
  const n = Math.max(12, r * 6);
  for (let i = 0; i < n; i++) {
    if (k > 0.6 && i % 2 === 1) continue;
    const a = (i / n) * Math.PI * 2;
    c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}
