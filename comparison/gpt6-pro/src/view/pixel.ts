/** All art is authored here on an integer grid. No network assets, filters or antialiased primitives. */
export const PAL = {
  ink: '#172e35', shadow: '#243e44', deep: '#35555b', teal: '#487475', mist: '#71938c',
  grass: '#699c81', leaf: '#94be91', light: '#c7d8a1', cream: '#f2deb0', paper: '#faebcd',
  coral: '#dc8e7b', rose: '#b56865', brick: '#81545a', wood: '#a7826b', darkwood: '#634f51',
  gold: '#edbd76', lavender: '#b7a4cf', water: '#34565f', blue: '#82b5b4',
};
export class Pixel {
  readonly canvas: HTMLCanvasElement;
  readonly c: CanvasRenderingContext2D;
  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
    this.c = this.canvas.getContext('2d')!; this.c.imageSmoothingEnabled = false;
  }
  r(x: number, y: number, w: number, h: number, color: string): void { this.c.fillStyle = color; this.c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  line(x1: number, y1: number, x2: number, y2: number, color: string, thick = 1): void {
    let x = Math.round(x1), y = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
    const dx = Math.abs(x2 - x), sx = x < x2 ? 1 : -1, dy = -Math.abs(y2 - y), sy = y < y2 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 3000; n++) { this.r(x, y, thick, thick, color); if (x === x2 && y === y2) break; const e = 2 * err; if (e >= dy) { err += dy; x += sx; } if (e <= dx) { err += dx; y += sy; } }
  }
  oval(x: number, y: number, rx: number, ry: number, color: string): void {
    for (let dy = -Math.floor(ry); dy <= ry; dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - dy * dy / (ry * ry)))); this.r(x - w, y + dy, w * 2 + 1, 1, color); }
  }
  poly(points: number[][], color: string): void {
    const min = Math.ceil(Math.min(...points.map(p => p[1]))), max = Math.floor(Math.max(...points.map(p => p[1])));
    for (let y = min; y <= max; y++) {
      const hits: number[] = [];
      for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hits.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      hits.sort((a, b) => a - b); for (let i = 0; i + 1 < hits.length; i += 2) this.r(Math.ceil(hits[i]), y, Math.floor(hits[i + 1]) - Math.ceil(hits[i]) + 1, 1, color);
    }
  }
}
export function plant(p: Pixel, x: number, y: number, size = 1, flower = false): void {
  const c = PAL;
  p.r(x - 4 * size, y - 4 * size, 9 * size, 4 * size, c.wood); p.r(x - 3 * size, y, 7 * size, 5 * size, c.brick); p.r(x - size, y, 2 * size, 4 * size, c.coral);
  p.line(x, y - 4 * size, x, y - 18 * size, c.grass, 2 * size);
  p.oval(x - 4 * size, y - 11 * size, 5 * size, 2 * size, c.leaf); p.oval(x + 4 * size, y - 16 * size, 5 * size, 2 * size, c.grass);
  if (flower) { p.oval(x, y - 20 * size, 5 * size, 3 * size, c.coral); p.r(x - size, y - 21 * size, 2 * size, 2 * size, c.gold); }
}
export function tree(p: Pixel, x: number, y: number, size = 1, blooming = false): void {
  const c = PAL;
  p.oval(x + 1, y + 3, 21 * size, 5 * size, c.shadow);
  p.r(x - 3 * size, y - 24 * size, 6 * size, 28 * size, c.darkwood); p.r(x, y - 20 * size, 2 * size, 24 * size, c.wood);
  p.line(x, y - 10 * size, x - 13 * size, y - 30 * size, c.darkwood, 3 * size);
  p.line(x + 2, y - 16 * size, x + 12 * size, y - 36 * size, c.wood, 2 * size);
  const lobes = [[-15, -32, 15, 12], [14, -37, 17, 14], [-2, -46, 22, 17], [-4, -26, 24, 12]];
  lobes.forEach(([dx, dy, rx, ry], i) => {
    p.oval(x + dx * size, y + dy * size, rx * size, ry * size, blooming ? c.rose : c.deep);
    p.oval(x + (dx - 2) * size, y + (dy - 3) * size, (rx - 2) * size, (ry - 3) * size, blooming ? c.coral : c.grass);
    p.oval(x + (dx - 4) * size, y + (dy - 6) * size, (rx - 6) * size, (ry - 7) * size, blooming ? c.cream : c.leaf);
    for (let j = 0; j < 4; j++) p.r(x + (dx - 8 + j * 5) * size, y + (dy + (j + i) % 3 * 3) * size, 2 * size, size, blooming ? c.gold : c.light);
  });
}
export function lamp(p: Pixel, x: number, y: number): void {
  const c = PAL; p.r(x, y - 29, 2, 31, c.darkwood); p.r(x - 3, y - 31, 8, 2, c.wood); p.r(x - 2, y - 29, 6, 7, c.gold); p.r(x, y - 28, 2, 5, c.paper); p.r(x - 3, y - 22, 8, 2, c.brick); p.oval(x + 1, y + 2, 6, 2, c.shadow);
}
