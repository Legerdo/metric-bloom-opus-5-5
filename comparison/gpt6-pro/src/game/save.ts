import { newGame, RESOURCE_IDS, CAP, type GameState } from './types';
import { PROJECTS, UPGRADES, GENERATORS } from './content';
export const SAVE_KEY = 'metric-bloom.save.v1';
export const BACKUP_KEY = 'metric-bloom.backup.v1';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const num = (v: unknown, fallback = 0, max = CAP) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : fallback;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const pick = <T extends string>(v: unknown, choices: readonly T[], fallback: T): T => choices.includes(v as T) ? v as T : fallback;
export function decodeSave(raw: string, now = Date.now()): GameState {
  if (raw.length > 200000) throw new Error('저장 데이터가 너무 큽니다.');
  const a = obj(JSON.parse(raw));
  if (a.version !== 1 || !a.resources || !a.generators) throw new Error('지원되지 않는 저장 형식입니다.');
  const s = newGame(now);
  s.started = a.started === true; s.chapter = Math.floor(num(a.chapter, 0, PROJECTS.length));
  for (const r of RESOURCE_IDS) {
    s.resources[r] = num(obj(a.resources)[r]); s.lifetime[r] = Math.max(s.resources[r], num(obj(a.lifetime)[r]));
    s.project[r] = Math.min(num(obj(a.project)[r]), PROJECTS[s.chapter]?.cost[r] || 0);
  }
  for (const g of GENERATORS) s.generators[g.id] = g.stage <= s.chapter ? Math.floor(num(obj(a.generators)[g.id], 0, 1500)) : 0;
  s.upgrades = [...new Set(list(a.upgrades).filter((u): u is string => typeof u === 'string' && UPGRADES.some(x => x.id === u && x.stage <= s.chapter)))];
  const alloc = list(a.allocation).slice(0, 3).map(v => num(v, 0, 100));
  if (alloc.length === 3 && Math.abs(alloc.reduce((a, b) => a + b, 0) - 100) < 0.01 && alloc.every(v => v >= 10 && v <= 80)) s.allocation = alloc as [number, number, number];
  s.focus = s.chapter >= 2 ? pick(a.focus, ['balanced', 'reach', 'community', 'craft'], 'balanced') : 'balanced';
  s.funding = [0, 0.2, 0.4, 0.6, 0.8].includes(Number(a.funding)) ? Number(a.funding) : 0.2;
  s.modules = Array.from({ length: 6 }, (_, i) => s.chapter >= 5 && ['beacon', 'circle', 'library'].includes(String(list(a.modules)[i])) ? list(a.modules)[i] as 'beacon' | 'circle' | 'library' : null);
  s.reborn = s.chapter >= 6 && a.reborn === true; s.seeds = s.reborn ? Math.floor(num(a.seeds, 3, 12)) : 0;
  s.continuity = s.chapter >= 6 && !s.reborn && a.continuity === true;
  const auto = obj(a.automation);
  s.automation = { enabled: s.chapter >= 7 && auto.enabled === true, policy: pick(auto.policy, ['balanced', ...RESOURCE_IDS], 'balanced'), reserve: num(auto.reserve, 0.25, 0.8), clock: num(auto.clock, 0, 8) };
  const fest = obj(a.festival);
  s.festival.selected = Math.floor(num(fest.selected, 0, 2));
  s.festival.completed = Array.from({ length: 3 }, (_, i) => s.chapter >= PROJECTS.length && list(fest.completed)[i] === true);
  for (const r of RESOURCE_IDS) s.festival.progress[r] = num(obj(fest.progress)[r]);
  s.festival.launched = s.festival.completed.every(Boolean) && fest.launched === true;
  s.ended = s.festival.launched && a.ended === true; s.endedAt = s.ended ? num(a.endedAt) : null;
  s.played = num(a.played, 0, 1e9); s.actions = Math.floor(num(a.actions, 0, 1e9)); s.purchases = Math.floor(num(a.purchases, 0, 1e9));
  s.autoLives = Math.floor(num(a.autoLives, 0, 1e9));
  s.actionCooldown = num(a.actionCooldown, 0, 90); s.eventClock = num(a.eventClock, 150, 210); s.eventCount = Math.floor(num(a.eventCount, 0, 1e9));
  const event = obj(a.event);
  if (typeof event.id === 'number') s.event = { id: Math.floor(num(event.id, 0, 1e9)), remaining: num(event.remaining, 0, 75), answered: event.answered === true };
  const buff = obj(a.buff);
  s.buff = { resource: RESOURCE_IDS.includes(buff.resource as never) ? buff.resource as typeof RESOURCE_IDS[number] : null, remaining: num(buff.remaining, 0, 90) };
  for (const f of Object.keys(s.focusTime) as (keyof typeof s.focusTime)[]) s.focusTime[f] = num(obj(a.focusTime)[f], 0, s.played);
  s.milestones = list(a.milestones).slice(-100).map(v => ({ name: typeof obj(v).name === 'string' ? String(obj(v).name).slice(0, 100) : '기록', time: num(obj(v).time, 0, s.played) }));
  const settings = obj(a.settings);
  s.settings = { music: num(settings.music, 0.25, 1), sfx: num(settings.sfx, 0.45, 1), reducedMotion: settings.reducedMotion === true };
  s.savedAt = num(a.savedAt, now, now); return s;
}

export function loadGame(store: Store, now = Date.now()): { state: GameState; warning: string | null } {
  let failed = false;
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const raw = store.getItem(key); if (!raw) continue;
      return { state: decodeSave(raw, now), warning: failed ? '최근 저장이 손상되어 이전 자동 저장을 복구했습니다.' : null };
    } catch { failed = true; }
  }
  return { state: newGame(now), warning: failed ? '저장을 읽지 못했습니다. 기존 데이터는 지우지 않았습니다.' : null };
}
export function saveGame(store: Store, state: GameState, now = Date.now()): boolean {
  try {
    const old = store.getItem(SAVE_KEY);
    if (old) { try { decodeSave(old, now); store.setItem(BACKUP_KEY, old); } catch { /* Keep the last valid backup. */ } }
    const snapshot = { ...state, notices: [], savedAt: now };
    store.setItem(SAVE_KEY, JSON.stringify(snapshot)); state.savedAt = now; return true;
  } catch { return false; }
}
