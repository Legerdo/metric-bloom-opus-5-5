// Deterministic player model used for balance validation. It only uses the
// same public actions a human has through the UI.
import {
  COLLABS,
  COMMUNITY_UPGRADES,
  CREW_IDS,
  LINE_IDS,
  NET_UPGRADES,
  PERKS,
  STUDIO_UPGRADES,
  type LineId,
} from '../econ/defs';
import {
  collabCost,
  crewNextCost,
  derive,
  lineCost,
  lineUnlocked,
  reqMet,
  seedGain,
  type Derived,
} from '../econ/calc';
import {
  bestAllocation,
  buyLine,
  buyPerk,
  buyUpgrade,
  canPrestige,
  collabUnlocked,
  crewUnlocked,
  doCollab,
  doPrestige,
  hireCrew,
  joinTrend,
  post,
  reply,
  setFeedAi,
  tick,
  type Out,
} from '../econ/engine';
import { createGame, type GameState } from '../econ/state';

export interface BotProfile {
  name: string;
  /** manual posts per second while "at the keyboard" */
  clickRate: number;
  /** stop clicking once this many routines are owned (automation took over) */
  clickUntilRoutines: number;
  /** chance per second to notice and reply a visible comment */
  replyAttention: number;
  /** seconds between purchase decisions */
  decideEvery: number;
  /** join trends manually when multiplier >= this (0 = never) */
  trendMin: number;
  /** prestige once this many seeds are available */
  prestigeSeeds: number;
  /** re-plan feed chips every n seconds (before feed AI) */
  chipEvery: number;
  /** keep clickbait on? */
  clickbait: boolean;
  /** fraction of time the player is present (1 = always); absent periods skip manual actions */
  presence: number;
}

export const PROFILES: Record<string, BotProfile> = {
  active: {
    name: 'active',
    clickRate: 3,
    clickUntilRoutines: 60,
    replyAttention: 0.6,
    decideEvery: 1,
    trendMin: 3,
    prestigeSeeds: 12,
    chipEvery: 15,
    clickbait: true,
    presence: 1,
  },
  typical: {
    name: 'typical',
    clickRate: 2,
    clickUntilRoutines: 30,
    replyAttention: 0.3,
    decideEvery: 3,
    trendMin: 4,
    prestigeSeeds: 10,
    chipEvery: 40,
    clickbait: true,
    presence: 0.85,
  },
  slow: {
    name: 'slow',
    clickRate: 1.2,
    clickUntilRoutines: 20,
    replyAttention: 0.12,
    decideEvery: 8,
    trendMin: 5,
    prestigeSeeds: 8,
    chipEvery: 120,
    clickbait: false,
    presence: 0.7,
  },
  hasty: {
    name: 'hasty',
    clickRate: 2,
    clickUntilRoutines: 30,
    replyAttention: 0.25,
    decideEvery: 3,
    trendMin: 4,
    prestigeSeeds: 1,
    chipEvery: 60,
    clickbait: true,
    presence: 0.85,
  },
  idle: {
    name: 'idle',
    clickRate: 1,
    clickUntilRoutines: 8,
    replyAttention: 0.03,
    decideEvery: 20,
    trendMin: 0,
    prestigeSeeds: 8,
    chipEvery: 300,
    clickbait: true,
    presence: 0.5,
  },
};

export interface SimLogEntry {
  t: number;
  kind: string;
  id: string;
}

export interface SimResult {
  profile: string;
  log: SimLogEntry[];
  snapshots: { t: number; run: number; hearts: number; hps: number; F: number; bond: number; cap: number; creators: number; comm: number; lines: Record<LineId, number> }[];
  endTime: number | null;
  firstBuy: number | null;
  firstAuto: number | null;
  prestigeTimes: number[];
  state: GameState;
  nanSeen: boolean;
}

interface Candidate {
  kind: 'line' | 'up' | 'crew' | 'collab';
  id: string;
  hearts: number;
  bond: number;
  score: number;
}

function value(d: Derived, phi: number): number {
  return d.hps + d.fps * phi * 120 + d.bps * 0.5;
}

function followerWorth(s: GameState, d: Derived): number {
  // marginal hearts/s per extra follower, estimated numerically
  const F = s.run.followers;
  const dF = Math.max(1, F * 0.01);
  s.run.followers = F + dF;
  const d2 = derive(s);
  s.run.followers = F;
  return Math.max(0, (d2.hps - d.hps) / dF);
}

function evalCandidate(s: GameState, base: number, phi: number, apply: () => void, undo: () => void): number {
  apply();
  const d2 = derive(s);
  undo();
  return value(d2, phi) - base;
}

