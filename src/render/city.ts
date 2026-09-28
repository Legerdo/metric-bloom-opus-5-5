// The network city (after independence): buildings are creators' homes,
// arcs are communities, travelling lights are posts, and the Great Bloom grows
// in the plaza. World space is 320x180.
import type { GameState } from '../econ/state';
import { PETAL_AT, petalValue } from '../econ/calc';
import { PETAL_IDS, type PetalId, type SignalId } from '../econ/defs';
import { PAL, disc, dither, hash01, hline, orect, px, rect, vgrad, vline, type Ctx } from './pix';
import { drawTiny, drawSeated, LOOKS } from './people';

export const SIGNAL_COL: Record<SignalId, [string, string]> = {
  heat: ['#e2763e', '#ffb07a'],
  depth: ['#3fae6f', '#9fe89a'],
  novel: ['#3fb9b0', '#b4fff4'],
  close: ['#ff7eb6', '#ffc6de'],
};
export const PETAL_SIGNAL: Record<PetalId, SignalId> = { reach: 'heat', bond: 'depth', create: 'novel', community: 'close' };

interface Bld {
  x: number;
  w: number;
  h: number;
  layer: number;
  roof: number;
  order: number;
  hue: string;
}

const BUILDINGS: Bld[] = (() => {
  const out: Bld[] = [];
  const layers = [
    { base: 150, n: 22, hmin: 34, hmax: 78, wmin: 12, wmax: 20 },
    { base: 160, n: 18, hmin: 22, hmax: 56, wmin: 14, wmax: 22 },
    { base: 169, n: 14, hmin: 14, hmax: 34, wmin: 16, wmax: 26 },
  ];
  let order = 1;
  const hues = ['#1c1a38', '#221e42', '#1a2240', '#261c3c'];
  layers.forEach((L, li) => {
    let x = -4 + Math.floor(hash01(li * 91) * 8);
    for (let i = 0; i < L.n && x < 324; i++) {
      const w = L.wmin + Math.floor(hash01(li * 1000 + i * 7) * (L.wmax - L.wmin));
      const h = L.hmin + Math.floor(hash01(li * 1000 + i * 13) * (L.hmax - L.hmin));
      // keep the plaza clear for the bloom in the front layers
      const nearPlaza = x + w > 138 && x < 182;
      if (!(li > 0 && nearPlaza)) {
        out.push({ x, w, h, layer: li, roof: Math.floor(hash01(i * 3 + li) * 3), order: 0, hue: hues[(i + li) % hues.length] });
      }
      x += w + 1 + Math.floor(hash01(li * 55 + i) * 3);
    }
  });
  // reveal order: my home first, then spreading outward from it
  const home = out.findIndex((b) => b.layer === 2 && b.x > 40);
  const hb = out[home >= 0 ? home : 0];
  hb.order = 0;
  const rest = out.filter((b) => b !== hb).sort((a, b) => Math.abs(a.x - hb.x) + a.layer * 30 - (Math.abs(b.x - hb.x) + b.layer * 30));
  for (const b of rest) b.order = order++;
  return out;
})();

export const HOME = (() => {
  const b = BUILDINGS.find((x) => x.order === 0)!;
  const base = [150, 160, 169][b.layer];
  return { x: b.x + Math.floor(b.w / 2) - 2, y: base - b.h + 6, b };
})();

function baseOf(b: Bld): number {
  return [150, 160, 169][b.layer];
}

export interface CityVis {
  t: number;
  visibleBuildings: number;
  litFrac: number;
  arcs: number;
  chips: Record<SignalId, number>;
  bloomGrowth: number;
  festival: number;
  ending: number;
  people: number;
  flashAt: number;
}

export function cityVisibleCount(F: number): number {
  const k = Math.log10(Math.max(1, F));
  return Math.min(BUILDINGS.length, Math.max(3, Math.floor((k - 3.5) * 12)));
}

/** Rooftop anchor points of visible buildings (used for arcs and post lights). */
export function roofPoints(n: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const b of BUILDINGS) {
    if (b.order >= n) continue;
    pts.push({ x: b.x + Math.floor(b.w / 2), y: baseOf(b) - b.h - 1 });
  }
  return pts;
}

