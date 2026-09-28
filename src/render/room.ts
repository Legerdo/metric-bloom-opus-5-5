// The creator's room (runs before the network phase). World space is 320x180.
// Every purchase adds something physical to the room.
import type { GameState } from '../econ/state';
import { crewLv, collabCount, has, ms } from '../econ/calc';
import { COLLABS } from '../econ/defs';
import { PAL, disc, dither, hash01, hline, line, orect, px, rect, ring, rrect, tinyText, vgrad, vline, type Ctx } from './pix';
import { drawSeated, drawStanding, LOOKS, type Pose } from './people';
import { heart } from './fx';

export interface RoomVis {
  t: number;
  pose: Pose;
  happy: boolean;
  blink: boolean;
  flash: Record<string, number>;
  crewAct: Record<string, number>;
  litFrac: number;
  newHome: boolean;
}

// Anchor points used by the effects layer (world coords)
export const ROOM = {
  phone: { x: 197, y: 110 },
  window: { x: 118, y: 80 },
  laptop: { x: 170, y: 108 },
  camera: { x: 106, y: 114 },
  monitor: { x: 217, y: 106 },
  mic: { x: 206, y: 104 },
  me: { x: 191, y: 94 },
  bori: { x: 276, y: 104 },
  manager: { x: 251, y: 105 },
  doyun: { x: 301, y: 105 },
  zoomView: { x: 80, y: 56, w: 160, h: 90 },
};

/** Night skyline used in the window and (larger) in the city scene backdrop. */
export function drawSkyline(c: Ctx, x: number, y: number, w: number, h: number, lit: number, t: number, seed: number, arcs = 0): void {
  vgrad(c, x, y, w, h, [PAL.night0, PAL.night1, PAL.night2, PAL.dusk]);
  // stars
  for (let i = 0; i < Math.floor((w * h) / 90); i++) {
    const sx = x + Math.floor(hash01(seed + i * 7) * w);
    const sy = y + Math.floor(hash01(seed + i * 13) * h * 0.55);
    const tw = Math.sin(t * (1 + hash01(i) * 2) + i) > 0.3;
    if (tw) px(c, sx, sy, i % 5 === 0 ? PAL.lamp : PAL.skyPale);
  }
  // moon
  const mx = x + Math.floor(w * 0.78);
  const my = y + Math.floor(h * 0.18);
  disc(c, mx, my, Math.max(2, Math.floor(h / 14)), PAL.cream);
  disc(c, mx + 1, my - 1, Math.max(1, Math.floor(h / 14) - 1), PAL.white);
  // far buildings
  let bx = x - 2;
  let i = 0;
  const tops: { x: number; w: number; top: number }[] = [];
  while (bx < x + w) {
    const bw = 5 + Math.floor(hash01(seed * 3 + i) * 8);
    const bh = Math.floor(h * (0.25 + hash01(seed * 5 + i) * 0.35));
    rect(c, bx, y + h - bh, bw, bh, PAL.night1);
    bx += bw;
    i++;
  }
  // near buildings with windows
  bx = x - 1;
  i = 0;
  let win = 0;
  while (bx < x + w) {
    const bw = 7 + Math.floor(hash01(seed * 11 + i) * 9);
    const bh = Math.floor(h * (0.18 + hash01(seed * 17 + i) * 0.3));
    const top = y + h - bh;
    rect(c, bx, top, bw, bh, PAL.ink);
    rect(c, bx + 1, top + 1, bw - 2, bh - 1, '#15132a');
    tops.push({ x: bx, w: bw, top });
    for (let wy = top + 2; wy < y + h - 1; wy += 3) {
      for (let wx = bx + 2; wx < bx + bw - 2; wx += 2) {
        const hv = hash01(seed + win * 31);
        win++;
        if (hv < lit) {
          const flick = hash01(win * 3 + Math.floor(t * 0.3 + hv * 10)) < 0.03;
          px(c, wx, wy, flick ? PAL.lampD : hv < lit * 0.25 ? PAL.pinkL : PAL.lamp);
        }
      }
    }
    bx += bw + 1;
    i++;
  }
  // collab connections: arcs of light between rooftops
  for (let a = 0; a < Math.min(arcs, tops.length - 1); a++) {
    const A = tops[(a * 2) % tops.length];
    const B = tops[(a * 2 + 3) % tops.length];
    const ax = A.x + (A.w >> 1);
    const bx2 = B.x + (B.w >> 1);
    const steps = Math.abs(bx2 - ax);
    for (let k = 0; k <= steps; k += 1) {
      const u = steps === 0 ? 0 : k / steps;
      const xx = Math.round(ax + (bx2 - ax) * u);
      const yy = Math.round(A.top + (B.top - A.top) * u - Math.sin(u * Math.PI) * (4 + a));
      const pulse = Math.floor(t * 14 + a * 5) % Math.max(4, steps) === k;
      if (k % 2 === 0 || pulse) px(c, xx, yy, pulse ? PAL.white : PAL.lavender);
    }
  }
}

