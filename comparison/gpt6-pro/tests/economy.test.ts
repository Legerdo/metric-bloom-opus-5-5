import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, wallet, RESOURCE_IDS, CAP, type GameState } from '../src/game/types';
import { PROJECTS, FESTIVAL, GENERATORS, CONTINUITY_MULTIPLIER } from '../src/game/content';
import { post, tick, production, costFor, buyGenerator, buyUpgrade, setAllocation, networkBonus, catalogBonus, invest, prestige, chooseContinuity, seedReward, buildModule, moduleCost, festivalReady, investFestival, launchFestival, offlineProgress, answerEvent, format, autoBuy } from '../src/game/economy';
import { decodeSave, saveGame, loadGame, SAVE_KEY, BACKUP_KEY } from '../src/game/save';
import { simulate } from '../scripts/balance';
import { levelBonus, nextProductionMilestone } from '../src/game/economy';

function started(): GameState { const s = newGame(1); s.started = true; return s; }
function rich(chapter = 10): GameState {
  const s = started(); s.chapter = chapter; s.resources = wallet(1e20, 1e20, 1e20); s.lifetime = { ...s.resources };
  s.generators = { desk: 25, studio: 25, salon: 25, archive: 25, relay: chapter >= 5 ? 10 : 0 }; return s;
}
function step(s: GameState, seconds: number, dt = .25): void { for (let i = 0; i < Math.round(seconds / dt); i++) tick(s, dt); }
function store() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
}