export function arcPairs(n: number, arcs: number): [number, number][] {
  const pts = roofPoints(n);
  const out: [number, number][] = [];
  if (pts.length < 2) return out;
  for (let i = 0; i < arcs; i++) {
    const a = Math.floor(hash01(i * 17 + 3) * pts.length);
    let b = Math.floor(hash01(i * 29 + 5) * pts.length);
    if (b === a) b = (a + 1) % pts.length;
    out.push([a, b]);
  }
  return out;
}

export function arcPoint(p: { x: number; y: number }, q: { x: number; y: number }, u: number): { x: number; y: number } {
  const lift = 8 + Math.abs(q.x - p.x) * 0.25;
  return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u - Math.sin(u * Math.PI) * lift };
}

function arcColor(i: number, chips: Record<SignalId, number>): string {
  const tot = chips.heat + chips.depth + chips.novel + chips.close;
  if (tot <= 0) return PAL.lavender;
  let h = hash01(i * 7 + 11) * tot;
  for (const id of ['heat', 'depth', 'novel', 'close'] as SignalId[]) {
    h -= chips[id];
    if (h < 0) return SIGNAL_COL[id][0];
  }
  return PAL.lavender;
}

function drawBuilding(c: Ctx, b: Bld, lit: number, t: number, isHome: boolean, grow: number): void {
  const base = baseOf(b);
  const h = Math.max(2, Math.round(b.h * grow));
  const top = base - h;
  rect(c, b.x, top, b.w, h, PAL.ink);
  rect(c, b.x + 1, top + 1, b.w - 2, h - 1, b.hue);
  if (b.roof === 1 && grow >= 1) {
    for (let k = 0; k < Math.floor(b.w / 2); k++) hline(c, b.x + k, top - Math.floor(b.w / 2) + k + 1, b.w - 2 * k, k === 0 ? PAL.ink : PAL.redD);
  } else if (b.roof === 2 && grow >= 1) {
    rect(c, b.x + Math.floor(b.w / 2) - 1, top - 5, 1, 5, PAL.grayD);
    if (Math.sin(t * 3 + b.x) > 0) px(c, b.x + Math.floor(b.w / 2) - 1, top - 6, PAL.red);
  }
  // windows
  let k = 0;
  const dim = b.layer === 0;
  for (let wy = top + 3; wy < base - 2; wy += 4) {
    for (let wx = b.x + 2; wx < b.x + b.w - 2; wx += 3) {
      const hv = hash01(b.x * 131 + wy * 7 + wx);
      const on = hv < lit;
      if (on) {
        const flick = hash01(k + b.x + Math.floor(t * 0.5 + hv * 20)) < 0.04;
        const col = flick ? PAL.white : dim ? PAL.lampD : hv < lit * 0.3 ? PAL.pinkL : PAL.lamp;
        rect(c, wx, wy, 2, 2, col);
      } else if (!dim) {
        rect(c, wx, wy, 2, 2, '#14122a');
      }
      k++;
    }
  }
  if (isHome) {
    const hx = HOME.x;
    const hy = HOME.y;
    rect(c, hx - 1, hy - 1, 6, 6, PAL.ink);
    rect(c, hx, hy, 4, 4, Math.sin(t * 2) > 0 ? PAL.pink : PAL.pinkL);
  }
}

// ── Bloom ───────────────────────────────────────────────────────────────────
function petalShape(c: Ctx, cx: number, cy: number, ang: number, len: number, wid: number, col: string, col2: string): void {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const R = Math.ceil(len + 2);
  const inside = (dx: number, dy: number, L: number, W: number): boolean => {
    const u = dx * ca + dy * sa;
    const v = -dx * sa + dy * ca;
    if (u < 0) return false;
    const uu = (u - L / 2) / (L / 2);
    const vv = v / (W / 2);
    return uu * uu + vv * vv <= 1;
  };
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (inside(dx, dy, len + 1.2, wid + 1.4)) {
        let col3: string = PAL.ink;
        if (inside(dx, dy, len, wid)) col3 = inside(dx, dy, len * 0.62, wid * 0.45) ? col2 : col;
        c.fillStyle = col3;
        c.fillRect(cx + dx, cy + dy, 1, 1);
      }
    }
  }
}

const bloomCache = new Map<string, HTMLCanvasElement>();