function drawPlant(c: Ctx, x: number, y: number, stage: number, t: number): void {
  // pot
  orect(c, x - 4, y - 5, 9, 6, PAL.orange);
  hline(c, x - 3, y - 4, 7, PAL.lampD);
  const sway = Math.sin(t * 1.3) > 0 ? 1 : 0;
  const leaves = [
    [0, -7],
    [-2, -9],
    [2, -9],
    [0, -12],
    [-3, -13],
    [3, -14],
    [0, -16],
    [-4, -17],
    [4, -18],
    [1, -20],
  ];
  const n = Math.min(leaves.length, 2 + stage * 2);
  vline(c, x, y - 6 - Math.min(14, stage * 3), Math.min(14, stage * 3) + 1, PAL.greenD);
  for (let i = 0; i < n; i++) {
    const [lx, ly] = leaves[i];
    rect(c, x + lx - 1 + (ly < -10 ? sway : 0), y + ly, 3, 2, i % 2 ? PAL.green : PAL.greenL);
  }
  if (stage >= 5) {
    // it blooms
    px(c, x + 1 + sway, y - 21, PAL.pink);
    px(c, x + sway, y - 22, PAL.pinkL);
    px(c, x + 2 + sway, y - 22, PAL.pinkL);
  }
}

function drawStringLights(c: Ctx, x0: number, x1: number, y: number, t: number): void {
  const cols = [PAL.pink, PAL.lamp, PAL.teal, PAL.lavender];
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    const yy = Math.round(y + Math.sin(u * Math.PI * 4) * 2 + 2);
    px(c, x, yy, PAL.grayDD);
    if ((x - x0) % 8 === 4) {
      const k = Math.floor((x - x0) / 8);
      const on = Math.sin(t * 3 + k) > -0.4;
      rect(c, x, yy + 1, 1, 2, on ? cols[k % 4] : PAL.grayD);
    }
  }
}

function drawOnAir(c: Ctx, x: number, y: number, lit: boolean, t: number): void {
  orect(c, x, y, 32, 9, lit ? '#3a0e1c' : '#1a1026', lit ? PAL.red : PAL.grayDD);
  const on = lit && Math.sin(t * 6) > -0.8;
  tinyText(c, 'ON AIR', x + 4, y + 2, on ? '#ff5d6c' : PAL.grayD);
}

function drawLaptop(c: Ctx, x: number, y: number, t: number, flash: number): void {
  // x,y = screen top-left; 18x10 screen, base below
  orect(c, x, y, 18, 11, PAL.grayDD);
  rect(c, x + 1, y + 1, 16, 9, flash > 0 ? PAL.tealL : '#203a5a');
  const off = Math.floor(t * 3) % 4;
  for (let i = 0; i < 3; i++) {
    const w = 4 + Math.floor(hash01(i + off * 7) * 9);
    hline(c, x + 3, y + 2 + ((i * 3 + off) % 8), w, flash > 0 ? PAL.dusk : PAL.skyPale);
  }
  rect(c, x - 2, y + 11, 22, 2, PAL.ink);
  rect(c, x - 1, y + 11, 20, 1, PAL.gray);
}

