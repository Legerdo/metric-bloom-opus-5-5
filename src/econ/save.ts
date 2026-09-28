// Save serialization with schema versioning and defensive restore.
// Restoring always starts from a fresh default state and copies over only
// well-typed fields, so partial / corrupted / older saves still load.
import { COLLABS, CREW_IDS, LINE_IDS, PERKS, PETAL_IDS, SIGNAL_IDS } from './defs';
import { ECHO_EPISODES } from '../content/echo';
import { allUpgradeIds } from './calc';
import { SAVE_VERSION, createGame, createMeta, createRun, createTrend, type GameState, type MetaState, type RunState } from './state';

export const SAVE_KEY = 'metricbloom.save';
export const BACKUP_KEY = 'metricbloom.save.backup';

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function num(v: unknown, def: number, min = 0, max = 1e300): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, v));
}
function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}
function str<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : def;
}
function boolMap(v: unknown, allowed?: readonly string[]): Record<string, boolean> {
  const outM: Record<string, boolean> = {};
  if (!isObj(v)) return outM;
  for (const [k, val] of Object.entries(v)) {
    if (allowed && !allowed.includes(k)) continue;
    if (val === true) outM[k] = true;
  }
  return outM;
}

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

function restoreRun(raw: unknown): RunState {
  const r = createRun();
  if (!isObj(raw)) return r;
  r.time = num(raw.time, 0);
  r.hearts = num(raw.hearts, 0);
  r.heartsEarned = num(raw.heartsEarned, r.hearts);
  r.followers = num(raw.followers, 0);
  r.followersPeak = num(raw.followersPeak, r.followers);
  r.bond = num(raw.bond, 0);
  r.bondEarned = num(raw.bondEarned, r.bond);
  if (isObj(raw.lines)) for (const id of LINE_IDS) r.lines[id] = Math.floor(num(raw.lines[id], 0, 0, 1e6));
  const upIds = allUpgradeIds();
  r.ups = boolMap(raw.ups, upIds);
  r.toggles = boolMap(raw.toggles, upIds);
  if (isObj(raw.crew)) for (const id of CREW_IDS) {
    const lv = Math.floor(num(raw.crew[id], 0, 0, 3));
    if (lv > 0) r.crew[id] = lv;
  }
  if (isObj(raw.autoBuy)) for (const id of LINE_IDS) r.autoBuy[id] = bool(raw.autoBuy[id], true);
  r.budget = [1, 0.5, 0.1].includes(raw.budget as number) ? (raw.budget as number) : 1;
  r.capOnly = bool(raw.capOnly, false);
  r.trendRule = Math.floor(num(raw.trendRule, 3, 0, 20));
  r.collabs = boolMap(raw.collabs, COLLABS.map((c) => c.id));
  r.milestones = boolMap(raw.milestones);
  if (Array.isArray(raw.comments)) {
    for (const c of raw.comments.slice(0, 12)) {
      if (!isObj(c)) continue;
      r.comments.push({
        id: Math.floor(num(c.id, 0)),
        slot: Math.floor(num(c.slot, 0, 0, 5)),
        ttl: num(c.ttl, 5, 0, 60),
        maxTtl: num(c.maxTtl, 14, 1, 60),
        kind: str(c.kind, ['normal', 'trend', 'viral'] as const, 'normal'),
        textIdx: Math.floor(num(c.textIdx, 0, 0, 1e6)),
      });
    }
  }
  r.commentAcc = num(raw.commentAcc, 0, 0, 3);
  r.nextCommentId = Math.floor(num(raw.nextCommentId, 1, 1));
  for (const c of r.comments) if (c.id >= r.nextCommentId) r.nextCommentId = c.id + 1;
  const t = createTrend();
  if (isObj(raw.trend)) {
    t.phase = str(raw.trend.phase, ['idle', 'active'] as const, 'idle');
    t.timer = num(raw.trend.timer, 55, -10, 600);
    t.tag = typeof raw.trend.tag === 'string' ? raw.trend.tag.slice(0, 40) : '';
    t.mult = num(raw.trend.mult, 1, 1, 100);
    t.joined = bool(raw.trend.joined, false);
    t.nextTag = typeof raw.trend.nextTag === 'string' ? raw.trend.nextTag.slice(0, 40) : '';
    t.nextMult = num(raw.trend.nextMult, 0, 0, 100);
  }
  r.trend = t;
  if (isObj(raw.crewTimers)) for (const k of ['manager', 'bori']) r.crewTimers[k] = num(raw.crewTimers[k], 0, 0, 10);
  r.posts = num(raw.posts, 0);
  r.manualPosts = num(raw.manualPosts, 0);
  if (isObj(raw.postAcc)) for (const id of LINE_IDS) r.postAcc[id] = num(raw.postAcc[id], 0, 0, 1);
  r.net = bool(raw.net, false);
  r.creators = num(raw.creators, r.net ? 1 : 0);
  r.communities = num(raw.communities, 0);
  r.netPosts = num(raw.netPosts, 0);
  r.netPostAcc = num(raw.netPostAcc, 0, 0, 1);
  if (isObj(raw.chips)) for (const id of SIGNAL_IDS) r.chips[id] = Math.floor(num(raw.chips[id], 1, 0, 64));
  if (isObj(raw.petals)) for (const id of PETAL_IDS) r.petals[id] = bool(raw.petals[id], false);
  r.festival = bool(raw.festival, false);
  r.festivalGauge = num(raw.festivalGauge, 0, 0, 1);
  r.feedAi = str(raw.feedAi, ['off', 'balance', 'focus'] as const, 'off');
  r.feedFocus = str(raw.feedFocus, SIGNAL_IDS, 'heat');
  r.feedAiTimer = num(raw.feedAiTimer, 0, 0, 10);
  r.spotlights = num(raw.spotlights, 0);
  return r;
}

