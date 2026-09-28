import { Pixel, PAL as C, plant, tree, lamp } from './pixel';

function island(p: Pixel, x: number, y: number, w: number, depth = 34): void {
  p.poly([[x + 8, y + 16], [x + w, y + 16], [x + w - 10, y + 44 + depth], [x + 20, y + 48 + depth], [x, y + 32]], C.ink);
  p.poly([[x + 1, y + 22], [x + w - 2, y + 22], [x + w - 14, y + 40 + depth], [x + 22, y + 44 + depth]], C.brick);
  p.poly([[x + 14, y + 27], [x + w - 18, y + 27], [x + w - 20, y + 38 + depth], [x + 23, y + 41 + depth]], C.darkwood);
  for (let yy = y + 42; yy < y + depth + 40; yy += 7) for (let xx = x + 24; xx < x + w - 20; xx += 17) p.r(xx + (yy % 2) * 7, yy, 12, 1, C.brick);
  p.poly([[x + 13, y], [x + w - 19, y], [x + w, y + 18], [x + w - 10, y + 43], [x + 12, y + 46], [x, y + 27]], C.mist);
  p.poly([[x + 14, y + 4], [x + w - 22, y + 4], [x + w - 4, y + 18], [x + w - 15, y + 37], [x + 13, y + 40], [x + 5, y + 25]], C.grass);
  p.line(x + 12, y + 44, x + w - 12, y + 41, C.leaf, 2);
  for (let i = 0; i < w / 14; i++) {
    const xx = x + 13 + i * 13, yy = y + 13 + (i * 7 % 23);
    p.r(xx, yy, 3, 1, C.leaf); p.r(xx + 1, yy - 2, 1, 3, C.leaf);
    if (i % 3 === 0) { p.r(xx, y + 43, 3, 8 + i % 12, C.deep); p.r(xx - 2, y + 49, 7, 3, C.grass); p.r(xx + 1, y + 54, 5, 2, C.leaf); }
  }
}
function windowBox(p: Pixel, x: number, y: number, w = 12, h = 17): void {
  p.r(x - 2, y - 2, w + 4, h + 4, C.darkwood); p.r(x, y, w, h, C.gold); p.r(x + 1, y + 1, w - 3, h - 3, C.cream);
  p.r(x + w / 2, y, 1, h, C.wood); p.r(x, y + h / 2, w, 1, C.wood); p.r(x - 3, y + h + 1, w + 6, 3, C.wood);
}
function house(p: Pixel, x: number, y: number, w: number, h: number, roof = C.coral, shop = false): void {
  p.oval(x + w / 2 + 8, y + 6, w / 2 + 12, 9, C.deep);
  p.r(x, y - h, w, h, C.cream); p.r(x + w - 13, y - h, 13, h, C.wood);
  p.r(x + 3, y - h + 3, w - 19, h - 6, C.paper); p.r(x, y - 5, w, 5, C.brick);
  for (let yy = y - h + 10; yy < y - 8; yy += 11) { p.r(x + 5, yy, w - 23, 1, C.cream); p.r(x + w - 11, yy, 8, 1, C.darkwood); }
  p.poly([[x - 8, y - h + 1], [x + 7, y - h - 25], [x + w - 17, y - h - 25], [x + w + 6, y - h + 1]], C.darkwood);
  p.poly([[x - 5, y - h - 2], [x + 9, y - h - 23], [x + w - 19, y - h - 23], [x + w + 1, y - h - 2]], roof);
  for (let dy = 5; dy <= 20; dy += 5) p.line(x + 8 - dy / 2, y - h - 23 + dy, x + w - 19 + dy * 0.8, y - h - 23 + dy, C.rose);
  for (let dx = 15; dx < w - 20; dx += 10) p.line(x + dx, y - h - 22, x + dx - 6, y - h - 3, C.gold);
  p.r(x + w - 26, y - h - 34, 9, 21, C.brick); p.r(x + w - 28, y - h - 35, 13, 4, C.wood);
  p.r(x + w - 24, y - h - 29, 6, 2, C.coral);
  windowBox(p, x + 10, y - h + 12);
  if (w > 60) windowBox(p, x + 34, y - h + 12);
  p.r(x + w - 33, y - 26, 16, 21, C.darkwood); p.r(x + w - 30, y - 23, 10, 18, C.teal); p.r(x + w - 23, y - 15, 2, 2, C.gold);
  if (shop) {
    p.r(x + 5, y - 23, w - 43, 15, C.shadow);
    p.r(x + 3, y - 27, w - 39, 7, C.coral);
    for (let i = 0; i < w - 43; i += 9) p.r(x + 4 + i, y - 27, 4, 9, C.cream);
    p.r(x + 5, y - 8, w - 40, 3, C.wood);
  }
  p.r(x + w - 37, y, 27, 3, C.mist); p.r(x + w - 39, y + 3, 29, 3, C.light);
}
function bridge(p: Pixel, ax: number, ay: number, bx: number, by: number): void {
  p.line(ax, ay + 4, bx, by + 4, C.ink, 10); p.line(ax, ay, bx, by, C.darkwood, 10); p.line(ax, ay, bx, by, C.wood, 7);
  const n = Math.hypot(bx - ax, by - ay) / 6;
  for (let i = 0; i < n; i++) p.line(ax + (bx - ax) * i / n, ay + (by - ay) * i / n, ax + (bx - ax) * i / n + 7, ay + (by - ay) * i / n, C.cream);
  p.line(ax, ay - 8, bx, by - 8, C.wood);
  for (let i = 0; i <= 4; i++) p.r(ax + (bx - ax) * i / 4, ay + (by - ay) * i / 4 - 10, 2, 14, C.darkwood);
}
function books(p: Pixel, x: number, y: number): void {
  p.r(x, y - 25, 25, 27, C.darkwood); p.r(x + 2, y - 23, 21, 23, C.shadow);
  for (let row = 0; row < 2; row++) { for (let i = 0; i < 6; i++) { p.r(x + 3 + i * 3, y - 21 + row * 12, 2, 7 + i % 3, [C.coral, C.blue, C.gold, C.lavender][i % 4]); } p.r(x, y - 11 + row * 12, 25, 2, C.wood); }
}

