import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../src/econ/state';
import {
  buyLine,
  buyPerk,
  buyUpgrade,
  canPrestige,
  doPrestige,
  hireCrew,
  joinTrend,
  post,
  reply,
  setChip,
  simulateOffline,
  tick,
  toggleUpgrade,
  type Out,
} from '../src/econ/engine';
import { BAL, bondForCap, capacity, derive, lineBulkCost, lineCost, lineMaxAffordable, seedGain, totalChips, usedChips } from '../src/econ/calc';
import { nextGoal } from '../src/econ/goals';
import { runBot } from '../src/sim/bot';

function fresh(): GameState {
  return createGame(1234, 0);
}

function run(s: GameState, seconds: number, out: Out = []): Out {
  for (let t = 0; t < seconds; t += 0.1) tick(s, 0.1, out);
  return out;
}

describe('first verb', () => {
  it('posting gives hearts immediately and a goal is always shown', () => {
    const s = fresh();
    expect(nextGoal(s).text.length).toBeGreaterThan(0);
    const out: Out = [];
    post(s, out);
    expect(s.run.hearts).toBeGreaterThan(0);
    expect(out.some((e) => e.t === 'post')).toBe(true);
  });

  it('first purchase is reachable within a handful of posts', () => {
    const s = fresh();
    let n = 0;
    while (s.run.hearts < 10 && n < 100) {
      post(s);
      n++;
    }
    expect(n).toBeLessThanOrEqual(12);
    expect(buyUpgrade(s, 'window')).toBe(true);
  });
});

describe('costs', () => {
  it('line costs grow and bulk cost matches the sum of singles', () => {
    const s = fresh();
    s.run.heartsEarned = 10;
    const c0 = lineCost(s, 'text');
    s.run.lines.text = 5;
    expect(lineCost(s, 'text')).toBeGreaterThan(c0);
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += lineCost(s, 'text', 5 + i);
    expect(lineBulkCost(s, 'text', 10)).toBeCloseTo(sum, 6);
  });

  it('max-affordable purchase never overspends', () => {
    const s = fresh();
    s.run.heartsEarned = 10;
    s.run.hearts = 12345.678;
    const n = lineMaxAffordable(s, 'text');
    expect(n).toBeGreaterThan(0);
    const bought = buyLine(s, 'text', 'max');
    expect(bought).toBe(n);
    expect(s.run.hearts).toBeGreaterThanOrEqual(0);
    expect(s.run.hearts).toBeLessThan(lineCost(s, 'text'));
  });

  it('cannot buy without enough currency and never goes negative', () => {
    const s = fresh();
    expect(buyUpgrade(s, 'window')).toBe(false);
    expect(hireCrew(s, 'manager')).toBe(false);
    expect(s.run.hearts).toBe(0);
  });
});

describe('capacity and bond', () => {
  it('bondForCap is the inverse of capacity', () => {
    const s = fresh();
    for (const target of [15, 20, 30, 45]) {
      const b = bondForCap(s, target);
      s.run.bondEarned = b * 1.0001 + 0.01;
      expect(capacity(s)).toBeGreaterThanOrEqual(target);
      s.run.bondEarned = Math.max(0, b * 0.97 - 0.01);
      expect(capacity(s)).toBeLessThan(target);
    }
  });

  it('over-capacity routines are less efficient', () => {
    const s = fresh();
    s.run.heartsEarned = 10;
    s.run.lines.text = capacity(s);
    const a = derive(s).line.text.pps;
    s.run.lines.text *= 2;
    const b = derive(s).line.text.pps;
    expect(b / a).toBeLessThan(1.5);
    expect(b).toBeGreaterThan(a);
  });

  it('replying converts a comment into bond', () => {
    const s = fresh();
    s.run.followers = 50;
    s.run.milestones.m10 = true;
    const out = run(s, 30);
    const c = s.run.comments[0];
    expect(out.some((e) => e.t === 'comment')).toBe(true);
    expect(c).toBeDefined();
    expect(reply(s, c.id, true)).toBe(true);
    expect(s.run.bond).toBeGreaterThan(0);
    expect(s.meta.manualReplies).toBe(1);
  });
});

describe('automation', () => {
  it('routines produce while idle, and production speeds up with purchases', () => {
    const s = fresh();
    s.run.heartsEarned = 10;
    s.run.hearts = 12;
    buyLine(s, 'text', 1);
    const r0 = derive(s).hps;
    run(s, 10);
    expect(s.run.hearts).toBeGreaterThan(0);
    s.run.hearts = 1e4;
    buyLine(s, 'text', 'max');
    expect(derive(s).hps).toBeGreaterThan(r0 * 5);
  });

  it('the manager buys routines automatically', () => {
    const s = fresh();
    s.run.heartsEarned = 10;
    s.run.crew.manager = 1;
    s.run.hearts = 5000;
    run(s, 5);
    expect(s.run.lines.text).toBeGreaterThan(5);
  });

  it('the trend analyst follows the rule', () => {
    const s = fresh();
    s.run.milestones.m300 = true;
    s.run.crew.doyun = 1;
    s.run.trendRule = 1;
    s.run.trend.timer = 0.05;
    const out = run(s, 1);
    expect(out.some((e) => e.t === 'trendStart')).toBe(true);
    expect(s.run.trend.joined).toBe(true);
  });

  it('manual trend join only works while a trend is active', () => {
    const s = fresh();
    expect(joinTrend(s, false)).toBe(false);
  });
});

