import { RESOURCE_IDS, safe, wallet, type GameState, type Resource, type Wallet, type GeneratorId, type Module } from './types';
import { GENERATORS, PROJECTS, UPGRADES, FESTIVAL, EDGES, EVENTS, FOCI, CONTINUITY_MULTIPLIER } from './content';
const has = (s: GameState, id: string) => s.upgrades.includes(id);
export function notice(s: GameState, text: string, kind: GameState['notices'][number]['kind']): void {
  s.notices.push({ id: ++s.noticeId, text, kind });
  if (s.notices.length > 40) s.notices.shift();
}
export function mark(s: GameState, name: string): void {
  s.milestones.push({ name, time: s.played });
  if (s.milestones.length > 100) s.milestones.shift();
}
// Shared by production, the purchase feedback and the visible next target.
// Keep giving the late game concrete investment decisions after the first 50 units.
export const PRODUCTION_MILESTONES = [10, 25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 400, 600, 800, 1000, 1250, 1500] as const;
export function levelBonus(n: number): number {
  return PRODUCTION_MILESTONES.reduce((bonus, target) => n >= target ? bonus * (target <= 50 ? 2 : 1.5) : bonus, 1);
}
export function nextProductionMilestone(n: number): number | undefined { return PRODUCTION_MILESTONES.find(target => target > n); }
export function catalogBonus(s: GameState): number {
  return s.chapter >= 4 ? 1 + Math.log10(1 + s.lifetime.insight) * (has(s, 'roots') ? 0.6 : 0.3) : 1;
}
export function networkBonus(s: GameState): Wallet {
  const result = wallet(1, 1, 1);
  for (const [a, b] of EDGES) {
    const x = s.modules[a], y = s.modules[b];
    if (!x || !y || x === y) continue;
    const pair = [x, y];
    const r: Resource = pair.includes('beacon') && pair.includes('circle') ? 'attention' : pair.includes('circle') && pair.includes('library') ? 'connection' : 'insight';
    result[r] += has(s, 'weave') ? 1.2 : 0.4;
  }
  if (s.chapter >= 8) for (const r of RESOURCE_IDS) result[r] *= 2;
  return result;
}
export function production(s: GameState): Wallet {
  const raw = wallet();
  for (const g of GENERATORS) {
    const n = s.generators[g.id];
    let m = n * levelBonus(n);
    if (g.id === 'desk' && has(s, 'pencil')) m *= 2;
    if (g.id === 'studio') m *= (1 + Math.floor(s.generators.desk / 10) * 0.12) * (has(s, 'remix') ? 1 + Math.floor(s.generators.salon / 5) * 0.25 : 1);
    if (g.id === 'relay') m *= (has(s, 'relay') ? 3 : 1) * (s.chapter >= 9 ? 3 : 1);
    for (const r of RESOURCE_IDS) raw[r] += g.output[r] * m;
  }
  raw.connection *= 1 + Math.log10(1 + raw.attention) * 0.28;
  raw.insight *= 1 + Math.log10(1 + raw.connection) * 0.32;
  const global = 0.12 * 1.8 ** s.chapter * (s.continuity ? CONTINUITY_MULTIPLIER : 1 + s.seeds * 0.8) * catalogBonus(s) * (has(s, 'coop') ? 2 : 1) * (has(s, 'seedbank') ? 2 : 1) * (has(s, 'bloom') ? 3 : 1);
  const net = networkBonus(s);
  RESOURCE_IDS.forEach((r, i) => {
    const alloc = s.chapter >= 2 ? 0.25 + 2.1 * s.allocation[i] / 100 : 1;
    raw[r] = safe(raw[r] * global * net[r] * alloc * FOCI[s.focus].factors[i] * (s.buff.resource === r && s.buff.remaining > 0 ? 1.6 : 1));
  });
  if (has(s, 'schedule')) raw.attention = safe(raw.attention * 2);
  if (has(s, 'reply')) raw.connection = safe(raw.connection * 2);
  if (has(s, 'index')) raw.insight = safe(raw.insight * 2);
  if (has(s, 'commons')) { raw.connection = safe(raw.connection * 3); raw.insight = safe(raw.insight * 3); }
  return raw;
}
export function costFor(s: GameState, id: GeneratorId, quantity = 1): Wallet {
  const g = GENERATORS.find(g => g.id === id)!;
  const q = Math.max(1, Math.min(100, Math.floor(quantity)));
  const factor = safe(g.growth ** s.generators[id] * (g.growth ** q - 1) / (g.growth - 1));
  return wallet(...RESOURCE_IDS.map(r => g.cost[r] === 0 ? 0 : safe(g.cost[r] * factor)) as [number, number, number]);
}
export function affordable(s: GameState, cost: Wallet, reserve = 0): boolean {
  return RESOURCE_IDS.every(r => cost[r] <= s.resources[r] * (1 - reserve) + 1e-7);
}
function spend(s: GameState, cost: Wallet): boolean {
  if (!affordable(s, cost)) return false;
  for (const r of RESOURCE_IDS) s.resources[r] = safe(s.resources[r] - cost[r]);
  return true;
}
function gain(s: GameState, delta: Wallet): void {
  for (const r of RESOURCE_IDS) {
    const d = safe(delta[r]); s.resources[r] = safe(s.resources[r] + d); s.lifetime[r] = safe(s.lifetime[r] + d);
  }
}
export function buyGenerator(s: GameState, id: GeneratorId, quantity = 1, quiet = false): boolean {
  const g = GENERATORS.find(g => g.id === id);
  if (!g || s.chapter < g.stage || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 || s.generators[id] + quantity > 1500) return false;
  if (!spend(s, costFor(s, id, quantity))) return false;
  const before = s.generators[id]; s.generators[id] += quantity; s.purchases += quantity;
  if (!s.milestones.some(m => m.name === '첫 자동 생산')) mark(s, '첫 자동 생산');
  if (PRODUCTION_MILESTONES.some(n => before < n && s.generators[id] >= n)) {
    mark(s, `${g.name} ${s.generators[id]}개 · 생산 돌파`);
    notice(s, `${g.name} ${s.generators[id]}개 · 생산 단계 배율 ×${format(levelBonus(s.generators[id]))}!`, 'unlock');
  }
  else if (!quiet) notice(s, `${g.name} ${quantity}개를 마련했어요.`, 'purchase');
  return true;
}
export function buyUpgrade(s: GameState, id: string, quiet = false): boolean {
  const u = UPGRADES.find(u => u.id === id);
  if (!u || s.chapter < u.stage || has(s, id) || !spend(s, u.cost)) return false;
  s.upgrades.push(id); mark(s, u.name);
  notice(s, `${u.name} · ${u.text}`, 'unlock');
  return true;
}