function bloomSprite(open: Record<PetalId, number>, extra: number, full: boolean): HTMLCanvasElement {
  const key = PETAL_IDS.map((p) => Math.round(open[p] * 8)).join(',') + '|' + Math.round(extra * 8) + '|' + (full ? 1 : 0);
  const hit = bloomCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = 80;
  cv.height = 80;
  const c = cv.getContext('2d')!;
  const cx = 40;
  const cy = 40;
  const angles: Record<PetalId, number> = { reach: -Math.PI * 0.75, bond: -Math.PI * 0.25, create: Math.PI * 0.25, community: Math.PI * 0.75 };
  // secondary petals (festival)
  if (extra > 0) {
    const sec = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const cols: [string, string][] = [SIGNAL_COL.heat, SIGNAL_COL.depth, SIGNAL_COL.novel, SIGNAL_COL.close];
    sec.forEach((a, i) => {
      const cc = cols[(i + 1) % 4];
      petalShape(c, cx, cy, a, 8 + extra * 18, 6 + extra * 5, cc[0], cc[1]);
    });
  }
  for (const p of PETAL_IDS) {
    const o = open[p];
    const [a, b] = SIGNAL_COL[PETAL_SIGNAL[p]];
    const len = 6 + o * 22 + (full ? 6 : 0);
    const wid = 5 + o * 8 + (full ? 3 : 0);
    petalShape(c, cx, cy, angles[p], len, wid, o >= 1 ? a : PAL.greenD, o >= 1 ? b : PAL.green);
  }
  disc(c, cx, cy, 5, PAL.ink);
  disc(c, cx, cy, 4, PAL.lampD);
  disc(c, cx - 1, cy - 1, 2, PAL.lamp);
  px(c, cx - 2, cy - 2, PAL.white);
  bloomCache.set(key, cv);
  if (bloomCache.size > 200) {
    const first = bloomCache.keys().next().value;
    if (first !== undefined) bloomCache.delete(first);
  }
  return cv;
}

export function bloomHead(v: CityVis): { x: number; y: number } {
  const stemH = 34 + Math.round(64 * v.bloomGrowth);
  return { x: 160, y: 166 - stemH };
}

function drawBloom(c: Ctx, s: GameState, v: CityVis): void {
  const head = bloomHead(v);
  // plaza
  for (let yy = -3; yy <= 3; yy++) {
    const w = Math.floor(Math.sqrt(1 - (yy * yy) / 12) * 26);
    hline(c, 160 - w, 170 + yy, w * 2, yy < 0 ? PAL.grayDD : PAL.grayD);
  }
  // halo
  if (v.festival > 0 || v.ending > 0) {
    const r = Math.round(18 + 14 * v.festival + 40 * v.ending + Math.sin(v.t * 2) * 2);
    const fr = Math.min(1, 0.25 + v.festival * 0.5 + v.ending);
    for (let k = 3; k >= 1; k--) {
      const rr = Math.round(r * (k / 3));
      c.globalAlpha = 0.12 * fr;
      disc(c, head.x, head.y, rr, PAL.lamp);
    }
    c.globalAlpha = 1;
  }
  // stem
  const sway = Math.round(Math.sin(v.t * 0.8) * 1.5);
  for (let y = head.y; y < 168; y++) {
    const u = (y - head.y) / (168 - head.y);
    const x = Math.round(160 + sway * (1 - u) + Math.sin(u * 5) * 2);
    rect(c, x - 2, y, 4, 1, PAL.ink);
    rect(c, x - 1, y, 2, 1, u < 0.5 ? PAL.green : PAL.greenD);
  }
  // leaves
  for (const [ly, dir] of [
    [0.55, -1],
    [0.72, 1],
    [0.4, 1],
  ] as [number, number][]) {
    if (v.bloomGrowth < ly - 0.3) continue;
    const y = Math.round(head.y + (168 - head.y) * ly);
    for (let k = 0; k < 10; k++) {
      const x = 160 + dir * (2 + k);
      const hh = Math.round(Math.sin((k / 10) * Math.PI) * 3);
      vline(c, x, y - hh - Math.floor(k / 3), hh * 2 + 1, k % 3 === 0 ? PAL.greenD : PAL.green);
    }
  }
  const open = {} as Record<PetalId, number>;
  for (const p of PETAL_IDS) {
    if (s.run.petals[p]) open[p] = 1;
    else open[p] = Math.min(0.9, Math.max(0, Math.log10(1 + petalValue(s, p)) / Math.log10(1 + PETAL_AT[p]))) * 0.5;
  }
  const spr = bloomSprite(open, Math.max(v.festival, v.ending), v.ending > 0.5);
  c.drawImage(spr, head.x - 40, head.y - 40);
}

