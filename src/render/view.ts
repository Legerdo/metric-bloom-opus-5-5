// Stage renderer: draws the pixel world at 320x180, upscales it with an integer
// factor, and draws screen-space overlays (comment bubbles, popups, hints).
import type { GameState } from '../econ/state';
import type { GameEvent } from '../econ/engine';
import { ms } from '../econ/calc';
import { COMMENTS_NORMAL, COMMENTS_TREND } from '../content/story';
import { ECHO_COMMENTS, echoRoute } from '../content/echo';
import { fmt } from '../util/format';
import { Fx } from './fx';
import { PAL, rect } from './pix';
import { drawRoom, ROOM, type RoomVis } from './room';
import { arcPairs, arcPoint, bloomHead, cityVisibleCount, drawCity, HOME, roofPoints, SIGNAL_COL, type CityVis } from './city';
import type { Pose } from './people';
import type { LineId, SignalId } from '../econ/defs';

export const W = 320;
export const H = 180;

interface Dot {
  a: number;
  b: number;
  u: number;
  sp: number;
  col: string;
}

interface BubbleBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROOM_SLOTS = [
  { x: 104, y: 66 },
  { x: 214, y: 62 },
  { x: 150, y: 60 },
  { x: 100, y: 96 },
  { x: 226, y: 92 },
  { x: 162, y: 84 },
];
const CITY_SLOTS = [
  { x: 60, y: 40 },
  { x: 232, y: 46 },
  { x: 104, y: 62 },
  { x: 40, y: 88 },
  { x: 250, y: 84 },
  { x: 206, y: 28 },
];

export type ViewMode = 'room' | 'city';