function drawMonitor(c: Ctx, x: number, y: number, t: number, flash: number): void {
  orect(c, x, y, 22, 14, PAL.ink, PAL.ink);
  rect(c, x + 1, y + 1, 20, 12, flash > 0 ? PAL.lamp : '#2b1d3f');
  // video frame: little scene
  rect(c, x + 2, y + 8, 18, 4, flash > 0 ? PAL.orange : PAL.violet);
  disc(c, x + 15, y + 5, 2, flash > 0 ? PAL.white : PAL.lampD);
  // play head
  const p = Math.floor((t * 4) % 16);
  hline(c, x + 2, y + 12, 18, PAL.grayD);
  hline(c, x + 2, y + 12, p + 1, PAL.red);
  // play icon
  if (Math.sin(t * 2) > 0) {
    px(c, x + 8, y + 4, PAL.white);
    rect(c, x + 8, y + 5, 2, 1, PAL.white);
    px(c, x + 8, y + 6, PAL.white);
  }
  rect(c, x + 10, y + 14, 2, 3, PAL.ink);
  rect(c, x + 6, y + 17, 10, 1, PAL.ink);
}

function drawCamera(c: Ctx, x: number, y: number, flash: number): void {
  // tripod
  line(c, x + 5, y + 8, x - 2, y + 38, PAL.grayDD);
  line(c, x + 5, y + 8, x + 12, y + 38, PAL.grayDD);
  vline(c, x + 5, y + 8, 30, PAL.grayD);
  orect(c, x - 1, y, 13, 8, PAL.grayDD);
  rect(c, x, y + 1, 11, 2, PAL.gray);
  disc(c, x + 12, y + 4, 2, PAL.ink);
  px(c, x + 12, y + 4, PAL.skyPale);
  rect(c, x + 1, y - 2, 4, 2, PAL.ink);
  if (flash > 0) {
    rect(c, x + 1, y - 2, 4, 2, PAL.white);
    dither(c, x + 14, y - 1, 10, 10, 'rgba(0,0,0,0)', PAL.white, Math.min(1, flash * 2) * 0.5);
  }
}

function drawRingLight(c: Ctx, x: number, y: number, on: boolean): void {
  vline(c, x, y + 9, 22, PAL.grayDD);
  ring(c, x, y, 9, PAL.ink);
  ring(c, x, y, 8, on ? PAL.white : PAL.cream);
  ring(c, x, y, 7, on ? PAL.cream : PAL.gray);
  ring(c, x, y, 6, PAL.ink);
}

function drawMic(c: Ctx, x: number, y: number, active: boolean): void {
  line(c, x + 14, y + 12, x + 8, y + 4, PAL.grayDD);
  line(c, x + 8, y + 4, x + 3, y + 2, PAL.grayDD);
  rrect(c, x - 1, y - 2, 5, 7, active ? PAL.red : PAL.grayD);
  px(c, x + 1, y, PAL.gray);
}

function drawLamp(c: Ctx, x: number, y: number): void {
  // x,y = base bottom-left
  rect(c, x, y - 2, 8, 2, PAL.ink);
  line(c, x + 4, y - 2, x + 1, y - 12, PAL.grayDD);
  line(c, x + 1, y - 12, x + 5, y - 17, PAL.grayDD);
  orect(c, x + 2, y - 21, 9, 5, PAL.lamp, PAL.ink);
  rect(c, x + 3, y - 17, 7, 1, PAL.white);
}