function restoreMeta(raw: unknown): MetaState {
  const m = createMeta();
  if (!isObj(raw)) return m;
  m.seeds = Math.floor(num(raw.seeds, 0, 0, 1e9));
  m.seedsTotal = Math.floor(num(raw.seedsTotal, m.seeds, 0, 1e9));
  m.perks = boolMap(raw.perks, PERKS.map((p) => p.id));
  m.runs = Math.floor(num(raw.runs, 0, 0, 1e6));
  m.totalTime = num(raw.totalTime, 0);
  m.totalPosts = num(raw.totalPosts, 0);
  m.totalManualPosts = num(raw.totalManualPosts, 0);
  m.totalHearts = num(raw.totalHearts, 0);
  m.totalReplies = num(raw.totalReplies, 0);
  m.manualReplies = num(raw.manualReplies, 0);
  m.trendsJoined = num(raw.trendsJoined, 0);
  m.trendsSeen = num(raw.trendsSeen, 0);
  m.virals = num(raw.virals, 0);
  m.peakFollowers = num(raw.peakFollowers, 0);
  if (isObj(raw.chipSeconds)) for (const id of SIGNAL_IDS) m.chipSeconds[id] = num(raw.chipSeconds[id], 0);
  m.clickbaitSeconds = num(raw.clickbaitSeconds, 0);
  m.sponsorSeconds = num(raw.sponsorSeconds, 0);
  m.flags = boolMap(raw.flags);
  m.ended = bool(raw.ended, false);
  m.endTime = num(raw.endTime, 0);
  m.endingSeen = bool(raw.endingSeen, false);
  if (isObj(raw.narrative)) {
    const n = raw.narrative;
    if (Array.isArray(n.choices)) {
      for (const [i, choice] of n.choices.slice(0, ECHO_EPISODES.length).entries()) {
        if (!ECHO_EPISODES[i].choices.some((c) => c.id === choice)) break;
        m.narrative.choices.push(choice as string);
      }
    }
    m.narrative.pending = m.narrative.choices.length < ECHO_EPISODES.length && bool(n.pending, false);
    m.narrative.elapsed = num(n.elapsed, 0, 0, 3600);
  }
  if (Array.isArray(raw.runHistory)) {
    for (const h of raw.runHistory.slice(0, 50)) {
      if (!isObj(h)) continue;
      m.runHistory.push({ time: num(h.time, 0), followers: num(h.followers, 0), bond: num(h.bond, 0), seeds: num(h.seeds, 0) });
    }
  }
  return m;
}

/** Migrate older schema versions in place (raw JSON). */
function migrate(raw: Obj): Obj {
  const v = typeof raw.v === 'number' ? raw.v : 0;
  if (v < 1) {
    // v0 (pre-release) had no meta block: treat as fresh meta.
    if (!isObj(raw.meta)) raw.meta = {};
  }
  raw.v = SAVE_VERSION;
  return raw;
}

export function deserialize(text: string, now = Date.now()): GameState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw)) return null;
  if (typeof raw.v === 'number' && raw.v > SAVE_VERSION) {
    // Save from a newer build: still try to read known fields.
  }
  migrate(raw);
  const s = createGame(typeof raw.rng === 'number' ? raw.rng | 0 : now | 0, now);
  s.run = restoreRun(raw.run);
  s.meta = restoreMeta(raw.meta);
  s.lastTs = num(raw.lastTs, now, 0, 1e16);
  s.createdAt = num(raw.createdAt, now, 0, 1e16);
  return s;
}

export function encodeExport(s: GameState): string {
  const json = serialize(s);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return 'MB1:' + btoa(bin);
}

export function decodeImport(text: string, now = Date.now()): GameState | null {
  const t = text.trim();
  try {
    if (t.startsWith('MB1:')) {
      const bin = atob(t.slice(4));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return deserialize(new TextDecoder().decode(bytes), now);
    }
    return deserialize(t, now);
  } catch {
    return null;
  }
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function saveTo(storage: StorageLike, s: GameState): boolean {
  try {
    const prev = storage.getItem(SAVE_KEY);
    if (prev) storage.setItem(BACKUP_KEY, prev);
    storage.setItem(SAVE_KEY, serialize(s));
    return true;
  } catch {
    return false;
  }
}

export function loadFrom(storage: StorageLike, now = Date.now()): { state: GameState; source: 'main' | 'backup' | 'new' } {
  try {
    const main = storage.getItem(SAVE_KEY);
    if (main) {
      const s = deserialize(main, now);
      if (s) return { state: s, source: 'main' };
    }
    const bak = storage.getItem(BACKUP_KEY);
    if (bak) {
      const s = deserialize(bak, now);
      if (s) return { state: s, source: 'backup' };
    }
  } catch {
    // storage unavailable (privacy mode etc.)
  }
  return { state: createGame(Date.now() | 0, now), source: 'new' };
}

export function wipe(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
    storage.removeItem(BACKUP_KEY);
  } catch {
    // ignore
  }
}