export function drawCity(c: Ctx, s: GameState, v: CityVis): void {
  const t = v.t;
  vgrad(c, 0, 0, 320, 180, [PAL.night0, PAL.night1, PAL.night2, PAL.dusk, PAL.dusk2]);
  if (v.festival > 0 || v.ending > 0) {
    dither(c, 0, 100, 320, 60, 'rgba(0,0,0,0)', PAL.violet, 0.15 + 0.3 * Math.max(v.festival, v.ending));
  }
  // stars
  for (let i = 0; i < 90; i++) {
    const sx = Math.floor(hash01(i * 7 + 1) * 320);
    const sy = Math.floor(hash01(i * 13 + 2) * 90);
    if (Math.sin(t * (0.8 + hash01(i) * 2) + i) > 0.2) px(c, sx, sy, i % 6 === 0 ? PAL.lamp : PAL.skyPale);
  }
  // moon
  disc(c, 268, 26, 7, PAL.cream);
  disc(c, 270, 24, 6, PAL.white);

  // buildings by layer (back to front), bloom sits between layers 0 and 1
  const n = v.visibleBuildings;
  for (const layer of [0, 1, 2]) {
    if (layer === 1) drawBloom(c, s, v);
    for (const b of BUILDINGS) {
      if (b.layer !== layer || b.order >= n) continue;
      const age = Math.min(1, (n - b.order) / 1.5);
      const lit = layer === 0 ? v.litFrac * 0.6 : v.litFrac;
      drawBuilding(c, b, lit, t, b.order === 0, age);
    }
    if (layer === 0) {
      // community arcs above the back layer
      const pts = roofPoints(n);
      const pairs = arcPairs(n, v.arcs);
      pairs.forEach(([a, bb], i) => {
        const p = pts[a];
        const q = pts[bb];
        const col = arcColor(i, v.chips);
        const steps = Math.max(8, Math.floor(Math.abs(q.x - p.x) / 2));
        for (let k = 0; k <= steps; k++) {
          if (k % 2) continue;
          const pt = arcPoint(p, q, k / steps);
          px(c, Math.round(pt.x), Math.round(pt.y), col);
        }
      });
    }
  }
  // street
  rect(c, 0, 169, 320, 11, PAL.grayDD);
  hline(c, 0, 169, 320, PAL.grayD);
  for (let x = 6; x < 320; x += 14) hline(c, x, 175, 6, PAL.grayD);
  for (let x = 20; x < 320; x += 48) {
    if (x > 130 && x < 190) continue;
    vline(c, x, 156, 13, PAL.ink);
    rect(c, x - 1, 155, 3, 2, PAL.lamp);
    dither(c, x - 3, 157, 7, 12, 'rgba(0,0,0,0)', PAL.lampD, 0.18);
  }
  // people
  const cols = [PAL.pink, PAL.teal, PAL.lamp, PAL.lavender, PAL.greenL, PAL.orange, PAL.white];
  for (let i = 0; i < v.people; i++) {
    const sp = 6 + hash01(i * 3) * 10;
    const dir = hash01(i * 5) < 0.5 ? 1 : -1;
    const x = Math.floor((((hash01(i * 7) * 340 + dir * t * sp) % 340) + 340) % 340) - 10;
    const y = 170 + Math.floor(hash01(i * 11) * 4);
    drawTiny(c, x, y, cols[i % cols.length], PAL.hair, Math.floor(t * 6 + i));
  }
  // ending: me and my first follower on a rooftop in the foreground, watching
  if (v.ending > 0.2) {
    rect(c, 212, 153, 90, 27, PAL.ink);
    rect(c, 213, 154, 88, 26, '#15132a');
    hline(c, 213, 154, 88, PAL.grayDD);
    for (let x = 216; x < 300; x += 12) rect(c, x, 160, 6, 4, '#221f3c');
    // water tank and antenna
    orect(c, 284, 136, 12, 18, PAL.grayDD);
    hline(c, 285, 141, 10, PAL.grayD);
    vline(c, 222, 132, 22, PAL.grayD);
    if (Math.sin(t * 3) > 0) px(c, 222, 131, PAL.red);
    drawSeated(c, 238, 130, LOOKS.me, 'back', t);
    drawSeated(c, 258, 130, LOOKS.min, 'back', t + 1.7);
    // railing in front
    hline(c, 212, 150, 90, PAL.grayD);
    for (let x = 214; x < 302; x += 8) vline(c, x, 150, 4, PAL.grayD);
  }
}

export { BUILDINGS };