export class StageView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world: HTMLCanvasElement;
  private wctx: CanvasRenderingContext2D;
  private roomBuf: HTMLCanvasElement;
  private rctx: CanvasRenderingContext2D;
  fx = new Fx();
  scale = 3;
  private cssW = 960;
  private cssH = 540;
  private dpr = 1;
  t = 0;
  // camera
  zoom = 2;
  private camCx = 160;
  private camCy = 101;
  mode: ViewMode = 'room';
  userMode: ViewMode | null = null;
  private transition = 0; // 0..1 room→city zoom-out
  private transitioning = false;
  // character state
  private poseT = 0;
  private pose: Pose = 'phone';
  private happyT = 0;
  private flash: Record<string, number> = {};
  private crewAct: Record<string, number> = {};
  private lastCard: Record<string, number> = {};
  private dots: Dot[] = [];
  private flashScreen = 0;
  private flashCol: string = PAL.white;
  private bubbles: BubbleBox[] = [];
  hoverBubble = -1;
  private secHearts = 0;
  private secTimer = 0;
  private titleCard: { text: string; sub: string; t: number; dur: number } | null = null;
  festivalGlow = 0;
  endingT = 0;
  showHint = true;
  reducedMotion = false;
  private fontPx = 12;
  private echoT = 0;
  private replyChain = 0;
  private lastReplyT = -10;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.world = document.createElement('canvas');
    this.world.width = W;
    this.world.height = H;
    this.wctx = this.world.getContext('2d')!;
    this.roomBuf = document.createElement('canvas');
    this.roomBuf.width = W;
    this.roomBuf.height = H;
    this.rctx = this.roomBuf.getContext('2d')!;
  }

  /** Fit the stage into the given CSS box using an integer device-pixel scale. */
  resize(availW: number, availH: number): void {
    this.dpr = window.devicePixelRatio || 1;
    const maxS = Math.min((availW * this.dpr) / W, (availH * this.dpr) / H);
    let s = Math.floor(maxS);
    if (s < 1) s = Math.max(0.05, maxS);
    this.scale = s;
    const pw = Math.round(W * s);
    const ph = Math.round(H * s);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.cssW = pw / this.dpr;
    this.cssH = ph / this.dpr;
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.fontPx = s >= 4 ? 24 : 12;
    if (s >= 6) this.fontPx = 36;
  }

  cssSize(): { w: number; h: number } {
    return { w: this.cssW, h: this.cssH };
  }

  /** Convert world coordinates to CSS pixels inside the canvas. */
  worldToCss(x: number, y: number): { x: number; y: number } {
    const view = this.viewRect();
    const sx = ((x - view.x) / view.w) * this.cssW;
    const sy = ((y - view.y) / view.h) * this.cssH;
    return { x: sx, y: sy };
  }

  private viewRect(): { x: number; y: number; w: number; h: number } {
    const w = W / this.zoom;
    const h = H / this.zoom;
    let x = this.camCx - w / 2;
    let y = this.camCy - h / 2;
    x = Math.max(0, Math.min(W - w, x));
    y = Math.max(0, Math.min(H - h, y));
    return { x, y, w, h };
  }

  bigMoment(text: string, sub: string, col: string = PAL.white, dur = 3.2): void {
    this.titleCard = { text, sub, t: 0, dur };
    this.flashScreen = this.reducedMotion ? 0 : 0.55;
    this.flashCol = col;
  }

  startNetworkTransition(): void {
    this.transitioning = true;
    this.transition = 0;
    this.mode = 'city';
    this.userMode = null;
  }

  // ── events → visuals ──────────────────────────────────────────────────────
  onEvent(e: GameEvent, s: GameState): void {
    const city = this.mode === 'city';
    switch (e.t) {
      case 'post': {
        this.pose = 'raise';
        this.poseT = 0.3;
        this.flash.manual = 0.15;
        this.showHint = false;
        const src = city ? { x: HOME.x + 2, y: HOME.y } : ROOM.phone;
        const dst = city ? bloomHead(this.cityVis(s)) : ROOM.window;
        if (!city) this.fx.card(src.x + 6, src.y - 8, dst.x + (Math.random() - 0.5) * 16, dst.y - 6, PAL.pink, 0.9);
        this.fx.hearts(src.x + 4, src.y - 6, 2);
        this.fx.ringPulse(src.x + 4, src.y - 6, PAL.pink, 0.35, 8);
        const p = this.worldToCss(src.x + 4, src.y - 14);
        this.fx.popup(`+${fmt(e.hearts)}♥`, p.x + (Math.random() - 0.5) * 20, p.y, PAL.pinkL);
        break;
      }
      case 'spotlight': {
        const pts = roofPoints(cityVisibleCount(s.run.followers));
        if (pts.length) {
          const q = pts[Math.floor(Math.random() * pts.length)];
          this.fx.ringPulse(q.x, q.y, PAL.lamp, 0.7, 12);
          this.fx.sparks(q.x, q.y, 6, PAL.lamp, 20);
          const p = this.worldToCss(q.x, q.y - 8);
          this.fx.popup(`스포트라이트 +${fmt(e.hearts)}♥`, p.x, p.y, PAL.lamp);
        }
        break;
      }
      case 'autopost': {
        this.flash[e.line] = 0.2;
        if (city) break;
        const now = this.t;
        const last = this.lastCard[e.line] ?? -1;
        if (now - last > 0.3) {
          this.lastCard[e.line] = now;
          const a = anchorFor(e.line);
          const cols: Record<LineId, string> = { text: PAL.tealL, photo: PAL.lamp, video: PAL.orange, live: PAL.red };
          this.fx.card(a.x, a.y, ROOM.window.x + (Math.random() - 0.5) * 24, ROOM.window.y - 8 + (Math.random() - 0.5) * 8, cols[e.line], 1.1);
        }
        break;
      }
      case 'netpost': {
        if (!city) break;
        const n = cityVisibleCount(s.run.followers);
        const arcs = this.arcCount(s);
        const pairs = arcPairs(n, arcs);
        const spawn = Math.min(4, e.n);
        for (let i = 0; i < spawn && this.dots.length < 90 && pairs.length; i++) {
          const k = Math.floor(Math.random() * pairs.length);
          this.dots.push({ a: pairs[k][0], b: pairs[k][1], u: 0, sp: 0.35 + Math.random() * 0.5, col: dotColor(s.run.chips) });
        }
        break;
      }
      case 'reply': {
        const b = this.bubbles.find((x) => x.id === e.id);
        const slots = city ? CITY_SLOTS : ROOM_SLOTS;
        const sl = slots[e.slot % slots.length];
        this.fx.hearts(sl.x, sl.y, e.manual ? 4 : 2, 10);
        if (!e.manual) this.crewAct.bori = 0.6;
        const p = b ? { x: b.x + b.w / 2, y: b.y } : this.worldToCss(sl.x, sl.y);
        this.fx.popup(`+${fmt(e.bond, true)} 유대`, p.x, p.y, PAL.greenL);
        if (e.manual) {
          this.replyChain = this.t - this.lastReplyT < 6 ? this.replyChain + 1 : 1;
          this.lastReplyT = this.t;
          this.fx.ringPulse(sl.x, sl.y, PAL.tealL, 0.6, 14);
          if (this.replyChain >= 3) this.fx.popup(`이어지는 대화 · ${this.replyChain}`, this.cssW / 2, this.cssH * 0.8, PAL.tealL, true);
        }
        break;
      }
      case 'story':
        this.echoT = this.reducedMotion ? 0 : 1.8;
        this.fx.ringPulse(ROOM.window.x, ROOM.window.y, PAL.pink, 1.4, 28);
        break;
      case 'storyChoice':
        this.fx.sparks(ROOM.phone.x, ROOM.phone.y - 8, 12, PAL.tealL, 24);
        break;
      case 'buy': {
        if (e.kind === 'line') {
          const a = anchorFor(e.id as LineId);
          if (!city) this.fx.sparks(a.x, a.y, 5, PAL.lamp, 18);
          this.crewAct.manager = 0.5;
        } else {
          const at = city ? bloomHead(this.cityVis(s)) : ROOM.me;
          this.fx.sparks(at.x + 6, at.y + 4, 10, PAL.lamp, 28);
          this.happyT = 0.8;
        }
        break;
      }
      case 'milestone': {
        this.happyT = 1.6;
        this.pose = 'cheer';
        this.poseT = 1.4;
        const at = city ? bloomHead(this.cityVis(s)) : ROOM.window;
        this.fx.confetti(at.x, at.y + 10, 40);
        this.fx.ringPulse(at.x, at.y, PAL.lamp, 1, 30);
        if (e.id === 'm1000' && s.meta.runs === 0) this.flashScreen = 0.4;
        break;
      }
      case 'viral': {
        this.happyT = 2;
        this.pose = 'cheer';
        this.poseT = 1.6;
        this.flashScreen = this.reducedMotion ? 0.15 : 0.45;
        this.flashCol = PAL.pink;
        const at = city ? bloomHead(this.cityVis(s)) : ROOM.window;
        this.fx.hearts(at.x, at.y + 8, 24, 30);
        this.fx.ringPulse(at.x, at.y, PAL.pink, 1.2, 40);
        const p = this.worldToCss(at.x, at.y - 10);
        this.fx.popup(`게시물이 퍼지는 중! +${fmt(e.followers)} 팔로워`, p.x, p.y, PAL.pinkL, true);
        break;
      }
      case 'trendJoin': {
        const at = city ? bloomHead(this.cityVis(s)) : ROOM.me;
        this.fx.sparks(at.x + 6, at.y, 14, PAL.lamp, 34);
        if (e.auto) this.crewAct.doyun = 2;
        break;
      }
      case 'petal': {
        const at = bloomHead(this.cityVis(s));
        const col = SIGNAL_COL[({ reach: 'heat', bond: 'depth', create: 'novel', community: 'close' } as const)[e.id]][0];
        this.fx.ringPulse(at.x, at.y, col, 1.4, 50);
        this.fx.sparks(at.x, at.y, 30, col, 50);
        this.flashScreen = 0.35;
        this.flashCol = col;
        break;
      }
      case 'festival': {
        const at = bloomHead(this.cityVis(s));
        this.fx.confetti(at.x, at.y, 60);
        break;
      }
      default:
        break;
    }
  }

  private arcCount(s: GameState): number {
    return Math.min(36, Math.floor(Math.log2(1 + s.run.communities) * 2));
  }

  private cityVis(s: GameState): CityVis {
    const r = s.run;
    const F = r.followers;
    const growth = Math.min(1, Math.max(0, Math.log10(Math.max(1, F) / 5e4) / Math.log10(1e8 / 5e4)));
    return {
      t: this.t,
      visibleBuildings: cityVisibleCount(F),
      litFrac: Math.min(0.95, Math.max(0.08, Math.log10(1 + r.creators) / 6)),
      arcs: this.arcCount(s),
      chips: r.chips,
      bloomGrowth: growth,
      festival: r.festival ? 0.3 + 0.7 * r.festivalGauge : 0,
      ending: this.endingT,
      people: Math.min(40, Math.floor(Math.log10(Math.max(1, F)) * 4)),
      flashAt: 0,
    };
  }

  private roomVis(s: GameState, blink: boolean): RoomVis {
    return {
      t: this.t,
      pose: this.pose,
      happy: this.happyT > 0,
      blink,
      flash: this.flash,
      crewAct: this.crewAct,
      litFrac: Math.min(0.95, Math.max(0.03, Math.log10(1 + s.run.followers) / 5.5)),
      newHome: s.meta.runs > 0,
    };
  }

  // ── frame ─────────────────────────────────────────────────────────────────
  frame(s: GameState, dt: number, heartsPerSec: number): void {
    this.t += dt;
    this.echoT = Math.max(0, this.echoT - dt);
    this.fx.reduced = this.reducedMotion;
    this.fx.update(dt);
    for (const k of Object.keys(this.flash)) this.flash[k] = Math.max(0, this.flash[k] - dt);
    for (const k of Object.keys(this.crewAct)) this.crewAct[k] = Math.max(0, this.crewAct[k] - dt);
    this.happyT = Math.max(0, this.happyT - dt);
    if (this.poseT > 0) {
      this.poseT -= dt;
      if (this.poseT <= 0) this.pose = 'phone';
    }
    this.flashScreen = Math.max(0, this.flashScreen - dt * 1.2);
    if (this.titleCard) {
      this.titleCard.t += dt;
      if (this.titleCard.t > this.titleCard.dur) this.titleCard = null;
    }

    const r = s.run;
    // desired mode
    const wantCity = r.net && (this.userMode ?? 'city') === 'city';
    if (!this.transitioning) this.mode = wantCity ? 'city' : 'room';
    if (this.transitioning) {
      this.transition += dt / 3.6;
      if (this.transition >= 1) {
        this.transition = 1;
        this.transitioning = false;
      }
    }

    // camera
    const wide = ms(s, 'm1000') || s.meta.runs > 0 || this.mode === 'city';
    const zt = wide ? 1 : 2;
    this.zoom += (zt - this.zoom) * Math.min(1, dt * 1.6);
    if (Math.abs(this.zoom - zt) < 0.01) this.zoom = zt;
    const ct = wide ? { x: 160, y: 90 } : { x: 160, y: 101 };
    this.camCx += (ct.x - this.camCx) * Math.min(1, dt * 1.6);
    this.camCy += (ct.y - this.camCy) * Math.min(1, dt * 1.6);

    // aggregated income popup near the window / bloom
    this.secTimer += dt;
    if (this.secTimer >= 1.6) {
      this.secTimer = 0;
      const inc = heartsPerSec * 1.6;
      if (inc > 0.5) {
        const at = this.mode === 'city' ? bloomHead(this.cityVis(s)) : ROOM.window;
        const p = this.worldToCss(at.x + (Math.random() - 0.5) * 20, at.y - 16);
        this.fx.popup(`+${fmt(inc)}♥`, p.x, p.y, PAL.pink);
      }
    }
    void this.secHearts;

    const blink = Math.sin(this.t * 0.9) > 0.985;
    const wc = this.wctx;
    wc.imageSmoothingEnabled = false;
    const cv = this.cityVis(s);
    if (this.mode === 'city') {
      drawCity(wc, s, cv);
      // travelling post lights
      const pts = roofPoints(cv.visibleBuildings);
      for (let i = this.dots.length - 1; i >= 0; i--) {
        const d = this.dots[i];
        d.u += d.sp * dt;
        if (d.u >= 1 || !pts[d.a] || !pts[d.b]) {
          this.dots.splice(i, 1);
          continue;
        }
        const p = arcPoint(pts[d.a], pts[d.b], d.u);
        rect(wc, Math.round(p.x), Math.round(p.y), 2, 2, d.col);
      }
      // festival: sparks rise from the city to the bloom
      if (r.festival && Math.random() < dt * 20) {
        const head = bloomHead(cv);
        const q = pts[Math.floor(Math.random() * Math.max(1, pts.length))];
        if (q) this.fx.spawn('spark', q.x, q.y, (head.x - q.x) * 0.9, (head.y - q.y) * 0.9 - 10, 1.1, dotColor(r.chips));
      }
      if (this.endingT > 0 && Math.random() < dt * 30) {
        this.fx.petals(0, 320, -6, 1, [SIGNAL_COL.heat[1], SIGNAL_COL.depth[1], SIGNAL_COL.novel[1], SIGNAL_COL.close[1]]);
      }
    } else {
      drawRoom(wc, s, this.roomVis(s, blink));
    }
    this.fx.draw(wc, 0, 0, 1);

    // compose to screen
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const PW = this.canvas.width;
    const PH = this.canvas.height;
    const v = this.viewRect();
    c.drawImage(this.world, v.x, v.y, v.w, v.h, 0, 0, PW, PH);
    if (this.transitioning) {
      // the room shrinks into its window in the city
      const e = easeInOut(this.transition);
      this.rctx.imageSmoothingEnabled = false;
      drawRoom(this.rctx, s, this.roomVis(s, false));
      const tx = (HOME.x / W) * PW;
      const ty = (HOME.y / H) * PH;
      const tw = (4 / W) * PW;
      const th = (4 / H) * PH;
      const x = lerp(0, tx, e);
      const y = lerp(0, ty, e);
      const w = lerp(PW, tw, e);
      const h = lerp(PH, th, e);
      c.globalAlpha = Math.min(1, 1.6 - e * 1.4);
      c.drawImage(this.roomBuf, 0, 0, W, H, x, y, w, h);
      c.globalAlpha = 1;
    }
    this.drawOverlays(s);
  }

  // ── overlays (screen space, device pixels) ────────────────────────────────
  private drawOverlays(s: GameState): void {
    const c = this.ctx;
    const k = this.dpr;
    const u = Math.max(1, Math.floor(this.scale)); // pixel unit for UI chrome
    const font = this.fontPx;
    c.textBaseline = 'middle';
    c.textAlign = 'center';

    // comment bubbles
    this.bubbles = [];
    const r = s.run;
    const slots = this.mode === 'city' ? CITY_SLOTS : ROOM_SLOTS;
    const bubbleLimit = Math.max(1, Math.min(6, Math.floor(this.canvas.height / (font * 2.5))));
    for (const cm of [...r.comments].sort((a, b) => a.ttl - b.ttl).slice(0, bubbleLimit)) {
      const sl = slots[cm.slot % slots.length];
      const p = this.worldToCss(sl.x, sl.y);
      const unresolved = s.meta.narrative.choices.length > 0 && !echoRoute(s.meta.narrative.choices);
      const list = cm.kind === 'trend' ? COMMENTS_TREND : unresolved && cm.id % 4 === 0 ? ECHO_COMMENTS : COMMENTS_NORMAL;
      const text = list[cm.textIdx % list.length];
      c.font = `${font}px Galmuri11, sans-serif`;
      const tw = c.measureText(text).width;
      const bw = Math.min(this.canvas.width - 8 * u, Math.round(tw + font * 2.2));
      const bh = Math.round(font * 1.9);
      const age = cm.maxTtl - cm.ttl;
      const pop = Math.min(1, age * 6);
      const bx = Math.max(3 * u, Math.min(this.canvas.width - bw - 3 * u, Math.round(p.x * k - bw / 2)));
      let by = Math.max(3 * u, Math.min(this.canvas.height - bh - 5 * u, Math.round(p.y * k - bh)));
      const collides = (y: number) => this.bubbles.some((b) => bx < (b.x + b.w) * k && bx + bw > b.x * k && y < (b.y + b.h) * k && y + bh + 3 * u > b.y * k);
      if (collides(by)) {
        let slot = 3 * u;
        while (slot + bh + 5 * u < this.canvas.height && collides(slot)) slot += bh + 5 * u;
        if (slot + bh + 5 * u >= this.canvas.height) continue;
        by = slot;
      }
      const fading = cm.ttl < 2.5 && Math.floor(this.t * 6) % 2 === 0;
      const hover = this.hoverBubble === cm.id;
      c.globalAlpha = fading ? 0.55 : pop;
      pixelBubble(c, bx, by, bw, bh, u, cm.kind === 'trend' ? '#fff3c4' : PAL.white, hover ? PAL.pink : PAL.ink);
      // icon
      c.fillStyle = cm.kind === 'trend' ? PAL.orange : PAL.pink;
      c.font = `${font}px Galmuri11, sans-serif`;
      c.fillText(cm.kind === 'trend' ? '#' : '♥', bx + font * 0.9, by + bh / 2 + 1);
      c.fillStyle = PAL.ink;
      c.fillText(text, bx + bw / 2 + font * 0.4, by + bh / 2 + 1, Math.max(1, bw - font * 2));
      // lifetime bar
      const lw = Math.round((bw - 4 * u) * Math.max(0, cm.ttl / cm.maxTtl));
      c.fillStyle = cm.kind === 'trend' ? PAL.orange : PAL.teal;
      c.fillRect(bx + 2 * u, by + bh - 2 * u, lw, u);
      c.globalAlpha = 1;
      this.bubbles.push({ id: cm.id, x: bx / k, y: by / k, w: bw / k, h: (bh + 3 * u) / k });
    }

    // popups
    for (const p of this.fx.pops) {
      if (!p.on) continue;
      const a = Math.min(1, (p.max - p.life) / 0.4);
      c.globalAlpha = a;
      const fs = p.big ? font * 1.35 : font;
      c.font = `bold ${fs}px Galmuri11, sans-serif`;
      c.lineWidth = Math.max(2, u);
      c.strokeStyle = PAL.ink;
      const textW = Math.min(c.measureText(p.text).width, this.canvas.width - 12 * u);
      const px = Math.max(textW / 2 + 4 * u, Math.min(this.canvas.width - textW / 2 - 4 * u, p.x * k));
      const py = Math.max(fs, Math.min(this.canvas.height - fs, p.y * k));
      c.strokeText(p.text, px, py, this.canvas.width - 8 * u);
      c.fillStyle = p.col;
      c.fillText(p.text, px, py, this.canvas.width - 8 * u);
      c.globalAlpha = 1;
    }

    // first-verb hint
    if (this.showHint && s.meta.totalManualPosts === 0 && this.mode === 'room') {
      const p = this.worldToCss(ROOM.phone.x, ROOM.phone.y - 30);
      const bob = this.reducedMotion ? 0 : Math.sin(this.t * 4) * 3 * u;
      c.font = `bold ${font}px Galmuri11, sans-serif`;
      const text = '휴대폰을 눌러 게시!';
      const tw = c.measureText(text).width;
      const bw = Math.min(this.canvas.width - 8 * u, Math.round(tw + font * 1.4));
      const bh = Math.round(font * 1.8);
      const bx = Math.max(3 * u, Math.min(this.canvas.width - bw - 3 * u, Math.round(p.x * k - bw / 2)));
      const by = Math.max(3 * u, Math.min(this.canvas.height - bh - 5 * u, Math.round(p.y * k - bh + bob)));
      pixelBubble(c, bx, by, bw, bh, u, PAL.lamp, PAL.ink);
      c.fillStyle = PAL.ink;
      c.fillText(text, bx + bw / 2, by + bh / 2 + 1, Math.max(1, bw - 8 * u));
    }

    // A single soft signal sweep, without strobing or moving the hit targets.
    if (this.echoT > 0 && !this.reducedMotion) {
      const y = (1 - this.echoT / 1.8) * this.canvas.height;
      c.fillStyle = 'rgba(255,126,182,0.18)';
      c.fillRect(0, y, this.canvas.width, 2 * u);
    }

    // screen flash
    if (this.flashScreen > 0) {
      c.globalAlpha = Math.min(0.7, this.flashScreen);
      c.fillStyle = this.flashCol;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      c.globalAlpha = 1;
    }
    // title card
    if (this.titleCard) {
      const tc = this.titleCard;
      const a = Math.min(1, tc.t / 0.4, (tc.dur - tc.t) / 0.6);
      c.globalAlpha = Math.max(0, a);
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const wrap = (text: string, maxWidth: number): string[] => {
        const lines: string[] = [];
        let line = '';
        for (const char of text) {
          if (line && c.measureText(line + char).width > maxWidth) { lines.push(line); line = ''; }
          line += char;
        }
        if (line) lines.push(line);
        return lines;
      };
      c.font = `${font}px Galmuri11, sans-serif`;
      const subLines = wrap(tc.sub, cw - 20 * u);
      const bandH = Math.min(ch, font * (3.2 + subLines.length * 1.5));
      const bandY = (ch - bandH) / 2;
      c.fillStyle = 'rgba(13,11,25,0.72)';
      c.fillRect(0, bandY, cw, bandH);
      c.fillStyle = PAL.lamp;
      c.fillRect(0, bandY, cw, u);
      c.fillRect(0, bandY + bandH - u, cw, u);
      c.font = `bold ${font * 1.7}px Galmuri11, sans-serif`;
      c.fillStyle = PAL.white;
      c.fillText(tc.text, cw / 2, bandY + font * 1.5, cw - 16 * u);
      c.font = `${font}px Galmuri11, sans-serif`;
      c.fillStyle = PAL.pinkL;
      subLines.forEach((line, i) => c.fillText(line, cw / 2, bandY + font * (3 + i * 1.5)));
      c.globalAlpha = 1;
    }
  }

  /** Returns the comment id under a CSS-pixel point, or -1. */
  bubbleAt(x: number, y: number): number {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return -1;
  }
}