export function post(s: GameState, automatic = false): boolean {
  if (s.actionCooldown > 0 || !s.started || s.ended) return false;
  const p = production(s), duration = s.chapter >= 2 ? 18 : 0;
  gain(s, wallet(Math.max(has(s, 'pencil') ? 8 : 4, p.attention * duration), p.connection * duration, p.insight * duration));
  s.actionCooldown = s.chapter >= 2 ? 90 : 0.65;
  if (automatic) s.autoLives++; else s.actions++;
  if (!automatic && s.actions === 1) mark(s, '첫 발행');
  return true;
}
export function setAllocation(s: GameState, index: number, value: number): void {
  if (s.chapter < 2 || ![0, 1, 2].includes(index) || !Number.isFinite(value)) return;
  value = Math.max(10, Math.min(80, Math.round(value / 5) * 5));
  const other = [0, 1, 2].filter(i => i !== index);
  const sum = s.allocation[other[0]] + s.allocation[other[1]];
  const first = Math.max(10, Math.min(90 - value, Math.round((100 - value) * s.allocation[other[0]] / sum)));
  s.allocation[index] = value; s.allocation[other[0]] = first; s.allocation[other[1]] = 100 - value - first;
}
export function projectRatio(s: GameState): number {
  if (s.chapter >= PROJECTS.length) return 1;
  const goal = PROJECTS[s.chapter].cost, rs = RESOURCE_IDS.filter(r => goal[r] > 0);
  return rs.reduce((a, r) => a + Math.min(1, s.project[r] / goal[r]), 0) / rs.length;
}
export function invest(s: GameState, budget: Wallet = s.resources): boolean {
  if (s.chapter >= PROJECTS.length) return investFestival(s, budget);
  let changed = false;
  const goal = PROJECTS[s.chapter].cost;
  for (const r of RESOURCE_IDS) {
    const amount = Math.max(0, Math.min(s.resources[r], safe(budget[r]), goal[r] - s.project[r]));
    s.resources[r] = safe(s.resources[r] - amount); s.project[r] += amount; changed ||= amount > 0;
  }
  if (RESOURCE_IDS.every(r => s.project[r] >= goal[r] - 1e-6)) {
    const p = PROJECTS[s.chapter]; mark(s, p.name); s.chapter++; s.project = wallet();
    notice(s, `${p.name} 완성! ${p.unlock}`, 'unlock');
    if (s.chapter === 7) { s.automation.enabled = true; notice(s, '자동 구매를 켰어요. 설계 탭에서 우선순위와 유보 비율을 정해 주세요.', 'unlock'); }
  }
  return changed;
}
export function moduleCost(s: GameState): Wallet {
  const n = s.modules.filter(Boolean).length;
  return wallet(1000000 * 2 ** n, 800 * 1.5 ** n, 60 * 1.5 ** n);
}
export function buildModule(s: GameState, slot: number, module: Module): boolean {
  if (s.chapter < 5 || !Number.isInteger(slot) || slot < 0 || slot >= 6 || !['beacon', 'circle', 'library'].includes(module)) return false;
  if (!s.modules[slot] && !spend(s, moduleCost(s))) return false;
  s.modules[slot] = module; return true;
}
export function hasPair(s: GameState, pair: readonly string[]): boolean {
  return EDGES.some(([a, b]) => s.modules[a] !== s.modules[b] && pair.includes(s.modules[a] || '') && pair.includes(s.modules[b] || ''));
}
export function festivalReady(s: GameState): boolean {
  const goal = FESTIVAL[s.festival.selected];
  return s.chapter >= PROJECTS.length && hasPair(s, goal.pair) && s.allocation[RESOURCE_IDS.indexOf(goal.resource)] >= 45;
}
export function investFestival(s: GameState, budget: Wallet = s.resources): boolean {
  if (s.chapter < PROJECTS.length || s.ended) return false;
  const idx = s.festival.selected, goal = FESTIVAL[idx];
  if (!goal || s.festival.completed[idx] || !festivalReady(s)) return false;
  let changed = false;
  for (const r of RESOURCE_IDS) {
    const amount = Math.max(0, Math.min(s.resources[r], safe(budget[r]), goal.cost[r] - s.festival.progress[r]));
    s.resources[r] = safe(s.resources[r] - amount); s.festival.progress[r] += amount; changed ||= amount > 0;
  }
  if (RESOURCE_IDS.every(r => s.festival.progress[r] >= goal.cost[r] - 1e-6)) {
    s.festival.completed[idx] = true; s.festival.progress = wallet(); mark(s, goal.name);
    notice(s, `${goal.name} · 송출 준비 완료!`, 'unlock');
    const next = s.festival.completed.findIndex(v => !v);
    if (next >= 0) s.festival.selected = next;
  }
  return changed;
}
export function launchFestival(s: GameState): boolean {
  if (s.ended || s.chapter < PROJECTS.length || !s.festival.completed.every(Boolean)) return false;
  s.festival.launched = true; s.ended = true; s.endedAt = s.played;
  mark(s, '개화제 개막'); notice(s, '작은 신호들이 하나의 밤을 밝혔습니다.', 'ending'); return true;
}
export function seedReward(s: GameState): number { return Math.max(3, Math.min(12, Math.floor(Math.log10(1 + s.lifetime.attention)) - 4)); }
export function prestige(s: GameState): boolean {
  if (s.chapter < 6 || s.reborn || s.continuity || s.ended) return false;
  s.seeds = seedReward(s); s.reborn = true;
  s.resources = wallet(45000, 120, 25);
  s.generators = { desk: 25, studio: 10, salon: 5, archive: 3, relay: 1 };
  // Plans, accumulated records, upgrades, and network knowledge remain intact.
  mark(s, '새 계절'); notice(s, `새 계절 · 씨앗 ${s.seeds}개, 전체 생산 ×${(1 + s.seeds * 0.8).toFixed(1)}. 설계와 기록은 모두 남았어요.`, 'meta'); return true;
}
export function chooseContinuity(s: GameState): boolean {
  if (s.chapter < 6 || s.reborn || s.continuity || s.ended) return false;
  s.continuity = true;
  mark(s, '연속 제작 협약'); notice(s, `연속 제작 협약 · 현재 설비와 자원을 모두 유지하며 전체 생산 ×${CONTINUITY_MULTIPLIER}. 이 마을로 끝까지 나아갑니다.`, 'meta'); return true;
}
export function answerEvent(s: GameState, choice: number): boolean {
  if (!s.event || s.event.answered || ![0, 1].includes(choice)) return false;
  const event = EVENTS[s.event.id % EVENTS.length];
  let r = event.resources[choice];
  if (r === 'insight' && s.chapter < 3) r = 'connection';
  if (r === 'connection' && s.chapter < 2) r = 'attention';
  s.buff = { resource: r, remaining: 90 }; s.event.answered = true;
  notice(s, '90초 동안 선택한 자원 생산이 ×1.6 높아집니다.', 'event'); return true;
}