export function drawWorld(stage: number, ending: boolean): HTMLCanvasElement {
  const p = new Pixel(640, 360);
  p.r(0, 0, 640, 360, C.ink);
  const sky = ['#354c59', '#4d6268', '#6d7e7c', '#9a9e8c', '#c3b595'];
  sky.forEach((c, i) => p.r(0, i * 30, 640, 32, c));
  p.oval(490, 61, 29, 29, C.coral); p.oval(488, 59, 26, 26, C.gold);
  [58, 69, 80].forEach((y, i) => p.r(450, y, 82, i + 1, sky[Math.floor(y / 30)]));
  [[57, 47, 55], [210, 31, 63], [378, 91, 42], [549, 115, 72]].forEach(([x, y, w]) => {
    p.r(x, y, w, 3, C.mist); p.r(x + 9, y - 3, w - 22, 4, C.mist); p.r(x - 6, y + 4, w + 16, 2, C.mist);
  });
  for (let i = 0; i < 27; i++) {
    const x = i * 27 - 12, height = 17 + (i * 17 % 34), base = 154 + i % 3 * 7;
    p.r(x, base - height, 23, height + 30, i % 2 ? C.deep : C.teal);
    p.r(x + 3, base - height - 5, 16, 6, C.teal);
    if (i % 4 === 0) p.r(x + 15, base - height - 14, 2, 14, C.teal);
    for (let y = base - height + 8; y < base; y += 9) for (let k = 4; k < 20; k += 8) if ((y + k + i) % 3 === 0) p.r(x + k, y, 3, 4, C.mist);
  }
  p.r(0, 174, 640, 186, C.water);
  for (let i = 0; i < 115; i++) { const x = (i * 127 + 41) % 640, y = 178 + (i * 47 % 178); p.r(x, y, 4 + i % 16, 1, i % 3 ? C.deep : C.teal); }
  p.poly([[0, 171], [60, 163], [152, 185], [136, 231], [54, 220], [0, 239]], C.shadow);
  p.poly([[480, 180], [577, 166], [640, 184], [640, 259], [584, 234], [520, 228]], C.shadow);
  for (let i = 0; i < 7; i++) { p.r(i * 23, 208 - i % 2 * 7, 20, 48, C.deep); p.r(494 + i * 24, 192 + i % 3 * 11, 22, 52, C.deep); }
  if (stage >= 3) { island(p, 108, 144, 147, 30); house(p, 138, 151, 75, 49, C.teal); books(p, 223, 171); plant(p, 123, 176, 1, true); tree(p, 234, 153, 0.8); bridge(p, 215, 178, 263, 211); }
  if (stage >= 5) {
    island(p, 421, 144, 151, 31); house(p, 440, 158, 53, 30, C.lavender);
    const x = 523, y = 168;
    p.line(x - 19, y, x - 3, y - 87, C.darkwood, 3); p.line(x + 18, y, x + 2, y - 87, C.darkwood, 3);
    for (let i = 0; i < 6; i++) { p.line(x - 16 + i * 2, y - i * 13, x + 14 - i * 2, y - i * 13, C.wood, 2); p.line(x - 16 + i * 2, y - i * 13, x + 12 - i * 2, y - (i + 1) * 13, C.mist); }
    p.r(x - 1, y - 109, 2, 28, C.cream); p.r(x - 10, y - 99, 21, 2, C.cream); p.r(x - 5, y - 106, 11, 2, C.gold); p.r(x - 2, y - 113, 4, 4, C.coral);
    lamp(p, 555, 175); bridge(p, 433, 184, 393, 219);
  }
  island(p, 207, 206, 239, 48);
  p.poly([[257, 211], [340, 211], [393, 245], [252, 245]], C.wood);
  for (let y = 215; y < 245; y += 5) p.line(257, y, 336 + (y - 210) * 1.7, y, C.darkwood);
  house(p, 264, 211, 92, 57, C.coral, true);
  p.r(281, 190, 20, 13, C.shadow); p.r(283, 191, 16, 9, C.blue); p.r(285, 193, 8, 1, C.cream); p.r(285, 196, 12, 1, C.paper); p.r(289, 203, 4, 3, C.darkwood);
  p.r(271, 206, 45, 3, C.wood); p.r(275, 209, 2, 12, C.darkwood); p.r(310, 209, 2, 12, C.darkwood); p.r(303, 203, 5, 3, C.paper);
  p.r(332, 137, 11, 11, C.darkwood); p.r(334, 139, 7, 7, C.gold);
  tree(p, 392, 210, 1.28, ending || stage >= 6);
  plant(p, 247, 226, 1, true); plant(p, 351, 228, 1, false); plant(p, 369, 243, 1, true);
  lamp(p, 222, 240); lamp(p, 425, 239);
  p.line(223, 210, 425, 208, C.wood);
  for (let i = 0; i < 12; i++) { const x = 229 + i * 17, y = 209 + Math.round(Math.sin(i / 11 * Math.PI) * 7); p.r(x, y, 2, 7, C.darkwood); p.r(x - 1, y + 6, 4, 4, i % 3 === 0 ? C.coral : C.gold); }
  for (let i = 0; i < 6; i++) { p.oval(265 + i * 23, 251, 8, 3, C.shadow); p.oval(265 + i * 23, 250, 7, 2, C.cream); }
  p.oval(237, 210, 15, 6, C.shadow); p.oval(237, 210, 12, 4, C.blue); p.r(231, 207, 8, 1, C.paper);
  if (stage >= 1) { bridge(p, 159, 248, 215, 239); island(p, 42, 235, 133, 41); house(p, 66, 247, 67, 46, C.gold, true); plant(p, 148, 261, 1, true); lamp(p, 53, 263); p.r(86, 259, 29, 3, C.wood); p.r(88, 262, 2, 9, C.darkwood); p.r(110, 262, 2, 9, C.darkwood); }
  if (stage >= 2) { bridge(p, 433, 244, 475, 263); island(p, 473, 248, 132, 42); house(p, 509, 256, 65, 41, C.teal, true); tree(p, 585, 262, 0.73); lamp(p, 483, 277); p.oval(513, 276, 13, 4, C.darkwood); p.oval(513, 273, 13, 4, C.cream); p.r(512, 276, 2, 9, C.wood); plant(p, 556, 281, 1, true); }
  if (stage >= 4) { books(p, 237, 247); books(p, 398, 248); p.r(398, 218, 25, 3, C.cream); p.line(397, 219, 410, 208, C.teal, 3); p.line(410, 208, 425, 219, C.teal, 3); }
  if (stage >= 8) {
    island(p, 6, 121, 94, 22); house(p, 26, 132, 49, 31, C.lavender); bridge(p, 78, 161, 134, 164);
    island(p, 564, 117, 74, 21); house(p, 580, 130, 40, 27, C.coral); bridge(p, 558, 162, 589, 150);
  }
  if (stage >= 10) {
    p.r(279, 253, 78, 8, C.darkwood); p.r(278, 249, 80, 4, C.coral); p.r(286, 239, 2, 11, C.cream); p.r(348, 239, 2, 11, C.cream);
    p.line(286, 239, 348, 239, C.gold); for (let i = 0; i < 8; i++) p.poly([[290 + i * 7, 240], [296 + i * 7, 240], [293 + i * 7, 246]], i % 2 ? C.blue : C.coral);
  }
  tree(p, 13, 378, 1.9); tree(p, 635, 376, 1.7); plant(p, 170, 355, 1.7, true); plant(p, 463, 361, 1.8, true);
  return p.canvas;
}
