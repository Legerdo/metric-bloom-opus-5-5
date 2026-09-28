import { LINE_IDS, type LineId, type PetalId, type SignalId } from './defs';
import { createNarrative, type NarrativeState } from './narrative';

export const SAVE_VERSION = 1;

export type CommentKind = 'normal' | 'trend' | 'viral';

export interface CommentState {
  id: number;
  slot: number;
  ttl: number;
  maxTtl: number;
  kind: CommentKind;
  textIdx: number;
}

export interface TrendState {
  /** 'idle' → waiting for next trend; 'active' → a trend can be joined */
  phase: 'idle' | 'active';
  timer: number;
  tag: string;
  mult: number;
  joined: boolean;
  nextTag: string;
  nextMult: number;
}

export type FeedAiMode = 'off' | 'balance' | 'focus';

export interface RunState {
  time: number;
  hearts: number;
  heartsEarned: number;
  followers: number;
  followersPeak: number;
  bond: number;
  bondEarned: number;
  lines: Record<LineId, number>;
  ups: Record<string, boolean>;
  toggles: Record<string, boolean>;
  crew: Record<string, number>;
  autoBuy: Record<LineId, boolean>;
  /** fraction of current hearts the manager may spend per purchase (1, 0.5, 0.1) */
  budget: number;
  /** manager only buys routines up to audience capacity */
  capOnly: boolean;
  /** trend rule: 0 = off, 1 = always, n>=2 → join only if multiplier >= n */
  trendRule: number;
  collabs: Record<string, boolean>;
  milestones: Record<string, boolean>;
  comments: CommentState[];
  commentAcc: number;
  nextCommentId: number;
  trend: TrendState;
  crewTimers: Record<string, number>;
  posts: number;
  manualPosts: number;
  postAcc: Record<LineId, number>;
  // network phase
  net: boolean;
  creators: number;
  communities: number;
  netPosts: number;
  netPostAcc: number;
  chips: Record<SignalId, number>;
  petals: Record<PetalId, boolean>;
  festival: boolean;
  festivalGauge: number;
  feedAi: FeedAiMode;
  feedFocus: SignalId;
  feedAiTimer: number;
  spotlights: number;
}

export interface MetaState {
  narrative: NarrativeState;
  seeds: number;
  seedsTotal: number;
  perks: Record<string, boolean>;
  runs: number;
  totalTime: number;
  totalPosts: number;
  totalManualPosts: number;
  totalHearts: number;
  totalReplies: number;
  manualReplies: number;
  trendsJoined: number;
  trendsSeen: number;
  virals: number;
  peakFollowers: number;
  chipSeconds: Record<SignalId, number>;
  clickbaitSeconds: number;
  sponsorSeconds: number;
  flags: Record<string, boolean>;
  ended: boolean;
  endTime: number;
  endingSeen: boolean;
  runHistory: { time: number; followers: number; bond: number; seeds: number }[];
}

export interface GameState {
  v: number;
  rng: number;
  run: RunState;
  meta: MetaState;
  /** wall-clock ms of last save/tick; used for offline progress */
  lastTs: number;
  createdAt: number;
}

export function zeroLines(): Record<LineId, number> {
  const o = {} as Record<LineId, number>;
  for (const id of LINE_IDS) o[id] = 0;
  return o;
}

export function createTrend(): TrendState {
  return { phase: 'idle', timer: 55, tag: '', mult: 1, joined: false, nextTag: '', nextMult: 0 };
}

export function createRun(): RunState {
  return {
    time: 0,
    hearts: 0,
    heartsEarned: 0,
    followers: 0,
    followersPeak: 0,
    bond: 0,
    bondEarned: 0,
    lines: zeroLines(),
    ups: {},
    toggles: {},
    crew: {},
    autoBuy: { text: true, photo: true, video: true, live: true },
    budget: 1,
    capOnly: false,
    trendRule: 3,
    collabs: {},
    milestones: {},
    comments: [],
    commentAcc: 0,
    nextCommentId: 1,
    trend: createTrend(),
    crewTimers: {},
    posts: 0,
    manualPosts: 0,
    postAcc: zeroLines(),
    net: false,
    creators: 0,
    communities: 0,
    netPosts: 0,
    netPostAcc: 0,
    chips: { heat: 1, depth: 1, novel: 1, close: 1 },
    petals: { reach: false, bond: false, create: false, community: false },
    festival: false,
    festivalGauge: 0,
    feedAi: 'off',
    feedFocus: 'heat',
    feedAiTimer: 0,
    spotlights: 0,
  };
}

export function createMeta(): MetaState {
  return {
    narrative: createNarrative(),
    seeds: 0,
    seedsTotal: 0,
    perks: {},
    runs: 0,
    totalTime: 0,
    totalPosts: 0,
    totalManualPosts: 0,
    totalHearts: 0,
    totalReplies: 0,
    manualReplies: 0,
    trendsJoined: 0,
    trendsSeen: 0,
    virals: 0,
    peakFollowers: 0,
    chipSeconds: { heat: 0, depth: 0, novel: 0, close: 0 },
    clickbaitSeconds: 0,
    sponsorSeconds: 0,
    flags: {},
    ended: false,
    endTime: 0,
    endingSeen: false,
    runHistory: [],
  };
}

export function createGame(seed = Date.now() | 0, now = Date.now()): GameState {
  return {
    v: SAVE_VERSION,
    rng: seed | 0,
    run: createRun(),
    meta: createMeta(),
    lastTs: now,
    createdAt: now,
  };
}