function decide(s: GameState, p: BotProfile, out: Out): void {
  const r = s.run;
  // bond upgrades: cheapest first, always
  for (const u of COMMUNITY_UPGRADES) {
    if (!r.ups[u.id] && reqMet(s, u.req) && r.bond >= u.cost) buyUpgrade(s, u.id, out);
  }
  // crew: always worth it once affordable
  for (const id of CREW_IDS) {
    if (!crewUnlocked(s, id)) continue;
    const c = crewNextCost(s, id);
    if (c && r.hearts >= c.hearts * 1.0 && r.bond >= c.bond) hireCrew(s, id, out);
  }
  if (r.crew.doyun) r.trendRule = Math.max(2, p.trendMin || 3);
  if (r.crew.manager) {
    r.capOnly = false;
  }

  const d = derive(s);
  const phi = followerWorth(s, d);
  const base = value(d, phi);
  const inc = Math.max(1e-9, d.hps);
  const cands: Candidate[] = [];

  for (const id of LINE_IDS) {
    if (!lineUnlocked(s, id)) continue;
    const cost = lineCost(s, id);
    const gain = evalCandidate(
      s,
      base,
      phi,
      () => r.lines[id]++,
      () => r.lines[id]--,
    );
    if (gain > 0) cands.push({ kind: 'line', id, hearts: cost, bond: 0, score: cost / inc + cost / gain });
  }
  for (const u of [...STUDIO_UPGRADES, ...NET_UPGRADES]) {
    if (r.ups[u.id] || !reqMet(s, u.req)) continue;
    if (u.id.startsWith('n_') && !r.net) continue;
    if (u.id === 'clickbait' && !p.clickbait) continue;
    let gain = evalCandidate(
      s,
      base,
      phi,
      () => {
        r.ups[u.id] = true;
        if (u.toggle) r.toggles[u.id] = true;
      },
      () => {
        delete r.ups[u.id];
        delete r.toggles[u.id];
      },
    );
    // structural upgrades (unlocks, automation) have value the local metric cannot see
    if (gain <= base * 0.05) gain = Math.max(gain, base * 0.3);
    cands.push({ kind: 'up', id: u.id, hearts: u.cost, bond: 0, score: u.cost / inc + u.cost / Math.max(1e-9, gain) });
  }
  if (collabUnlocked(s)) {
    const c = collabCost(s);
    for (const cb of COLLABS) {
      if (r.collabs[cb.id]) continue;
      if (r.bond < c.bond) continue;
      const gain = Math.max(base * 0.4, 1e-9);
      cands.push({ kind: 'collab', id: cb.id, hearts: c.hearts, bond: c.bond, score: c.hearts / inc + c.hearts / gain });
      break;
    }
  }
  cands.sort((a, b) => a.score - b.score);
  let bought = 0;
  for (const c of cands.slice(0, 3)) {
    if (r.hearts < c.hearts || r.bond < c.bond) {
      // save for the best candidate unless something cheap and nearly as good exists
      if (bought === 0 && c === cands[0]) continue;
      break;
    }
    if (c.kind === 'line') buyLine(s, c.id as LineId, 1, out);
    else if (c.kind === 'up') buyUpgrade(s, c.id, out);
    else if (c.kind === 'collab') doCollab(s, c.id, out);
    bought++;
  }
  // bulk buy: if hearts pile up, keep buying the best line
  let guard = 0;
  while (guard++ < 40) {
    const best = cands.find((c) => c.kind === 'line');
    if (!best) break;
    const cost = lineCost(s, best.id as LineId);
    if (r.hearts < cost * 4) break;
    buyLine(s, best.id as LineId, 1, out);
  }
  if (!p.clickbait && r.toggles.clickbait) r.toggles.clickbait = false;
}

const PERK_ORDER = ['p_crew', 'p_studio', 'p_routine', 'p_regulars', 'p_trend', 'p_blueprint', 'p_collab', 'p_voice'];