function drawDesk(c: Ctx): void {
  // top
  rect(c, 154, 117, 86, 4, PAL.ink);
  rect(c, 155, 118, 84, 2, PAL.woodL);
  // front panel
  rect(c, 156, 121, 82, 14, PAL.ink);
  rect(c, 157, 121, 80, 13, PAL.wood);
  hline(c, 157, 121, 80, PAL.woodD);
  // drawer
  orect(c, 206, 124, 26, 8, PAL.wood, PAL.woodD);
  rect(c, 217, 127, 4, 1, PAL.woodDD);
  // legs
  rect(c, 158, 135, 4, 17, PAL.ink);
  rect(c, 159, 135, 2, 16, PAL.woodD);
  rect(c, 232, 135, 4, 17, PAL.ink);
  rect(c, 233, 135, 2, 16, PAL.woodD);
}

function drawBookshelf(c: Ctx, s: GameState, t: number): void {
  orect(c, 14, 66, 52, 66, PAL.woodD, PAL.ink);
  for (let sh = 0; sh < 4; sh++) {
    const y = 70 + sh * 15;
    rect(c, 15, y + 12, 50, 2, PAL.woodDD);
    let bx = 17;
    let i = 0;
    while (bx < 60) {
      const bw = 2 + Math.floor(hash01(sh * 17 + i) * 3);
      const bh = 7 + Math.floor(hash01(sh * 31 + i) * 5);
      const cols = [PAL.red, PAL.teal, PAL.lamp, PAL.lavender, PAL.greenL, PAL.pinkL, PAL.dusk2];
      if (sh === 0 && i > 3) break;
      rect(c, bx, y + 12 - bh, bw, bh, cols[(sh * 3 + i) % cols.length]);
      bx += bw + (hash01(i * 5 + sh) < 0.2 ? 2 : 0);
      i++;
    }
  }
  // trophies on the top shelf
  const tro: [boolean, string, string][] = [
    [ms(s, 'm10000'), PAL.teal, 'badge'],
    [ms(s, 'm100000'), PAL.cream, 'silver'],
    [ms(s, 'm1e6'), PAL.lamp, 'gold'],
    [ms(s, 'm1e7'), PAL.pink, 'bloom'],
  ];
  let tx = 38;
  for (const [ok, col, kind] of tro) {
    if (!ok) continue;
    if (kind === 'badge') {
      disc(c, tx + 3, 77, 3, PAL.ink);
      disc(c, tx + 3, 77, 2, col);
      px(c, tx + 2, 77, PAL.white);
      px(c, tx + 3, 78, PAL.white);
      px(c, tx + 4, 76, PAL.white);
    } else {
      orect(c, tx, 72, 7, 9, col);
      px(c, tx + 3, 75, PAL.red);
      rect(c, tx + 3, 74, 1, 3, PAL.red);
      if (Math.sin(t * 2 + tx) > 0.8) px(c, tx + 1, 73, PAL.white);
    }
    tx += 8;
  }
}

function drawPolaroids(c: Ctx, s: GameState, t: number): void {
  let i = 0;
  for (const cb of COLLABS) {
    if (!s.run.collabs[cb.id]) continue;
    const x = 12 + (i % 3) * 18;
    const y = 22 + Math.floor(i / 3) * 20;
    const tilt = i % 2 === 0 ? 0 : 1;
    orect(c, x, y + tilt, 14, 16, PAL.white);
    const cols = [PAL.orange, PAL.lavender, PAL.teal, PAL.greenL, PAL.lamp, PAL.pink];
    rect(c, x + 2, y + 2 + tilt, 10, 9, cols[i % cols.length]);
    disc(c, x + 7, y + 6 + tilt, 2, PAL.skin);
    px(c, x + 7, y + 1 + tilt, PAL.red);
    i++;
  }
  if (i > 0) {
    // string between photos
    for (let x = 10; x < 70; x++) if (x % 2 === 0) px(c, x, 20 + Math.round(Math.sin(x / 9)), PAL.grayD);
  }
  void t;
}

function drawFanArt(c: Ctx, s: GameState): void {
  if (!has(s, 'fanart')) return;
  orect(c, 158, 66, 14, 12, PAL.cream, PAL.woodDD);
  heart(c, 162, 69, PAL.pink, false);
  rect(c, 160, 74, 10, 2, PAL.teal);
  orect(c, 238, 70, 12, 14, PAL.cream, PAL.woodDD);
  disc(c, 244, 76, 3, PAL.skin);
  rect(c, 241, 72, 7, 2, PAL.hair);
  px(c, 243, 76, PAL.ink);
  px(c, 245, 76, PAL.ink);
}

