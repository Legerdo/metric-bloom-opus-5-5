// Derived economy values. Everything here is a pure function of GameState.
import { narrativeEffects } from './narrative';
import {
  COLLABS,
  COMMUNITY_UPGRADES,
  CREW,
  LINE_IDS,
  LINES,
  NET_UPGRADES,
  PETAL_IDS,
  SIGNAL_IDS,
  STUDIO_UPGRADES,
  type CrewId,
  type LineId,
  type PetalId,
  type SignalId,
  type UpgradeDef,
} from './defs';
import type { GameState, RunState } from './state';

/** Balance constants. Tuned with scripts/balance.ts. */
export const BAL = {
  followBase: 0.03,
  share: 1e-4,
  eng: 0.12,
  reach: 0.25,
  capBase: 10,
  capBondK: 5,
  overcapEff: 0.25,
  commentBase: 0.12,
  commentSqrt: 0.03,
  commentMax: 0.9,
  commentTtl: 14,
  commentSlots: 6,
  replyBase: 1,
  replySqrt: 0.08,
  trendIdleMin: 50,
  trendIdleMax: 80,
  trendActive: 30,
  trendMultMin: 2,
  trendMultMax: 7,
  viralChance: 1 / 200,
  viralFollowSec: 40,
  viralHeartSec: 30,
  platformK: 5e4,
  manualHv: 1,
  manualFv: 1,
  heartfeltFrac: 0.2,
  offlineEff: 0.5,
  offlineMaxSec: 3600,
  seedDiv: 50,
  seedBonus: 0.15,
  trueFanK: 0.1,
  // network
  netUnlockF: 5e4,
  netBaseChips: 4,
  netCreatorFrac: 0.002,
  netApproach: 0.03,
  netPostRate: 0.2,
  netGrowth: 0.0007,
  netChurn: 0.00035,
  netHv: 2,
  netBv: 0.05,
  netKv: 0.0005,
  spotlightSec: 0.1,
  festivalFillSec: 90,
};

/** Petal thresholds (stock values) for the Great Bloom. */
export const PETAL_AT: Record<PetalId, number> = {
  reach: 1e8,
  bond: 5e7,
  create: 5e4,
  community: 1e4,
};

/** Festival flow targets: all four must be sustained together. */
export const FESTIVAL_AT = {
  users: 6e6,
  bond: 1.5e7,
  posts: 1e7,
  comm: 5e3,
};

export const has = (s: GameState, id: string): boolean => !!s.run.ups[id];
export const ms = (s: GameState, id: string): boolean => !!s.run.milestones[id];
export const on = (s: GameState, id: string): boolean => !!s.run.ups[id] && !!s.run.toggles[id];
export const perk = (s: GameState, id: string): boolean => !!s.meta.perks[id];
export const collab = (s: GameState, id: string): boolean => !!s.run.collabs[id];
export const crewLv = (s: GameState, id: CrewId): number => s.run.crew[id] ?? 0;

export function lineUnlocked(s: GameState, id: LineId): boolean {
  switch (id) {
    case 'text':
      return s.run.heartsEarned >= 5 || s.run.lines.text > 0;
    case 'photo':
      return has(s, 'phone');
    case 'video':
      return has(s, 'editor');
    case 'live':
      return has(s, 'livecomm');
  }
}

export function reqMet(s: GameState, req: string | undefined): boolean {
  if (!req) return true;
  switch (req) {
    case 'phone':
      return has(s, 'phone');
    case 'editor':
      return has(s, 'editor');
    case 'live':
      return has(s, 'livecomm');
    case 'trends':
      return ms(s, 'm300');
    case 'prestige':
      return ms(s, 'm30000') || s.meta.runs > 0;
    default:
      return true;
  }
}

export function lineCost(s: GameState, id: LineId, owned = s.run.lines[id]): number {
  const d = LINES[id];
  return d.baseCost * Math.pow(d.growth, owned);
}

export function lineBulkCost(s: GameState, id: LineId, count: number): number {
  const d = LINES[id];
  const n = s.run.lines[id];
  return (d.baseCost * Math.pow(d.growth, n) * (Math.pow(d.growth, count) - 1)) / (d.growth - 1);
}

export function lineMaxAffordable(s: GameState, id: LineId, budget = s.run.hearts): number {
  const d = LINES[id];
  const first = lineCost(s, id);
  if (budget < first) return 0;
  const m = Math.floor(Math.log(1 + (budget * (d.growth - 1)) / first) / Math.log(d.growth));
  return Math.max(0, m);
}

