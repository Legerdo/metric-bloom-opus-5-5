import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { newGame, RESOURCE_IDS, type Focus, type Module, type GameState } from '../src/game/types';
import { PROJECTS, FESTIVAL } from '../src/game/content';
import { post, tick, autoBuy, invest, production, prestige, chooseContinuity, buildModule, answerEvent, launchFestival, setAllocation, affordable } from '../src/game/economy';

export type BotOptions = { name: string; interval: number; active: boolean; season: boolean; adapt: boolean };
export function simulate(options: BotOptions, capture = false) {
  const s = newGame(1); s.started = true;
  const snapshots: Record<string, GameState> = {};
  let prev = -1, lastPurchase = 0, maxNoPurchase = 0, beforeMeta = 0, metaRecovered: number | null = null, metaTime = 0;
  for (let t = 0; t < 180 * 60 && !s.ended; t++) {
    const purchasesBefore = s.purchases;
    if (s.generators.desk < 5 || (options.active && (s.chapter >= 2 || t < 60))) post(s);
    if (s.chapter !== prev) { if (capture) snapshots[`chapter-${s.chapter}`] = structuredClone(s); prev = s.chapter; }
    if (t % (s.chapter < 1 ? 3 : options.interval) === 0) {
      if (options.active && s.event) answerEvent(s, s.chapter >= 3 ? 1 : 0);
      if (s.chapter >= 2 && (options.adapt || s.chapter >= PROJECTS.length)) {
        const p = production(s), goal = PROJECTS[s.chapter]?.cost || FESTIVAL[s.festival.selected].cost;
        const progress = s.chapter < PROJECTS.length ? s.project : s.festival.progress;
        const need = RESOURCE_IDS.map(r => (goal[r] - progress[r]) / Math.max(0.01, p[r]));
        const slow = s.chapter >= PROJECTS.length ? RESOURCE_IDS.indexOf(FESTIVAL[s.festival.selected].resource) : need.indexOf(Math.max(...need));
        setAllocation(s, slow, 60);
        s.focus = (['reach', 'community', 'craft'] as Focus[])[slow];
      }
      for (let j = 0; j < 4; j++) autoBuy(s);
      if (s.chapter >= 5) {
        const layout: Module[] = ['beacon', 'circle', 'library', 'library', 'beacon', 'circle'];
        for (let j = 0; j < 6; j++) if (!s.modules[j]) buildModule(s, j, layout[j]);
      }
      if (options.season && s.chapter >= 6 && !s.reborn) {
        beforeMeta = production(s).attention; metaTime = s.played; prestige(s);
      }
      if (!options.season && s.chapter >= 6 && !s.continuity) chooseContinuity(s);
      const goal = PROJECTS[s.chapter]?.cost || FESTIVAL[s.festival.selected].cost;
      const progress = s.chapter < PROJECTS.length ? s.project : s.festival.progress;
      const remainder = { attention: Math.max(0, goal.attention - progress.attention), connection: Math.max(0, goal.connection - progress.connection), insight: Math.max(0, goal.insight - progress.insight) };
      if (affordable(s, remainder, 0.2)) invest(s); // Do not exhaust working capital on every decision.
      if (s.festival.completed.every(Boolean)) {
        if (capture) snapshots['before-ending'] = structuredClone(s);
        launchFestival(s);
      }
    }
    if (s.reborn && metaRecovered === null && production(s).attention >= beforeMeta) metaRecovered = s.played - metaTime;
    tick(s, 1);
    if (s.purchases !== purchasesBefore) lastPurchase = t;
    maxNoPurchase = Math.max(maxNoPurchase, t - lastPurchase);
  }
  const times = [0, ...s.milestones.map(m => m.time), s.played].sort((a, b) => a - b);
  const maxNoveltyGap = Math.max(...times.slice(1).map((t, i) => t - times[i]));
  return { s, snapshots, summary: { ...options, ended: s.ended, minutes: +(s.played / 60).toFixed(2), chapter: s.chapter, actions: s.actions, automaticLives: s.autoLives, purchases: s.purchases, firstAutomationSeconds: s.milestones.find(m => m.name === '첫 자동 생산')?.time, longestPurchaseGapSeconds: maxNoPurchase, longestMilestoneGapMinutes: +(maxNoveltyGap / 60).toFixed(2), metaRecoverySeconds: metaRecovered, rates: production(s), stages: s.milestones.filter(m => PROJECTS.some(p => p.name === m.name) || m.name === '개화제 개막').map(m => ({ name: m.name, minutes: +(m.time / 60).toFixed(2) })) } };
}
const configs: BotOptions[] = [
  { name: 'active-adaptive', interval: 12, active: true, season: true, adapt: true },
  { name: 'typical-adaptive', interval: 30, active: false, season: true, adapt: true },
  { name: 'relaxed-balanced', interval: 40, active: false, season: true, adapt: false },
  { name: 'no-reset-adaptive', interval: 20, active: true, season: false, adapt: true },
];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
mkdirSync('evidence', { recursive: true });
const results = configs.map((config, i) => {
  const run = simulate(config, i === 0);
  if (i === 0) for (const [name, state] of Object.entries(run.snapshots)) writeFileSync(`evidence/${name}.json`, JSON.stringify(state));
  return run.summary;
});
writeFileSync('evidence/balance.json', JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.name}: ${r.minutes} min; ending=${r.ended}; longest milestone gap=${r.longestMilestoneGapMinutes} min; meta recovery=${r.metaRecoverySeconds ?? '-'} sec`);
console.log('Full progression evidence: evidence/balance.json');
const failures: string[] = [];
for (const r of results) {
  if (!r.ended || r.minutes > 180) failures.push(`${r.name}: ending must be reachable within 180 minutes`);
  if (r.firstAutomationSeconds === undefined || r.firstAutomationSeconds > 30) failures.push(`${r.name}: first automatic production is too late`);
  if (r.longestPurchaseGapSeconds > 300) failures.push(`${r.name}: more than five minutes without any purchase`);
  if (r.season && (r.metaRecoverySeconds === null || r.metaRecoverySeconds > 300)) failures.push(`${r.name}: season reset does not recover production within five minutes`);
  if (r.name === 'typical-adaptive' && (r.minutes < 90 || r.minutes > 150 || r.longestMilestoneGapMinutes > 15)) failures.push(`${r.name}: normal-play duration or novelty cadence is outside the design target`);
  if (!RESOURCE_IDS.every(id => Number.isFinite(r.rates[id]) && r.rates[id] > 0)) failures.push(`${r.name}: invalid final production`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
}
