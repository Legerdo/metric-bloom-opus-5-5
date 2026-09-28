// Low-level pixel drawing helpers for a 1:1 low-resolution canvas.
// Everything is drawn with integer rects so the result stays crisp when upscaled.

export const PAL = {
  ink: '#0d0b19',
  night0: '#120f24',
  night1: '#1b1836',
  night2: '#262550',
  dusk: '#353a72',
  dusk2: '#4a57a0',
  sky: '#6b86c9',
  skyPale: '#a9c7ef',
  white: '#f6f0e4',
  cream: '#e9dcc3',
  gray: '#9895a8',
  grayD: '#5d5872',
  grayDD: '#3a3650',
  lamp: '#ffd66b',
  lampD: '#f0a64a',
  orange: '#e2763e',
  red: '#d94f5c',
  redD: '#9c3048',
  pink: '#ff7eb6',
  pinkL: '#ffb8d6',
  magenta: '#b04a8f',
  violet: '#7a4fb0',
  lavender: '#a98be0',
  green: '#3fae6f',
  greenL: '#8fe08a',
  greenD: '#23664e',
  teal: '#3fb9b0',
  tealL: '#9cf2e6',
  tealD: '#257a78',
  wood: '#8a5a3c',
  woodL: '#b98457',
  woodD: '#5b3927',
  woodDD: '#3d2519',
  skin: '#f2c29b',
  skinD: '#d99a76',
  hair: '#3a2a3f',
  hairL: '#5a4260',
  wall: '#2d2a55',
  wallL: '#37346a',
  wallD: '#221f44',
} as const;

export type Ctx = CanvasRenderingContext2D;

export function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(x | 0, y | 0, w | 0, h | 0);
}

export function px(c: Ctx, x: number, y: number, col: string): void {
  c.fillStyle = col;
  c.fillRect(x | 0, y | 0, 1, 1);
}

/** Rect with a 1px outline. */
export function orect(c: Ctx, x: number, y: number, w: number, h: number, fill: string, line: string = PAL.ink): void {
  rect(c, x, y, w, h, line);
  rect(c, x + 1, y + 1, w - 2, h - 2, fill);
}

/** Rounded (corner-cut) rect with outline. */
export function rrect(c: Ctx, x: number, y: number, w: number, h: number, fill: string, line: string = PAL.ink): void {
  rect(c, x + 1, y, w - 2, h, line);
  rect(c, x, y + 1, w, h - 2, line);
  rect(c, x + 1, y + 1, w - 2, h - 2, fill);
}

export function hline(c: Ctx, x: number, y: number, w: number, col: string): void {
  rect(c, x, y, w, 1, col);
}
export function vline(c: Ctx, x: number, y: number, h: number, col: string): void {
  rect(c, x, y, 1, h, col);
}

/** Bresenham line. */
export function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string): void {
  x0 |= 0;
  y0 |= 0;
  x1 |= 0;
  y1 |= 0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  c.fillStyle = col;
  for (let i = 0; i < 2000; i++) {
    c.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Filled pixel circle. */
export function disc(c: Ctx, cx: number, cy: number, r: number, col: string): void {
  c.fillStyle = col;
  const r2 = r * r + r * 0.8;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r2 - y * y)));
    c.fillRect((cx - w) | 0, (cy + y) | 0, w * 2 + 1, 1);
  }
}

/** Pixel ring (circle outline). */
export function ring(c: Ctx, cx: number, cy: number, r: number, col: string): void {
  c.fillStyle = col;
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    const pts = [
      [x, y],
      [y, x],
      [-y, x],
      [-x, y],
      [-x, -y],
      [-y, -x],
      [y, -x],
      [x, -y],
    ];
    for (const [a, b] of pts) c.fillRect((cx + a) | 0, (cy + b) | 0, 1, 1);
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

/** Ordered 2x2 dither between two colours. t in [0,1]. */
export function dither(c: Ctx, x: number, y: number, w: number, h: number, a: string, b: string, t: number): void {
  rect(c, x, y, w, h, a);
  if (t <= 0) return;
  c.fillStyle = b;
  const th = [0.125, 0.625, 0.875, 0.375];
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const k = th[(xx & 1) + ((yy & 1) << 1)];
      if (t > k) c.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}

/** Vertical banded gradient with dithered transitions between palette colours. */
export function vgrad(c: Ctx, x: number, y: number, w: number, h: number, cols: readonly string[]): void {
  const bands = cols.length - 1;
  if (bands <= 0) {
    rect(c, x, y, w, h, cols[0]);
    return;
  }
  const bh = h / bands;
  for (let i = 0; i < bands; i++) {
    const y0 = Math.round(y + i * bh);
    const y1 = Math.round(y + (i + 1) * bh);
    const hh = y1 - y0;
    const solid = Math.floor(hh * 0.55);
    rect(c, x, y0, w, solid, cols[i]);
    const dh = hh - solid;
    for (let k = 0; k < dh; k++) {
      dither(c, x, y0 + solid + k, w, 1, cols[i], cols[i + 1], (k + 1) / (dh + 1));
    }
  }
}

// ── string sprites ──────────────────────────────────────────────────────────
export type SpriteMap = Record<string, string>;

/** Draw a sprite given as rows of palette keys ('.' = transparent). */
export function sprite(c: Ctx, rows: readonly string[], map: SpriteMap, x: number, y: number, flip = false): void {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[flip ? row.length - 1 - i : i];
      if (ch === '.' || ch === ' ') continue;
      const col = map[ch];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect((x + i) | 0, (y + j) | 0, 1, 1);
    }
  }
}

/** Mirror left-half rows into full symmetric rows. */
export function mirror(rows: readonly string[], odd = false): string[] {
  return rows.map((r) => r + r.split('').reverse().join('').slice(odd ? 1 : 0));
}

// ── tiny 3x5 font for in-world signage ─────────────────────────────────────
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['#.#', '###', '###', '###', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  ' ': ['...', '...', '...', '...', '...'],
};

export function tinyText(c: Ctx, text: string, x: number, y: number, col: string): number {
  c.fillStyle = col;
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch];
    if (!g) {
      cx += 4;
      continue;
    }
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j][i] === '#') c.fillRect(cx + i, y + j, 1, 1);
    cx += 4;
  }
  return cx - x - 1;
}

/** Seeded hash → [0,1) for stable procedural layouts. */
export function hash01(n: number): number {
  let x = (n | 0) ^ 0x2c1b3c6d;
  x = Math.imul(x ^ (x >>> 16), 0x297a2d39);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}