export function linesOwnedTypes(r: RunState): number {
  let n = 0;
  for (const id of LINE_IDS) if (r.lines[id] > 0) n++;
  return n;
}

export function capacity(s: GameState): number {
  let c = BAL.capBase + BAL.capBondK * Math.log10(1 + s.run.bondEarned / 2);
  if (has(s, 'fanart')) c += 10;
  if (collab(s, 'books')) c += 15;
  if (has(s, 'meetup')) c *= 1.5;
  return Math.floor(c);
}

/** Total bond needed (bondEarned) for capacity to reach `target`. */
export function bondForCap(s: GameState, target: number): number {
  let adds = 0;
  if (has(s, 'fanart')) adds += 10;
  if (collab(s, 'books')) adds += 15;
  const mult = has(s, 'meetup') ? 1.5 : 1;
  const x = (target / mult - adds - BAL.capBase) / BAL.capBondK;
  if (x <= 0) return 0;
  if (x > 290) return Infinity;
  return 2 * (Math.pow(10, x) - 1);
}

export function effCount(n: number, cap: number): number {
  return n <= cap ? n : cap + (n - cap) * BAL.overcapEff;
}

/**
 * Personal reach saturation. One account can only reach so many people by itself:
 * on Bloomline (run 0) the platform throttles it hard; on your own network the
 * ceiling is 4× higher, and further growth has to come from the network's creators.
 */
export function platformK(s: GameState): number {
  return s.meta.runs > 0 ? BAL.platformK * 4 : BAL.platformK;
}
export function platformEff(s: GameState): number {
  return 1 / (1 + s.run.followers / platformK(s));
}

export function trendMultValue(s: GameState, base: number): number {
  let m = base;
  if (has(s, 'analytics')) m += 2;
  if (perk(s, 'p_trend')) m += 2;
  if (collab(s, 'pickle')) m += 3;
  return m;
}

export function trendJoined(s: GameState): boolean {
  return s.run.trend.phase === 'active' && s.run.trend.joined;
}

export function seedMult(s: GameState): number {
  return 1 + BAL.seedBonus * s.meta.seeds;
}

export function heartMult(s: GameState): number {
  const r = s.run;
  let m = narrativeEffects(s).hearts;
  if (has(s, 'window')) m *= 2;
  if (ms(s, 'm100')) m *= 2;
  if (ms(s, 'm1000')) m *= 2;
  if (ms(s, 'm10000')) m *= 2;
  if (ms(s, 'm100000')) m *= 2;
  if (ms(s, 'm1e6')) m *= 2;
  if (ms(s, 'm1e7')) m *= 2;
  if (has(s, 'series')) m *= 1 + 0.25 * linesOwnedTypes(r);
  if (on(s, 'sponsor')) m *= 3;
  if (has(s, 'letters')) m *= 1 + Math.log10(1 + r.bondEarned) / 2;
  if (has(s, 'archive')) m *= 1 + Math.log10(1 + s.meta.totalPosts) / 2;
  m *= seedMult(s);
  if (trendJoined(s)) m *= 1.5;
  return m;
}

/** Follower multiplier before reach saturation. */
export function followMultRaw(s: GameState): number {
  let m = 1;
  if (has(s, 'hashtag')) m *= 2;
  if (ms(s, 'm5000')) m *= 1.5;
  if (ms(s, 'm10000')) m *= 1.5;
  if (on(s, 'clickbait')) m *= 2;
  if (has(s, 'crosspost')) m *= 2;
  m *= seedMult(s);
  if (trendJoined(s)) m *= s.run.trend.mult;
  return m;
}
export function followMult(s: GameState): number {
  return followMultRaw(s) * platformEff(s);
}

export function bondMult(s: GameState): number {
  let m = narrativeEffects(s).bond;
  if (collab(s, 'walk')) m *= 2;
  if (on(s, 'sponsor')) m *= 0.6;
  if (s.run.petals.bond) m *= 2;
  return m;
}

/** Hearts-per-post scale from audience size (sublinear: big audiences react proportionally less). */
export function audience(F: number): number {
  return 1 + Math.sqrt(F) * BAL.eng;
}
/** Follower-per-post scale: mild word-of-mouth effect. */
export function reachF(F: number): number {
  return 1 + Math.log10(1 + F) * BAL.reach;
}

function lineHvMult(s: GameState, id: LineId): number {
  let m = 1;
  if (id === 'photo') {
    if (has(s, 'ringlight')) m *= 2;
    if (collab(s, 'cook')) m *= 2;
  } else if (id === 'video') {
    if (collab(s, 'cat')) m *= 2;
  } else if (id === 'live') {
    if (has(s, 'mic')) m *= 2;
    if (collab(s, 'radio')) m *= 2;
  }
  return m;
}

