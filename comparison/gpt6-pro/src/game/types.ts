export const RESOURCE_IDS = ['attention', 'connection', 'insight'] as const;
export type Resource = (typeof RESOURCE_IDS)[number];
export type Wallet = Record<Resource, number>;
export type Focus = 'balanced' | 'reach' | 'community' | 'craft';
export type Module = 'beacon' | 'circle' | 'library';
export type GeneratorId = 'desk' | 'studio' | 'salon' | 'archive' | 'relay';
export type Policy = 'balanced' | Resource;
export type GameEvent = { id: number; remaining: number; answered: boolean };
export type Notice = { id: number; text: string; kind: 'purchase' | 'unlock' | 'event' | 'meta' | 'ending' };
export type Settings = { music: number; sfx: number; reducedMotion: boolean };
export interface GameState {
  version: 1;
  started: boolean;
  resources: Wallet;
  lifetime: Wallet;
  generators: Record<GeneratorId, number>;
  upgrades: string[];
  chapter: number;
  project: Wallet;
  allocation: [number, number, number];
  focus: Focus;
  funding: number;
  modules: (Module | null)[];
  seeds: number;
  reborn: boolean;
  continuity: boolean;
  automation: { enabled: boolean; policy: Policy; reserve: number; clock: number };
  festival: { selected: number; progress: Wallet; completed: boolean[]; launched: boolean };
  played: number;
  actionCooldown: number;
  actions: number;
  autoLives: number;
  purchases: number;
  eventClock: number;
  event: GameEvent | null;
  eventCount: number;
  buff: { resource: Resource | null; remaining: number };
  focusTime: Record<Focus, number>;
  milestones: { name: string; time: number }[];
  notices: Notice[];
  noticeId: number;
  ended: boolean;
  endedAt: number | null;
  savedAt: number;
  settings: Settings;
}
export const wallet = (attention = 0, connection = 0, insight = 0): Wallet => ({ attention, connection, insight });
export const CAP = 1e150;
export function safe(value: number): number { return Number.isFinite(value) ? Math.max(0, Math.min(CAP, value)) : value === Infinity ? CAP : 0; }
export function newGame(now = Date.now()): GameState {
  return {
    version: 1, started: false, resources: wallet(), lifetime: wallet(),
    generators: { desk: 0, studio: 0, salon: 0, archive: 0, relay: 0 },
    upgrades: [], chapter: 0, project: wallet(), allocation: [50, 30, 20], focus: 'balanced', funding: 0.2,
    modules: Array.from({ length: 6 }, () => null), seeds: 0, reborn: false, continuity: false,
    automation: { enabled: false, policy: 'balanced', reserve: 0.25, clock: 0 },
    festival: { selected: 0, progress: wallet(), completed: [false, false, false], launched: false },
    played: 0, actionCooldown: 0, actions: 0, autoLives: 0, purchases: 0, eventClock: 150, event: null, eventCount: 0,
    buff: { resource: null, remaining: 0 }, focusTime: { balanced: 0, reach: 0, community: 0, craft: 0 },
    milestones: [], notices: [], noticeId: 0, ended: false, endedAt: null, savedAt: now,
    settings: { music: 0.25, sfx: 0.45, reducedMotion: false },
  };
}