function drawStudio(c: Ctx, s: GameState, v: RoomVis): void {
  // opening into the next room
  rect(c, 244, 40, 4, 92, PAL.ink);
  rect(c, 248, 0, 72, 131, PAL.wallL);
  for (let x = 252; x < 320; x += 10) vline(c, x, 0, 131, PAL.wall);
  dither(c, 248, 0, 72, 10, PAL.wallL, PAL.wallD, 0.6);
  rect(c, 244, 36, 8, 4, PAL.woodD);
  // floor continues
  // whiteboard (trend analyst)
  const doyun = crewLv(s, 'doyun') > 0;
  orect(c, 284, 52, 34, 26, PAL.white, PAL.grayDD);
  if (doyun) {
    const act = v.crewAct.doyun ?? 0;
    let py = 74;
    for (let k = 0; k < 8; k++) {
      const ny = 74 - Math.floor(hash01(k + Math.floor(v.t / 6)) * 8) - k * 2;
      line(c, 287 + k * 3, py, 290 + k * 3, ny, act > 0 ? PAL.red : PAL.teal);
      py = ny;
    }
    tinyText(c, '+', 312, 54, PAL.red);
  } else {
    tinyText(c, 'NEW', 290, 60, PAL.grayD);
  }
  // Bori's desk
  const bori = crewLv(s, 'bori') > 0;
  const mgr = crewLv(s, 'manager') > 0;
  if (bori) {
    const act = (v.crewAct.bori ?? 0) > 0;
    drawSeated(c, ROOM.bori.x, ROOM.bori.y, LOOKS.bori, act ? 'type' : 'type', v.t + 1.3, { blink: Math.sin(v.t * 0.7 + 2) > 0.97, happy: act });
    if (act) {
      rrect(c, ROOM.bori.x + 10, ROOM.bori.y - 12, 12, 8, PAL.white);
      heart(c, ROOM.bori.x + 13, ROOM.bori.y - 10, PAL.pink, false);
    }
  }
  rect(c, 266, 125, 34, 3, PAL.ink);
  rect(c, 267, 126, 32, 1, PAL.woodL);
  rect(c, 268, 128, 30, 8, PAL.wood);
  rect(c, 269, 136, 2, 12, PAL.woodD);
  rect(c, 295, 136, 2, 12, PAL.woodD);
  // small laptop on bori's desk
  rect(c, 284, 119, 10, 6, PAL.grayDD);
  rect(c, 285, 120, 8, 4, bori ? PAL.tealL : PAL.grayD);
  // manager
  if (mgr) {
    drawStanding(c, ROOM.manager.x, ROOM.manager.y, LOOKS.manager, 'tablet', v.t + 0.5, { blink: Math.sin(v.t * 0.8) > 0.97, happy: (v.crewAct.manager ?? 0) > 0 });
  }
  if (doyun) {
    drawStanding(c, ROOM.doyun.x - 4, ROOM.doyun.y, LOOKS.doyun, (v.crewAct.doyun ?? 0) > 0 ? 'point' : 'idle', v.t + 2.1, { flip: true, blink: Math.sin(v.t * 0.9 + 1) > 0.97 });
  }
  if (!mgr && !bori && !doyun) {
    tinyText(c, 'NEW', 262, 100, PAL.grayD);
  }
}