test('four initial posts buy the first automatic generator without a debug grant', () => {
  const s = started();
  for (let i = 0; i < 4; i++) { assert.equal(post(s), true); step(s, .75); }
  assert.equal(s.resources.attention, 16); assert.equal(s.actions, 4);
  assert.equal(buyGenerator(s, 'desk'), true); const before = s.lifetime.attention;
  step(s, 10); assert.ok(s.lifetime.attention > before); assert.equal(s.generators.desk, 1);
  assert.ok(s.milestones.some(m => m.name === '첫 자동 생산'));
});
test('first action requires a started game and has an enforced cooldown', () => {
  const s = newGame(); assert.equal(post(s), false); s.started = true;
  assert.equal(post(s), true); assert.equal(post(s), false); assert.equal(s.actions, 1);
  tick(s, .5); assert.equal(post(s), false); tick(s, .25); assert.equal(post(s), true);
});
test('geometric bulk cost matches the sum of single purchases', () => {
  const s = rich(); s.generators.desk = 8;
  const bulk = costFor(s, 'desk', 10).attention;
  let total = 0; for (let i = 0; i < 10; i++) { total += costFor(s, 'desk').attention; s.generators.desk++; }
  assert.ok(Math.abs(bulk - total) / total < 1e-12);
});
test('late production milestones are real power spikes and expose the next reachable target', () => {
  const s = rich(0); s.generators = { desk: 74, studio: 0, salon: 0, archive: 0, relay: 0 };
  const before = production(s).attention;
  assert.equal(nextProductionMilestone(74), 75);
  assert.equal(buyGenerator(s, 'desk'), true);
  assert.ok(production(s).attention > before * 1.5);
  assert.equal(nextProductionMilestone(75), 100);
  assert.equal(levelBonus(50), 8);
  assert.equal(levelBonus(75), 12);
  assert.ok(s.milestones.some(m => m.name.includes('75개 · 생산 돌파')));
  assert.equal(nextProductionMilestone(1500), undefined);
});
test('locked, unaffordable and malformed purchases do not mutate resources', () => {
  const s = started(), before = JSON.stringify(s.resources);
  assert.equal(buyGenerator(s, 'salon'), false); assert.equal(buyGenerator(s, 'desk'), false);
  assert.equal(buyGenerator(s, 'desk', -1), false); assert.equal(buyGenerator(s, 'desk', .5), false);
  assert.equal(buyGenerator(s, 'missing' as never), false); assert.equal(buyUpgrade(s, 'missing'), false);
  assert.equal(JSON.stringify(s.resources), before);
});
test('generator milestone produces a real power spike and upgrade cannot be bought twice', () => {
  const s = rich(1); s.generators = { desk: 9, studio: 0, salon: 0, archive: 0, relay: 0 };
  const before = production(s).attention; assert.equal(buyGenerator(s, 'desk'), true);
  assert.ok(production(s).attention > before * 2);
  assert.equal(buyUpgrade(s, 'pencil'), true); assert.equal(buyUpgrade(s, 'pencil'), false);
});
test('focus is a tradeoff, not a universal best multiplier', () => {
  const s = rich(5); const balanced = production(s); s.focus = 'reach'; const reach = production(s);
  assert.ok(reach.attention > balanced.attention); assert.ok(reach.connection < balanced.connection); assert.ok(reach.insight < balanced.insight);
  s.focus = 'community'; const community = production(s); assert.ok(community.connection > balanced.connection); assert.ok(community.attention < balanced.attention);
});
test('allocation always sums to 100 and rejects non-finite input', () => {
  const s = rich(4);
  for (let i = 0; i < 500; i++) { setAllocation(s, i % 3, (i * 13) % 130 - 20); assert.equal(s.allocation.reduce((a, b) => a + b), 100); assert.ok(s.allocation.every(n => n >= 10 && n <= 80)); }
  const before = [...s.allocation]; setAllocation(s, 0, NaN); setAllocation(s, 10, 50); assert.deepEqual(s.allocation, before);
});
test('spent archives still contribute to the cumulative catalog multiplier', () => {
  const s = rich(4); const before = catalogBonus(s), lifetime = s.lifetime.insight;
  assert.equal(buyGenerator(s, 'archive'), true); assert.ok(s.resources.insight <= lifetime);
  assert.equal(catalogBonus(s), before); assert.equal(s.lifetime.insight, lifetime);
});
test('network placement has costs, reconfiguration is free, and adjacency matters', () => {
  const s = rich(5), cost = moduleCost(s);
  assert.equal(buildModule(s, 0, 'beacon'), true); assert.equal(s.resources.attention, 1e20 - cost.attention);
  assert.equal(buildModule(s, 1, 'circle'), true); assert.ok(networkBonus(s).attention > 1);
  const before = { ...s.resources }; assert.equal(buildModule(s, 1, 'beacon'), true); assert.deepEqual(s.resources, before); assert.equal(networkBonus(s).attention, 1);
  assert.equal(buildModule(s, 9, 'library'), false);
});
test('project contributions are bounded, unlock the next system and cannot lose excess', () => {
  const s = started(); s.resources.attention = 150; const cost = PROJECTS[0].cost.attention;
  assert.equal(invest(s), true); assert.equal(s.chapter, 1); assert.equal(s.resources.attention, 150 - cost); assert.deepEqual(s.project, wallet());
});
test('one-time renewal preserves learned systems and continuity is mutually exclusive', () => {
  const s = rich(6); s.upgrades = ['pencil', 'roots']; s.modules[0] = 'beacon'; s.project.attention = 10;
  const lifetime = { ...s.lifetime }, reward = seedReward(s);
  assert.equal(prestige(s), true); assert.equal(s.seeds, reward); assert.equal(s.chapter, 6); assert.equal(s.project.attention, 10);
  assert.deepEqual(s.lifetime, lifetime); assert.deepEqual(s.upgrades, ['pencil', 'roots']); assert.equal(s.modules[0], 'beacon');
  assert.equal(prestige(s), false); assert.equal(chooseContinuity(s), false);
  const stay = rich(6), rates = production(stay), resources = { ...stay.resources };
  assert.equal(chooseContinuity(stay), true); assert.deepEqual(stay.resources, resources);
  assert.ok(Math.abs(production(stay).attention / rates.attention - CONTINUITY_MULTIPLIER) < 1e-10);
  assert.equal(prestige(stay), false); assert.equal(chooseContinuity(stay), false);
});
test('festival requires each distinct network pair and active production allocation', () => {
  const s = rich(); assert.equal(launchFestival(s), false); assert.equal(investFestival(s), false);
  s.modules = ['beacon', 'circle', 'library', 'library', 'beacon', 'circle'];
  for (let i = 0; i < 3; i++) {
    assert.equal(s.festival.selected, i); const index = RESOURCE_IDS.indexOf(FESTIVAL[i].resource);
    setAllocation(s, index, 10); assert.equal(festivalReady(s), false); assert.equal(investFestival(s), false);
    setAllocation(s, index, 60); assert.equal(festivalReady(s), true); assert.equal(investFestival(s), true); assert.equal(s.festival.completed[i], true);
  }
  assert.equal(s.ended, false); assert.equal(launchFestival(s), true); assert.equal(s.ended, true); assert.equal(launchFestival(s), false);
});
test('automatic live research removes repeated input without inflating manual action statistics', () => {
  const s = rich(7); s.upgrades = ['livebot']; s.resources = wallet(); s.funding = 0;
  const manual = s.actions; step(s, 181);
  assert.equal(s.actions, manual); assert.equal(s.autoLives, 3); assert.ok(s.resources.attention > 0);
});
test('curator waits for player response, then helps a bottleneck; unattended events never cause a loss', () => {
  const s = rich(8); s.resources = wallet(); s.upgrades = ['curator']; s.funding = 0;
  s.event = { id: 0, remaining: 75, answered: false }; s.eventClock = 210;
  step(s, 14); assert.equal(s.event.answered, false); step(s, 2); assert.equal(s.event.answered, true); assert.ok(s.buff.remaining > 0);
  const first = started(); first.chapter = 1; first.event = { id: 2, remaining: 70, answered: false };
  assert.equal(answerEvent(first, 1), true); assert.equal(first.buff.resource, 'attention'); assert.equal(answerEvent(first, 0), false);
});

