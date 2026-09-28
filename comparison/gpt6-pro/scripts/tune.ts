import { PROJECTS, FESTIVAL } from '../src/game/content';
import { RESOURCE_IDS } from '../src/game/types';
import { simulate, type BotOptions } from './balance';
const base = PROJECTS.map(p => ({ ...p.cost }));
const last = FESTIVAL.map(p => ({ ...p.cost }));
const options: BotOptions[] = [
  { name: 'active', interval: 12, active: true, season: true, adapt: true },
  { name: 'typical', interval: 30, active: false, season: true, adapt: true },
  { name: 'relaxed', interval: 40, active: false, season: true, adapt: false },
  { name: 'no-reset', interval: 20, active: true, season: false, adapt: true },
];
for (const scale of [1, 1.25, 1.5, 2]) {
  const profile = { plan: [scale, scale, scale, scale], final: scale };
  for (let i = 6; i < PROJECTS.length; i++) for (const r of RESOURCE_IDS) PROJECTS[i].cost[r] = base[i][r] * profile.plan[i - 6];
  for (let i = 0; i < FESTIVAL.length; i++) for (const r of RESOURCE_IDS) FESTIVAL[i].cost[r] = last[i][r] * profile.final;
  const result = options.map(o => { const a = simulate(o).summary; return { name: a.name, ended: a.ended, minutes: a.minutes, gap: a.longestMilestoneGapMinutes, stages: a.stages.map(m => m.minutes) }; });
  console.log(`Late project / festival cost scale: ${scale}`);
  for (const row of result) console.log(JSON.stringify(row));
}