function lineFvMult(s: GameState, id: LineId): number {
  let m = 1;
  if (id === 'video') {
    if (has(s, 'thumbnail')) m *= 2;
    if (collab(s, 'cat')) m *= 1.5;
  }
  return m;
}

export function lineRateMult(s: GameState): number {
  let m = 1;
  if (has(s, 'timetable')) m *= 1.5;
  if (has(s, 'masterclass')) m *= 2;
  return m;
}

export function replyScale(F: number): number {
  return BAL.replyBase + Math.sqrt(F) * BAL.replySqrt;
}

/** Bond per reply for a given comment kind. manual=true applies the voice perk. */
export function replyBond(s: GameState, kind: 'normal' | 'trend' | 'viral', manual: boolean): number {
  let b = replyScale(s.run.followers) * bondMult(s);
  if (has(s, 'names')) b *= 2;
  if (on(s, 'clickbait')) b *= has(s, 'rules') ? 0.75 : 0.5;
  if (kind === 'trend' && !has(s, 'rules')) b *= 0.4;
  if (kind === 'viral') b *= 1.5;
  if (manual && perk(s, 'p_voice')) b *= 5;
  if (manual) b *= narrativeEffects(s).manual;
  return b;
}

export function commentRate(s: GameState): number {
  if (!ms(s, 'm10')) return 0;
  let r = BAL.commentBase + BAL.commentSqrt * Math.sqrt(s.run.followers);
  if (has(s, 'regulars')) r *= 1.5;
  return Math.min(BAL.commentMax, r);
}

export function commentTtl(s: GameState): number {
  return BAL.commentTtl + (has(s, 'regulars') ? 6 : 0);
}

export function totalChips(s: GameState): number {
  let n = BAL.netBaseChips;
  for (const id of ['n_slot1', 'n_slot2', 'n_slot3', 'n_slot4']) if (has(s, id)) n++;
  if (perk(s, 'p_blueprint')) n += 2;
  if (s.run.petals.bond) n++;
  if (s.run.petals.community) n++;
  return n;
}

export function usedChips(r: RunState): number {
  let n = 0;
  for (const id of SIGNAL_IDS) n += r.chips[id];
  return n;
}

export interface LineDerived {
  count: number;
  eff: number;
  pps: number;
  hpp: number;
  fpp: number;
  hps: number;
  fps: number;
  bps: number;
}

export interface NetDerived {
  pps: number;
  hps: number;
  fps: number;
  cps: number;
  bps: number;
  kps: number;
  ccap: number;
  conflict: number;
  bubble: number;
  commBonus: number;
  /** users growth per second (fraction) */
  growth: number;
  /** target creator share of users */
  share: number;
  inflow: number;
  churn: number;
}

export interface Derived {
  cap: number;
  heartMult: number;
  followMult: number;
  bondMult: number;
  audience: number;
  reach: number;
  platformEff: number;
  line: Record<LineId, LineDerived>;
  routineHps: number;
  routineFps: number;
  routineBps: number;
  routinePps: number;
  net: NetDerived;
  hps: number;
  fps: number;
  bps: number;
  manualHearts: number;
  manualFollowers: number;
  commentRate: number;
  /** per-second relative follower growth from sharing */
  shareRate: number;
  shareFps: number;
}

export function emptyNet(): NetDerived {
  return { pps: 0, hps: 0, fps: 0, cps: 0, bps: 0, kps: 0, ccap: 0, conflict: 1, bubble: 1, commBonus: 1, growth: 0, share: 0, inflow: 0, churn: 0 };
}

/**
 * Network flows for a given chip allocation (also used by the feed AI to score options).
 * Users grow exponentially at a bounded rate g (shown to the player as %/min);
 * creators track a target share of users; bond, communities and hearts scale with
 * creator posting volume.
 */