export function runBot(profileName: string, maxMinutes = 240, seed = 12345, stopWhen?: (s: GameState) => boolean, start?: GameState): SimResult {
  const p = PROFILES[profileName];
  const s = start ?? createGame(seed, 0);
  const dt = 0.1;
  const log: SimLogEntry[] = [];
  const snapshots: SimResult['snapshots'] = [];
  const out: Out = [];
  let firstBuy: number | null = null;
  let firstAuto: number | null = null;
  const prestigeTimes: number[] = [];
  let clickAcc = 0;
  let decideAcc = 0;
  let chipAcc = 0;
  let snapAcc = 0;
  let nanSeen = false;
  let presentUntil = 0;
  let absentUntil = 0;
  let rngState = seed ^ 0x9e3779b9;
  const brand = (): number => {
    rngState = (rngState * 1664525 + 1013904223) | 0;
    return ((rngState >>> 0) % 100000) / 100000;
  };
  const total = maxMinutes * 60;
  for (let t = 0; t < total; t += dt) {
    const T = s.meta.totalTime;
    // presence model: alternate present/absent chunks
    if (T >= presentUntil && T >= absentUntil) {
      if (brand() < p.presence) presentUntil = T + 120 + brand() * 240;
      else absentUntil = T + 60 + brand() * 180;
    }
    const present = T < presentUntil;
    const r = s.run;
    const routines = r.lines.text + r.lines.photo + r.lines.video + r.lines.live;

    if (present) {
      if (routines < p.clickUntilRoutines || !r.ups.heartfelt || brand() < 0.02) {
        clickAcc += p.clickRate * dt * (routines < p.clickUntilRoutines ? 1 : 0.3);
        while (clickAcc >= 1) {
          clickAcc -= 1;
          post(s, out);
        }
      }
      for (const c of [...r.comments]) {
        if (c.maxTtl - c.ttl > 1.5 && brand() < p.replyAttention * dt) reply(s, c.id, true, out);
      }
      if (p.trendMin > 0 && r.trend.phase === 'active' && !r.trend.joined && r.trend.mult >= p.trendMin) joinTrend(s, false, out);
      decideAcc += dt;
      if (decideAcc >= p.decideEvery) {
        decideAcc = 0;
        decide(s, p, out);
        if (r.net) {
          if (r.ups.n_feedai && r.feedAi === 'off') setFeedAi(s, 'balance');
          chipAcc += p.decideEvery;
          if (r.feedAi === 'off' && chipAcc >= p.chipEvery) {
            chipAcc = 0;
            r.chips = bestAllocation(s, derive(s));
          }
        }
        // prestige
        // spend petal seeds later on
        if (s.meta.runs > 0) {
          for (const id of PERK_ORDER) {
            const pk = PERKS.find((x) => x.id === id)!;
            if (!s.meta.perks[id] && s.meta.seeds >= pk.cost) buyPerk(s, id, out);
          }
        }
        if (s.meta.runs === 0 && canPrestige(s) && seedGain(s) >= p.prestigeSeeds) {
          doPrestige(s, out);
          prestigeTimes.push(s.meta.totalTime);
          for (const id of PERK_ORDER) {
            const pk = PERKS.find((x) => x.id === id)!;
            if (s.meta.seeds - pk.cost >= 2) buyPerk(s, id, out);
          }
        }
      }
    }

    tick(s, dt, out);

    for (const e of out) {
      if (e.t === 'buy') {
        if (firstBuy === null) firstBuy = s.meta.totalTime;
        if (e.kind !== 'line') log.push({ t: s.meta.totalTime, kind: 'buy:' + e.kind, id: e.id });
        else if (firstAuto === null) {
          firstAuto = s.meta.totalTime;
          log.push({ t: s.meta.totalTime, kind: 'buy:line', id: e.id });
        }
      } else if (e.t === 'festival') {
        const n = derive(s).net;
        log.push({ t: s.meta.totalTime, kind: 'festival', id: `fps=${n.fps.toExponential(2)} bps=${n.bps.toExponential(2)} pps=${n.pps.toExponential(2)} kps=${n.kps.toExponential(2)}` });
      } else if (e.t === 'unlock' || e.t === 'milestone' || e.t === 'petal' || e.t === 'prestige' || e.t === 'ending') {
        const id = 'id' in e ? String(e.id) : '';
        log.push({ t: s.meta.totalTime, kind: e.t, id });
      }
    }
    out.length = 0;

    const rr = s.run;
    if (!Number.isFinite(rr.hearts) || !Number.isFinite(rr.followers) || !Number.isFinite(rr.bond) || rr.hearts < 0) nanSeen = true;

    snapAcc += dt;
    if (snapAcc >= 300) {
      snapAcc = 0;
      const d = derive(s);
      snapshots.push({
        t: s.meta.totalTime,
        run: s.meta.runs,
        hearts: rr.hearts,
        hps: d.hps,
        F: rr.followers,
        bond: rr.bondEarned,
        cap: d.cap,
        creators: rr.creators,
        comm: rr.communities,
        lines: { ...rr.lines },
      });
    }
    if (s.meta.ended) break;
    if (stopWhen && stopWhen(s)) break;
  }
  return {
    profile: p.name,
    log,
    snapshots,
    endTime: s.meta.ended ? s.meta.endTime : null,
    firstBuy,
    firstAuto,
    prestigeTimes,
    state: s,
    nanSeen,
  };
}
