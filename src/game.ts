// Game controller: owns the state, runs the fixed-step simulation, routes
// events to view/audio/UI, and handles persistence and offline progress.
import { derive, type Derived, BAL } from './econ/calc';
import { post, reply, simulateOffline, tick, type GameEvent, type OfflineSummary, type Out } from './econ/engine';
import { createGame, type GameState } from './econ/state';
import { loadFrom, saveTo, wipe } from './econ/save';
import { StageView } from './render/view';
import { audio } from './audio/audio';
import { setNumberStyle, type NumberStyle } from './util/format';

export const TICK = 0.1;
/** Hidden-tab time up to this many seconds runs at full speed; the rest counts as offline. */
const HIDDEN_FULL_SEC = 600;

export interface Settings {
  music: number;
  sfx: number;
  num: NumberStyle;
  big: boolean;
  reduced: boolean;
}

const SETTINGS_KEY = 'metricbloom.settings';

function loadSettings(): Settings {
  const def: Settings = { music: 0.5, sfx: 0.7, num: 'ko', big: false, reduced: false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return def;
    const o = JSON.parse(raw) as Partial<Settings>;
    return {
      music: typeof o.music === 'number' ? Math.max(0, Math.min(1, o.music)) : def.music,
      sfx: typeof o.sfx === 'number' ? Math.max(0, Math.min(1, o.sfx)) : def.sfx,
      num: o.num === 'intl' || o.num === 'sci' || o.num === 'ko' ? o.num : def.num,
      big: typeof o.big === 'boolean' ? o.big : def.big,
      reduced: typeof o.reduced === 'boolean' ? o.reduced : def.reduced,
    };
  } catch {
    return def;
  }
}

export interface UIHooks {
  onEvent(e: GameEvent): void;
  onOffline(sum: OfflineSummary): void;
}

export class Game {
  s: GameState;
  d: Derived;
  view: StageView;
  ui: UIHooks | null = null;
  out: Out = [];
  speed = 1;
  paused = false;
  debug: boolean;
  settings: Settings;
  loadSource: 'main' | 'backup' | 'new';
  private acc = 0;
  private lastPerf = performance.now();
  private lastWall = Date.now();
  private saveAcc = 0;
  private lastPost = 0;
  pendingOffline: OfflineSummary | null = null;

  constructor(canvas: HTMLCanvasElement, debug: boolean) {
    this.debug = debug;
    this.settings = loadSettings();
    setNumberStyle(this.settings.num);
    this.view = new StageView(canvas);
    this.view.reducedMotion = this.settings.reduced;
    const now = Date.now();
    const loaded = loadFrom(localStorage, now);
    this.s = loaded.state;
    this.loadSource = loaded.source;
    // offline progress since the last save
    if (loaded.source !== 'new') {
      const gap = (now - this.s.lastTs) / 1000;
      if (gap > 30) {
        const sum = simulateOffline(this.s, gap, this.out);
        this.out.length = 0; // offline events are summarised, not replayed
        if (gap > 60) this.pendingOffline = sum;
      }
    }
    this.s.lastTs = now;
    this.d = derive(this.s);
    audio.setVolumes(this.settings.music, this.settings.sfx);
  }

  saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // ignore
    }
  }

  /** Run an action against the state and process its events. */
  do<T>(fn: (s: GameState, out: Out) => T): T {
    const r = fn(this.s, this.out);
    this.d = derive(this.s);
    this.flush();
    return r;
  }

  /** The first verb (rate-limited so autoclickers don't break the curve). */
  post(): boolean {
    const now = performance.now();
    if (now - this.lastPost < 110) return false;
    this.lastPost = now;
    this.do((s, out) => post(s, out, this.d));
    return true;
  }

  reply(id: number): boolean {
    return this.do((s, out) => reply(s, id, true, out));
  }

  flush(): void {
    if (this.out.length === 0) return;
    const evs = this.out.splice(0, this.out.length);
    for (const e of evs) {
      this.view.onEvent(e, this.s);
      this.ui?.onEvent(e);
    }
  }

  private runTicks(n: number, dt: number, offline = false, background = false): void {
    for (let i = 0; i < n; i++) {
      this.d = tick(this.s, dt, this.out, { offline, background: background || document.hidden });
      if (this.out.length > 200) this.flush();
    }
    this.flush();
  }

  /** Catch up after the tab was hidden or the page stalled. */
  catchUp(seconds: number): void {
    if (seconds <= 0) return;
    const full = Math.min(seconds, HIDDEN_FULL_SEC);
    const coarse = full > 20 ? 1 : TICK;
    this.runTicks(Math.floor(full / coarse), coarse, false, true);
    const rest = seconds - full;
    if (rest > 1) {
      const sum = simulateOffline(this.s, rest, this.out);
      this.out.length = 0;
      if (rest > 60) this.ui?.onOffline(sum);
    }
    this.d = derive(this.s);
  }

  /** Called every animation frame. */
  frame(nowPerf: number): void {
    const realDt = Math.max(0, (nowPerf - this.lastPerf) / 1000);
    this.lastPerf = nowPerf;
    const wall = Date.now();
    const wallDt = Math.max(0, (wall - this.lastWall) / 1000);
    this.lastWall = wall;
    if (this.paused) {
      this.acc = 0;
    } else if (wallDt > 1.5 && this.speed === 1) {
      this.catchUp(wallDt);
    } else {
      this.acc += Math.min(realDt, 0.25) * this.speed;
      let n = 0;
      const maxTicks = Math.max(10, Math.ceil(this.speed * 3));
      while (this.acc >= TICK && n < maxTicks) {
        this.acc -= TICK;
        n++;
      }
      if (this.acc > TICK * maxTicks) this.acc = 0;
      if (n > 0) this.runTicks(n, TICK);
    }
    this.s.lastTs = wall;
    this.saveAcc += realDt;
    if (this.saveAcc > 10) {
      this.saveAcc = 0;
      this.save();
    }
    this.view.frame(this.s, Math.min(realDt, 0.1), this.d.hps);
  }

  /** Reset the wall clock (e.g. after the tab becomes visible and we already caught up). */
  syncClock(): void {
    this.lastWall = Date.now();
    this.lastPerf = performance.now();
  }

  save(): boolean {
    this.s.lastTs = Date.now();
    return saveTo(localStorage, this.s);
  }

  replaceState(s: GameState): void {
    this.s = s;
    this.s.lastTs = Date.now();
    this.d = derive(this.s);
    this.out.length = 0;
    this.save();
  }

  hardReset(): void {
    wipe(localStorage);
    this.s = createGame(Date.now() | 0);
    this.d = derive(this.s);
    this.out.length = 0;
    this.save();
  }

  offlineCapMinutes(): number {
    return Math.round(BAL.offlineMaxSec / 60);
  }
}