test('offline production is capped at 30 minutes, at half efficiency, with no destructive events', () => {
  const a = started(); a.generators.desk = 1; a.funding = 0;
  const before = production(a).attention; const result = offlineProgress(a, 86400);
  assert.equal(result.seconds, 1800); assert.equal(result.simulated, 900);
  assert.ok(Math.abs(a.resources.attention - before * 900) < 1e-6); assert.equal(a.event, null);
  const snapshot = JSON.stringify(a); offlineProgress(a, -50); assert.equal(JSON.stringify(a), snapshot);
});
test('simulation ignores NaN and nonpositive time and clamps giant deltas', () => {
  const s = started(); s.generators.desk = 1; const before = s.played;
  tick(s, NaN); tick(s, Infinity); tick(s, -1); assert.equal(s.played, before);
  tick(s, 9999); assert.equal(s.played, 1);
});
test('same actions and fixed ticks are deterministic and independent of visual frames', () => {
  const a = started(), b = started(); a.generators.desk = b.generators.desk = 3;
  step(a, 100, .25); step(b, 100, 1);
  assert.ok(Math.abs(a.lifetime.attention - b.lifetime.attention) < 1e-8);
  const c = rich(4), d = structuredClone(c); c.resources = wallet(); d.resources = wallet();
  step(c, 30); step(d, 30); assert.deepEqual(c, d);
});
test('automatic buyer observes the per-purchase reserve during at most three purchases', () => {
  const s = started(); s.resources.attention = 100; s.automation.reserve = .75;
  autoBuy(s); assert.ok(s.resources.attention >= 100 * .75 ** 3); assert.equal(s.generators.studio, 0); assert.equal(s.generators.salon, 0);
});
test('numeric formatting and very large saved values never emit NaN or Infinity', () => {
  const s = rich();
  for (const g of GENERATORS) s.generators[g.id] = 1500;
  s.lifetime = wallet(CAP, CAP, CAP); s.resources = wallet(CAP, CAP, CAP);
  step(s, 2);
  for (const n of [...Object.values(production(s)), ...Object.values(s.resources), ...Object.values(costFor(s, 'relay', 100)), NaN, Infinity, -12, 1e150]) {
    assert.doesNotMatch(format(n), /NaN|Infinity|-/);
  }
  assert.ok(Object.values(s.resources).every(Number.isFinite));
});
test('save round trip retains unlocked economy, settings and learned meta state', () => {
  const s = rich(7); chooseContinuity(s); s.focus = 'craft'; s.settings = { music: 0, sfx: .3, reducedMotion: true }; s.autoLives = 9;
  const recovered = decodeSave(JSON.stringify(s), 10);
  assert.deepEqual(recovered.resources, s.resources); assert.deepEqual(recovered.generators, s.generators);
  assert.equal(recovered.continuity, true); assert.equal(recovered.focus, 'craft'); assert.equal(recovered.autoLives, 9); assert.deepEqual(recovered.settings, s.settings);
  assert.deepEqual(production(recovered), production(s));
});
test('corrupt primary save recovers a valid backup and malformed schemas fail gracefully', () => {
  const memory = store(), s = started(); s.actions = 8;
  assert.equal(saveGame(memory, s, 100), true); s.actions = 9; assert.equal(saveGame(memory, s, 200), true);
  memory.setItem(SAVE_KEY, '{broken'); const recovered = loadGame(memory, 300);
  assert.equal(recovered.state.actions, 8); assert.ok(recovered.warning);
  assert.equal(memory.getItem(SAVE_KEY), '{broken');
  assert.throws(() => decodeSave('{"version":99,"resources":{},"generators":{}}'));
  assert.throws(() => decodeSave('x'.repeat(200001)));
});
test('untrusted saves cannot unlock future machines, preserve impossible ending or inject non-finite state', () => {
  const raw = { ...newGame(), chapter: 0, resources: { attention: -99, connection: 'Infinity', insight: null }, generators: { desk: 3, salon: 500 }, focus: 'constructor', allocation: [500, 0, -400], modules: ['__proto__'], continuity: true, reborn: true, seeds: 12, ended: true, festival: { completed: [true, true, true], launched: true } };
  const s = decodeSave(JSON.stringify(raw));
  assert.deepEqual(s.resources, wallet()); assert.equal(s.generators.salon, 0); assert.equal(s.focus, 'balanced');
  assert.deepEqual(s.allocation, [50, 30, 20]); assert.ok(s.modules.every(m => m === null)); assert.equal(s.ended, false); assert.equal(s.continuity, false); assert.equal(s.reborn, false);
});
test('storage quota failure does not crash or falsely claim a successful save', () => {
  const broken = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {} };
  assert.equal(saveGame(broken, started()), false);
  const unreadable = { ...broken, getItem: () => { throw new Error('SecurityError'); } };
  const result = loadGame(unreadable); assert.equal(result.state.started, false); assert.ok(result.warning);
});
test('a real new-game strategy reaches the ending without direct resource grants or debug shortcuts', () => {
  const result = simulate({ name: 'normal-test', interval: 30, active: false, season: true, adapt: true });
  assert.equal(result.s.ended, true); assert.ok(result.s.festival.completed.every(Boolean));
  assert.ok(result.s.chapter === 10); assert.ok(result.s.milestones.length >= 20);
  assert.ok(result.summary.minutes >= 90 && result.summary.minutes <= 150, `Normal play took ${result.summary.minutes} minutes.`);
});