function anchorFor(line: LineId): { x: number; y: number } {
  switch (line) {
    case 'text':
      return ROOM.laptop;
    case 'photo':
      return ROOM.camera;
    case 'video':
      return ROOM.monitor;
    case 'live':
      return ROOM.mic;
  }
}

function dotColor(chips: Record<SignalId, number>): string {
  const tot = chips.heat + chips.depth + chips.novel + chips.close;
  if (tot <= 0) return PAL.white;
  let h = Math.random() * tot;
  for (const id of ['heat', 'depth', 'novel', 'close'] as SignalId[]) {
    h -= chips[id];
    if (h < 0) return SIGNAL_COL[id][1];
  }
  return PAL.white;
}

function pixelBubble(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, fill: string, line: string): void {
  c.fillStyle = line;
  c.fillRect(x + u, y, w - 2 * u, h);
  c.fillRect(x, y + u, w, h - 2 * u);
  c.fillStyle = fill;
  c.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
  // tail
  const tx = x + Math.round(w / 2) - u;
  c.fillStyle = line;
  c.fillRect(tx - u, y + h - u, 4 * u, u);
  c.fillRect(tx, y + h, 2 * u, 2 * u);
  c.fillStyle = fill;
  c.fillRect(tx, y + h - u, 2 * u, u);
  c.fillRect(tx + u, y + h, u, u);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