export function netFlows(s: GameState, chips: Record<SignalId, number>, hm: number, bm: number): NetDerived {
  const r = s.run;
  if (!r.net) return emptyNet();
  const F = r.followers;
  const moder = has(s, 'n_moderation') ? 0.5 : 1;
  const conflict = 1 / (1 + 0.18 * chips.heat * moder);
  const bubble = 1 / (1 + 0.12 * chips.close * (has(s, 'n_translate') ? 0.5 : 1));
  const depthDrag = 1 / (1 + 0.06 * chips.depth);
  const rough = 1 / (1 + 0.1 * chips.novel);

  // creators: a target share of users
  let share = BAL.netCreatorFrac * (0.4 + 0.6 * chips.novel);
  if (has(s, 'n_fund')) share *= 2;
  if (has(s, 'n_spot')) share *= 1.5;
  const ccap = F * share + 1;
  const cps = Math.max(0, ccap - r.creators) * BAL.netApproach;

  // posting volume
  const commBonus = 1 + 0.12 * Math.log2(1 + r.communities) * (has(s, 'n_groups') ? 2 : 1);
  const bondBonus = 1 + 0.03 * Math.log2(1 + r.bondEarned);
  let rate = BAL.netPostRate * commBonus * bondBonus;
  if (has(s, 'n_notif')) rate *= 2;
  if (r.petals.create) rate *= 2;
  if (has(s, 'n_festivalprep')) rate *= 2;
  const pps = r.creators * rate;

  // user growth = inflow − churn (both per second, as a fraction of users).
  // Heat pulls people in with diminishing returns but also drives them away;
  // depth and closeness keep them. A balanced feed grows fastest.
  const activity = F > 0 ? pps / F / (BAL.netCreatorFrac * BAL.netPostRate) : 0;
  const actF = Math.min(1.6, Math.pow(Math.max(0, activity), 0.25));
  let inflow = BAL.netGrowth * Math.sqrt(0.5 + chips.heat) * bubble * depthDrag * actF;
  if (has(s, 'n_recommend')) inflow *= 1.15;
  if (has(s, 'n_translate')) inflow *= 1.1;
  if (r.petals.reach) inflow *= 1.15;
  const heatChurn = 1 + (has(s, 'n_moderation') ? 0.1 : 0.2) * chips.heat;
  const churn = (BAL.netChurn * heatChurn * heatChurn) / (1 + 0.35 * (chips.depth + chips.close));
  const g = Math.max(0, inflow - churn);
  const fps = F * g;

  const hpp = BAL.netHv * hm * (1 + Math.sqrt(F) * BAL.eng) * (1 + 0.25 * chips.heat) * (1 + 0.1 * chips.depth) * rough;

  let nb = bm;
  if (has(s, 'n_archive')) nb *= 2;
  const bps = pps * BAL.netBv * (0.2 + chips.depth) * conflict * nb;

  let km = 1;
  if (has(s, 'n_groups')) km *= 2;
  if (r.petals.community) km *= 2;
  if (has(s, 'n_festivalprep')) km *= 1.5;
  const kps = pps * BAL.netKv * (0.2 + chips.close) * conflict * km;

  return { pps, hps: pps * hpp * narrativeEffects(s).auto, fps, cps, bps, kps, ccap, conflict, bubble, commBonus, growth: g, share, inflow, churn };
}

export function derive(s: GameState): Derived {
  const r = s.run;
  const F = r.followers;
  const cap = capacity(s);
  const hm = heartMult(s);
  const fm = followMult(s);
  const bm = bondMult(s);
  const aud = audience(F);
  const rch = reachF(F);
  const rateM = lineRateMult(s);
  const line = {} as Record<LineId, LineDerived>;
  let routineHps = 0;
  let routineFps = 0;
  let routineBps = 0;
  let routinePps = 0;
  for (const id of LINE_IDS) {
    const d = LINES[id];
    const count = r.lines[id];
    const eff = effCount(count, cap);
    const pps = eff * d.rate * rateM;
    const hpp = d.hv * lineHvMult(s, id) * hm * aud * narrativeEffects(s).auto;
    const fpp = d.fv * BAL.followBase * lineFvMult(s, id) * fm * rch;
    let bpp = 0;
    if (d.bond > 0) {
      bpp = d.bond * bm * replyScale(F) * (collab(s, 'radio') ? 2 : 1);
    }
    const ld: LineDerived = { count, eff, pps, hpp, fpp, hps: pps * hpp, fps: pps * fpp, bps: pps * bpp };
    line[id] = ld;
    routineHps += ld.hps;
    routineFps += ld.fps;
    routineBps += ld.bps;
    routinePps += pps;
  }
  // Word of mouth: existing followers share posts. Growth rate scales gently with
  // posting volume (log) and strongly with follower multipliers.
  const shareRate = shareGrowth(s, routinePps, followMultRaw(s)) * platformEff(s);
  const shareFps = F * shareRate;
  routineFps += shareFps;

  const net = netFlows(s, r.chips, hm, bm);

  let manualMult = 1;
  if (has(s, 'phone')) manualMult *= 3;
  if (perk(s, 'p_voice')) manualMult *= 5;
  let manualHearts = BAL.manualHv * manualMult * hm * aud;
  if (has(s, 'heartfelt')) manualHearts += (routineHps + net.hps) * BAL.heartfeltFrac;
  manualHearts *= narrativeEffects(s).manual;
  const manualFollowers = BAL.manualFv * BAL.followBase * (perk(s, 'p_voice') ? 5 : 1) * fm * rch;

  return {
    cap,
    heartMult: hm,
    followMult: fm,
    bondMult: bm,
    audience: aud,
    reach: rch,
    platformEff: platformEff(s),
    line,
    routineHps,
    routineFps,
    routineBps,
    routinePps,
    net,
    hps: routineHps + net.hps,
    fps: routineFps + net.fps,
    bps: routineBps + net.bps,
    manualHearts,
    manualFollowers,
    commentRate: commentRate(s),
    shareRate,
    shareFps,
  };
}

