import { Pixel, PAL as C, plant } from './pixel';
export function peopleAtlas(outfit: string): HTMLCanvasElement {
  const p = new Pixel(96, 24);
  for (let f = 0; f < 6; f++) {
    const x = f * 16, walk = [0, 1, 0, -1, 0, 0][f], bob = f === 1 || f === 3 ? 1 : 0;
    p.oval(x + 8, 22, 6, 2, C.shadow);
    p.r(x + 5 - walk, 17 + bob, 3, 5 - bob, C.ink); p.r(x + 9 + walk, 17 + bob, 3, 5 - bob, C.ink);
    p.r(x + 4 - walk, 21, 4, 2, C.darkwood); p.r(x + 9 + walk, 21, 4, 2, C.darkwood);
    p.r(x + 4, 10 + bob, 9, 8, C.ink); p.r(x + 5, 11 + bob, 7, 6, outfit); p.r(x + 5, 11 + bob, 2, 5, C.paper);
    p.r(x + 2, (f === 4 ? 7 : 12) + bob, 3, 5, outfit); p.r(x + 2, (f === 4 ? 6 : 16) + bob, 2, 2, C.cream);
    p.r(x + 12, (f === 5 ? 8 : 12) + bob, 2, 5, outfit); p.r(x + 12, (f === 5 ? 7 : 16) + bob, 2, 2, C.cream);
    p.r(x + 4, 2 + bob, 9, 9, C.darkwood); p.r(x + 5, 4 + bob, 7, 6, C.cream); p.r(x + 4, 2 + bob, 8, 3, C.darkwood); p.r(x + 3, 4 + bob, 3, 3, C.darkwood);
    p.r(x + 6, 6 + bob, 1, 1, C.ink); p.r(x + 10, 6 + bob, 1, 1, C.ink); p.r(x + 9, 9 + bob, 2, 1, C.coral);
    p.r(x + 7, 1 + bob, 5, 1, C.wood);
  }
  return p.canvas;
}
const cache = new Map<string, string>();
export function icon(name: string): string {
  const prior = cache.get(name); if (prior) return prior;
  const p = new Pixel(32, 32);
  if (name === 'flower' || name === 'attention') { plant(p, 16, 26, 1, true); }
  else if (name === 'connection' || name === 'salon' || name === 'circle') {
    p.oval(11, 13, 7, 6, C.teal); p.oval(11, 13, 5, 4, C.leaf); p.oval(21, 19, 7, 6, C.grass); p.oval(21, 19, 5, 4, C.light); p.line(13, 15, 20, 18, C.cream, 2);
    p.r(6, 24, 20, 2, C.darkwood); p.r(8, 26, 2, 4, C.wood); p.r(24, 26, 2, 4, C.wood);
  } else if (name === 'insight' || name === 'archive' || name === 'library') {
    p.r(5, 5, 23, 24, C.darkwood); p.r(7, 7, 19, 20, C.shadow);
    [C.coral, C.blue, C.gold, C.lavender].forEach((c, i) => { p.r(8 + i * 4, 8 + i % 2, 3, 8, c); p.r(8 + i * 4, 20 - i % 2, 3, 6, c); }); p.r(5, 17, 23, 2, C.wood);
  } else if (name === 'relay' || name === 'beacon') {
    p.line(7, 29, 15, 6, C.wood, 2); p.line(24, 29, 17, 6, C.wood, 2); p.line(9, 23, 21, 23, C.cream); p.line(11, 16, 19, 16, C.cream); p.r(15, 2, 2, 8, C.gold); p.r(10, 6, 12, 2, C.blue); p.r(5, 1, 2, 5, C.blue); p.r(25, 1, 2, 5, C.blue);
  } else if (name === 'studio') {
    p.r(5, 11, 19, 13, C.coral); p.r(7, 13, 12, 9, C.brick); p.r(8, 14, 8, 6, C.gold); p.poly([[24, 13], [29, 10], [29, 26], [24, 22]], C.cream); p.oval(10, 7, 4, 4, C.wood); p.oval(19, 7, 4, 4, C.wood); p.r(13, 24, 2, 6, C.darkwood);
  } else {
    p.r(4, 23, 25, 3, C.wood); p.r(6, 26, 2, 5, C.darkwood); p.r(25, 26, 2, 5, C.darkwood); p.r(9, 6, 16, 13, C.ink); p.r(11, 8, 12, 9, C.blue); p.r(13, 10, 8, 1, C.cream); p.r(13, 13, 5, 1, C.paper); p.r(16, 19, 2, 4, C.darkwood); p.r(8, 21, 14, 2, C.cream);
  }
  const url = p.canvas.toDataURL(); cache.set(name, url); return url;
}