export function drawRoom(c: Ctx, s: GameState, v: RoomVis): void {
  const t = v.t;
  const r = s.run;
  const wide = ms(s, 'm1000') || s.meta.runs > 0;
  // wall
  rect(c, 0, 0, 320, 131, v.newHome ? '#2f2a5c' : PAL.wall);
  for (let x = 4; x < 320; x += 10) vline(c, x, 0, 131, v.newHome ? '#35306a' : PAL.wallL);
  dither(c, 0, 0, 320, 14, PAL.wallD, PAL.wall, 0.5);
  rect(c, 0, 126, 320, 5, PAL.woodD);
  hline(c, 0, 126, 320, PAL.woodL);
  // floor
  rect(c, 0, 131, 320, 49, PAL.wood);
  for (let y = 136; y < 180; y += 6) hline(c, 0, y, 320, PAL.woodD);
  for (let y = 131, k = 0; y < 180; y += 6, k++) {
    for (let x = (k * 23) % 40; x < 320; x += 40) vline(c, x, y, 6, PAL.woodD);
  }
  // rug
  for (let yy = -8; yy <= 8; yy++) {
    const w = Math.floor(Math.sqrt(1 - (yy * yy) / 70) * 72);
    hline(c, 196 - w, 162 + yy, w * 2, Math.abs(yy) > 6 ? PAL.magenta : yy % 3 === 0 ? PAL.pinkL : PAL.violet);
  }

  // window + skyline
  orect(c, 86, 60, 64, 48, PAL.woodL, PAL.ink);
  drawSkyline(c, 89, 63, 58, 42, v.litFrac, t, 42, collabCount(r));
  rect(c, 117, 63, 2, 42, PAL.woodL);
  rect(c, 89, 83, 58, 2, PAL.woodL);
  // sill
  rect(c, 82, 107, 72, 4, PAL.ink);
  rect(c, 83, 107, 70, 2, PAL.woodL);
  // curtains
  rect(c, 78, 56, 80, 2, PAL.grayDD);
  for (let k = 0; k < 2; k++) {
    const cx = k === 0 ? 80 : 146;
    rect(c, cx, 58, 10, 52, PAL.ink);
    rect(c, cx + 1, 58, 8, 51, PAL.magenta);
    vline(c, cx + 3, 58, 51, PAL.pink);
    vline(c, cx + 6, 58, 51, PAL.violet);
  }
  // plant grows with bond
  const stage = Math.min(6, Math.floor(Math.log10(1 + r.bondEarned) * 1.3));
  drawPlant(c, 138, 107, stage, t);

  if (ms(s, 'm100')) drawStringLights(c, 76, 244, 50, t);
  drawFanArt(c, s);
  const live = r.lines.live > 0;
  drawOnAir(c, 178, 70, live, t);
  if (has(s, 'ringlight')) drawRingLight(c, 226, 90, (v.flash.photo ?? 0) > 0 || true);

  if (wide) {
    drawBookshelf(c, s, t);
    drawPolaroids(c, s, t);
    drawStudio(c, s, v);
    if (s.meta.runs > 0) {
      // gifts from true fans in the new home
      orect(c, 100, 20, 30, 20, PAL.cream, PAL.woodDD);
      tinyText(c, 'BLOOM', 103, 27, PAL.pink);
    }
  }

  // chair back
  rrect(c, 184, 99, 26, 24, PAL.violet);
  rect(c, 187, 101, 20, 2, PAL.lavender);
  // me
  const screen = (v.flash.manual ?? 0) > 0 ? PAL.white : PAL.skyPale;
  drawSeated(c, ROOM.me.x, ROOM.me.y, LOOKS.me, v.pose, t, { blink: v.blink, happy: v.happy, screen });

  drawDesk(c);
  if (r.lines.text > 0) drawLaptop(c, 161, 104, t, v.flash.text ?? 0);
  // mug with steam
  orect(c, 183, 111, 5, 6, PAL.white);
  px(c, 188, 113, PAL.white);
  if (Math.sin(t * 2) > 0) px(c, 185, 108 - (Math.floor(t * 3) % 2), PAL.gray);
  if (r.lines.video > 0) drawMonitor(c, 208, 99, t, v.flash.video ?? 0);
  drawLamp(c, 232, 118);
  if (live) drawMic(c, 206, 104, (v.flash.live ?? 0) > 0);
  if (r.lines.photo > 0) drawCamera(c, 100, 110, v.flash.photo ?? 0);
}