export function shareGrowth(s: GameState, pps: number, fm: number): number {
  if (s.run.followers < 1) return 0;
  // sqrt keeps stacked follower multipliers from turning sharing into a runaway
  return BAL.share * Math.log2(2 + pps) * Math.sqrt(fm);
}

// ── Prestige ────────────────────────────────────────────────────────────────
export function trueFans(s: GameState): number {
  const r = s.run;
  let t = Math.sqrt(Math.max(0, r.followers) * Math.max(1, r.bondEarned)) * BAL.trueFanK;
  if (has(s, 'fanclub')) t *= 1.5;
  return Math.floor(t);
}

export function seedGain(s: GameState): number {
  return Math.floor(Math.sqrt(trueFans(s) / BAL.seedDiv));
}

export function prestigeUnlocked(s: GameState): boolean {
  return ms(s, 'm30000') || s.meta.runs > 0;
}

// ── Collabs ─────────────────────────────────────────────────────────────────
export function collabCount(r: RunState): number {
  let n = 0;
  for (const c of COLLABS) if (r.collabs[c.id]) n++;
  return n;
}

export function collabCost(s: GameState): { hearts: number; bond: number } {
  const n = collabCount(s.run);
  let hearts = 2e6 * Math.pow(6, n);
  if (perk(s, 'p_collab')) hearts *= 0.1;
  return { hearts, bond: 150 * Math.pow(3, n) };
}

// ── Crew ────────────────────────────────────────────────────────────────────
export function crewNextCost(s: GameState, id: CrewId): { hearts: number; bond: number } | null {
  const lv = crewLv(s, id);
  const def = CREW[id];
  if (lv >= def.levels.length) return null;
  return { hearts: def.levels[lv].hearts, bond: def.levels[lv].bond };
}

export function boriInterval(lv: number): number {
  return lv >= 3 ? 0.7 : lv === 2 ? 1.5 : 3;
}
export function boriEff(lv: number): number {
  return lv >= 3 ? 1 : lv === 2 ? 0.8 : 0.6;
}

// ── Upgrade lookup ──────────────────────────────────────────────────────────
const ALL_UPS: UpgradeDef[] = [...STUDIO_UPGRADES, ...COMMUNITY_UPGRADES, ...NET_UPGRADES];
const UP_BY_ID = new Map<string, UpgradeDef>(ALL_UPS.map((u) => [u.id, u]));
export function upgradeDef(id: string): UpgradeDef | undefined {
  return UP_BY_ID.get(id);
}
export function allUpgradeIds(): string[] {
  return ALL_UPS.map((u) => u.id);
}

// ── Petals & festival ───────────────────────────────────────────────────────
export function petalValue(s: GameState, id: PetalId): number {
  const r = s.run;
  switch (id) {
    case 'reach':
      return r.followers;
    case 'bond':
      return r.bondEarned;
    case 'create':
      return r.creators;
    case 'community':
      return r.communities;
  }
}

export function allPetals(s: GameState): boolean {
  for (const id of PETAL_IDS) if (!s.run.petals[id]) return false;
  return true;
}

export interface FestivalRatios {
  users: number;
  bond: number;
  posts: number;
  comm: number;
  min: number;
}

export function festivalRatiosFor(n: NetDerived): FestivalRatios {
  const users = n.fps / FESTIVAL_AT.users;
  const bond = n.bps / FESTIVAL_AT.bond;
  const posts = n.pps / FESTIVAL_AT.posts;
  const comm = n.kps / FESTIVAL_AT.comm;
  return { users, bond, posts, comm, min: Math.min(users, bond, posts, comm) };
}