describe('policies', () => {
  it('clickbait trades bond for followers and can be toggled', () => {
    const s = fresh();
    s.run.followers = 1000;
    s.run.heartsEarned = 10;
    s.run.lines.text = 10;
    s.run.hearts = 1e7;
    const f0 = derive(s).fps;
    expect(buyUpgrade(s, 'clickbait')).toBe(true);
    expect(derive(s).fps).toBeGreaterThan(f0 * 1.5);
    expect(toggleUpgrade(s, 'clickbait')).toBe(true);
    expect(derive(s).fps).toBeCloseTo(f0, 6);
  });
});

describe('prestige', () => {
  it('is gated, gives seeds, keeps meta, and happens once', () => {
    const s = fresh();
    expect(canPrestige(s)).toBe(false);
    s.run.milestones.m30000 = true;
    s.run.followers = 3e4;
    s.run.bondEarned = 2e4;
    const gain = seedGain(s);
    expect(gain).toBeGreaterThan(0);
    s.run.lines.text = 50;
    expect(doPrestige(s)).toBe(true);
    expect(s.meta.seeds).toBe(gain);
    expect(s.meta.runs).toBe(1);
    expect(s.run.lines.text).toBe(0);
    expect(s.run.followers).toBeGreaterThan(0);
    expect(canPrestige(s)).toBe(false);
    expect(buyPerk(s, 'p_crew')).toBe(true);
    expect(s.run.crew.manager).toBe(1);
  });
});

describe('network', () => {
  function netState(): GameState {
    const s = fresh();
    s.meta.runs = 1;
    s.run.followers = BAL.netUnlockF;
    tick(s, 0.1);
    return s;
  }

  it('opens after independence and turns followers into producers', () => {
    const s = netState();
    expect(s.run.net).toBe(true);
    expect(usedChips(s.run)).toBe(totalChips(s));
    run(s, 60);
    expect(s.run.creators).toBeGreaterThan(1);
    expect(derive(s).net.pps).toBeGreaterThan(0);
  });

  it('chip allocation respects the budget', () => {
    const s = netState();
    expect(setChip(s, 'heat', 1)).toBe(false);
    expect(setChip(s, 'depth', -1)).toBe(true);
    expect(setChip(s, 'heat', 1)).toBe(true);
    expect(setChip(s, 'close', -99)).toBe(false);
  });

  it('heat grows users faster in the short term but raises churn', () => {
    const s = netState();
    s.run.creators = s.run.followers * 0.002;
    s.run.chips = { heat: 0, depth: 2, novel: 1, close: 1 };
    const calm = derive(s).net;
    s.run.chips = { heat: 3, depth: 0, novel: 1, close: 0 };
    const hot = derive(s).net;
    expect(hot.inflow).toBeGreaterThan(calm.inflow);
    expect(hot.churn).toBeGreaterThan(calm.churn);
    expect(hot.bps).toBeLessThan(calm.bps);
  });
});

describe('offline', () => {
  it('is capped and less efficient than being present', () => {
    const a = fresh();
    a.run.heartsEarned = 10;
    a.run.lines.text = 20;
    const b = structuredClone(a);
    const sum = simulateOffline(a, 10 * 3600);
    expect(sum.simulated).toBe(BAL.offlineMaxSec);
    run(b, BAL.offlineMaxSec);
    expect(a.run.heartsEarned).toBeLessThan(b.run.heartsEarned);
    expect(sum.hearts).toBeGreaterThan(0);
  });
});

describe('full-game simulation', () => {
  it('a typical player reaches the ending within the target window, without NaN', () => {
    const res = runBot('typical', 240);
    expect(res.nanSeen).toBe(false);
    expect(res.endTime).not.toBeNull();
    expect(res.endTime!).toBeGreaterThan(60 * 60);
    expect(res.endTime!).toBeLessThan(150 * 60);
    expect(res.firstBuy!).toBeLessThan(20);
    expect(res.prestigeTimes.length).toBe(1);
  });

  it('a slow, mostly idle player still finishes under 180 minutes', () => {
    const res = runBot('idle', 240);
    expect(res.endTime).not.toBeNull();
    expect(res.endTime!).toBeLessThan(180 * 60);
  });

  it('independence speeds up the early game (meta progression works)', () => {
    const res = runBot('typical', 240);
    const firstRun = res.log.find((e) => e.kind === 'milestone' && e.id === 'm10000')!.t;
    const secondStart = res.prestigeTimes[0];
    const second = res.log.filter((e) => e.kind === 'milestone' && e.id === 'm10000').map((e) => e.t)[1];
    expect(second - secondStart).toBeLessThan(firstRun / 2);
  });
});