export function recommend(s: GameState): { kind: 'upgrade' | 'generator'; id: string; cost: Wallet } | null {
  const reserve = s.automation.reserve;
  for (const u of UPGRADES) if (s.chapter >= u.stage && !has(s, u.id) && affordable(s, u.cost, reserve)) return { kind: 'upgrade', id: u.id, cost: u.cost };
  const rates = production(s), goal = PROJECTS[s.chapter]?.cost || FESTIVAL[s.festival.selected].cost;
  const progress = s.chapter < PROJECTS.length ? s.project : s.festival.progress, demand = wallet();
  for (const r of RESOURCE_IDS) demand[r] = goal[r] > 0 ? Math.max(0, goal[r] - progress[r]) / Math.max(0.01, rates[r]) : 0;
  let priority = s.automation.policy;
  if (priority === 'balanced') priority = RESOURCE_IDS.reduce((a, b) => demand[a] > demand[b] ? a : b);
  const candidates = GENERATORS.filter(g => s.chapter >= g.stage && affordable(s, costFor(s, g.id), reserve) && s.generators[g.id] < 1500);
  candidates.sort((a, b) => {
    const score = (g: typeof a) => {
      const p = g.output[priority as Resource], n = s.generators[g.id];
      const scale = (n + 1) * levelBonus(n + 1) - n * levelBonus(n);
      return ((p > 0 ? p * 100 : g.output.attention * 0.00005) * scale) / Math.max(1, costFor(s, g.id).attention);
    };
    return score(b) - score(a);
  });
  const g = candidates[0]; return g ? { kind: 'generator', id: g.id, cost: costFor(s, g.id) } : null;
}
export function autoBuy(s: GameState): void {
  for (let i = 0; i < 3; i++) {
    const r = recommend(s); if (!r) return;
    if (r.kind === 'upgrade') buyUpgrade(s, r.id, true); else buyGenerator(s, r.id as GeneratorId, 1, true);
  }
}
/** Shared bounded simulation step. Runtime uses 0.25s, deterministic tests and offline catch-up at most 1s. */
export function tick(s: GameState, dt: number, offline = false): void {
  if (!s.started || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1);
  s.played += dt; s.focusTime[s.focus] += dt;
  s.actionCooldown = Math.max(0, s.actionCooldown - dt); s.buff.remaining = Math.max(0, s.buff.remaining - dt);
  if (has(s, 'livebot') && !s.ended && s.actionCooldown === 0) post(s, true);
  const rates = production(s), earned = wallet(rates.attention * dt, rates.connection * dt, rates.insight * dt);
  gain(s, earned);
  if (!s.ended) invest(s, wallet(...RESOURCE_IDS.map(r => earned[r] * s.funding) as [number, number, number]));
  if (s.chapter >= 7 && s.automation.enabled) {
    s.automation.clock += dt;
    if (s.automation.clock >= 8) { s.automation.clock %= 8; autoBuy(s); }
  }
  if (!offline && !s.ended) {
    s.eventClock -= dt;
    if (s.event) { s.event.remaining -= dt; if (s.event.remaining <= 0) s.event = null; }
    if (s.eventClock <= 0 && s.chapter >= 1) {
      s.event = { id: s.eventCount++, remaining: 75, answered: false }; s.eventClock = 210;
    }
    if (has(s, 'curator') && s.event && !s.event.answered && s.event.remaining <= 60) {
      const goal = PROJECTS[s.chapter]?.cost || FESTIVAL[s.festival.selected].cost;
      const progress = s.chapter < PROJECTS.length ? s.project : s.festival.progress;
      const event = EVENTS[s.event.id % EVENTS.length];
      const value = (r: Resource) => Math.max(0, goal[r] - progress[r]) / Math.max(.01, rates[r]);
      answerEvent(s, value(event.resources[1]) > value(event.resources[0]) ? 1 : 0);
    }
  }
}
export function offlineProgress(s: GameState, seconds: number): { seconds: number; simulated: number; gain: Wallet; chapters: number } {
  const elapsed = Math.max(0, Math.min(1800, Number.isFinite(seconds) ? seconds : 0));
  const simulated = elapsed * 0.5, before = { ...s.lifetime }, chapter = s.chapter;
  let remaining = simulated;
  while (remaining > 1e-8) { const d = Math.min(1, remaining); tick(s, d, true); remaining -= d; }
  return { seconds: elapsed, simulated, gain: wallet(s.lifetime.attention - before.attention, s.lifetime.connection - before.connection, s.lifetime.insight - before.insight), chapters: s.chapter - chapter };
}
export function format(n: number): string {
  n = safe(n);
  if (n < 1000) return n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.floor(n).toLocaleString('en-US');
  const suffix = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'], group = Math.floor(Math.log10(n) / 3);
  return group < suffix.length ? (n / 1000 ** group).toFixed(2).replace(/\.00$/, '') + suffix[group] : n.toExponential(2);
}
export function clock(seconds: number): string {
  const mins = Math.floor(seconds / 60); return `${mins}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
