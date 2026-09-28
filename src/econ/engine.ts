// Simulation engine: fixed-step tick + player actions. No rendering, no DOM.
import {
  COLLABS,
  CREW,
  LINE_IDS,
  LINES,
  MILESTONES,
  PERKS,
  PETAL_IDS,
  SIGNAL_IDS,
  STUDIO_UPGRADES,
  COMMUNITY_UPGRADES,
  TREND_TAGS,
  type CrewId,
  type LineId,
  type PetalId,
  type SignalId,
} from './defs';
import {
  BAL,
  PETAL_AT,
  allPetals,
  boriEff,
  boriInterval,
  collabCost,
  commentTtl,
  crewLv,
  crewNextCost,
  derive,
  effCount,
  festivalRatiosFor,
  bondMult,
  has,
  heartMult,
  lineBulkCost,
  lineCost,
  lineMaxAffordable,
  lineUnlocked,
  ms,
  netFlows,
  perk,
  petalValue,
  prestigeUnlocked,
  replyBond,
  reqMet,
  seedGain,
  totalChips,
  trendMultValue,
  trueFans,
  upgradeDef,
  usedChips,
  capacity,
  type Derived,
} from './calc';
import { rand, randInt, pick } from './rng';
import { createRun, type CommentKind, type FeedAiMode, type GameState } from './state';
import { advanceNarrative, pendingEpisode, narrativeEffects } from './narrative';

export type GameEvent =
  | { t: 'post'; hearts: number; followers: number }
  | { t: 'spotlight'; hearts: number }
  | { t: 'autopost'; line: LineId; n: number }
  | { t: 'netpost'; n: number }
  | { t: 'comment'; id: number; slot: number }
  | { t: 'reply'; id: number; slot: number; bond: number; manual: boolean; hearts: number }
  | { t: 'commentExpire'; id: number; slot: number }
  | { t: 'buy'; kind: 'line' | 'upgrade' | 'crew' | 'collab' | 'perk'; id: string; n?: number; auto?: boolean }
  | { t: 'milestone'; id: string }
  | { t: 'unlock'; id: string }
  | { t: 'trendStart'; tag: string; mult: number }
  | { t: 'trendJoin'; auto: boolean }
  | { t: 'trendEnd'; joined: boolean }
  | { t: 'viral'; followers: number; hearts: number }
  | { t: 'prestige'; seeds: number; fans: number }
  | { t: 'petal'; id: PetalId }
  | { t: 'festival' }
  | { t: 'story'; id: string }
  | { t: 'storyChoice'; id: string; choice: string; reward: string }
  | { t: 'ending' };

export type Out = GameEvent[];

const EPS = 1e-9;

// ── resource helpers ────────────────────────────────────────────────────────
function addHearts(s: GameState, v: number): void {
  if (!(v > 0) || !Number.isFinite(v)) return;
  s.run.hearts += v;
  s.run.heartsEarned += v;
  s.meta.totalHearts += v;
}
function addFollowers(s: GameState, v: number): void {
  if (!(v > 0) || !Number.isFinite(v)) return;
  const r = s.run;
  r.followers += v;
  if (r.followers > r.followersPeak) r.followersPeak = r.followers;
  if (r.followers > s.meta.peakFollowers) s.meta.peakFollowers = r.followers;
}
function addBond(s: GameState, v: number): void {
  if (!(v > 0) || !Number.isFinite(v)) return;
  s.run.bond += v;
  s.run.bondEarned += v;
}
/** Relative tolerance so floating-point bulk-cost sums never block a purchase you can see as affordable. */
export function afford(have: number, cost: number): boolean {
  return have + EPS >= cost * (1 - 1e-9);
}
function spendHearts(s: GameState, v: number): boolean {
  if (!(v >= 0) || !Number.isFinite(v)) return false;
  if (!afford(s.run.hearts, v)) return false;
  s.run.hearts = Math.max(0, s.run.hearts - v);
  return true;
}

function flag(s: GameState, id: string, out?: Out): boolean {
  if (s.meta.flags[id]) return false;
  s.meta.flags[id] = true;
  out?.push({ t: 'unlock', id });
  return true;
}

// ── actions ─────────────────────────────────────────────────────────────────
/** The first verb. In the network phase the same tap also spotlights a creator. */
export function post(s: GameState, out?: Out, d: Derived = derive(s)): void {
  const r = s.run;
  addHearts(s, d.manualHearts);
  addFollowers(s, d.manualFollowers);
  r.posts++;
  r.manualPosts++;
  s.meta.totalPosts++;
  s.meta.totalManualPosts++;
  out?.push({ t: 'post', hearts: d.manualHearts, followers: d.manualFollowers });
  if (r.net) {
    const mult = has(s, 'n_spot') ? 3 : 1;
    const h = d.net.hps * BAL.spotlightSec * mult * narrativeEffects(s).manual;
    const f = d.net.fps * BAL.spotlightSec * mult;
    addHearts(s, h);
    addFollowers(s, f);
    r.spotlights++;
    out?.push({ t: 'spotlight', hearts: h });
  }
}

/** Validate the current episode, so stale/double clicks cannot grant rewards twice. */
export function chooseStory(s: GameState, episodeId: string, choiceId: string, out?: Out): boolean {
  const episode = pendingEpisode(s);
  if (!episode || episode.id !== episodeId) return false;
  const choice = episode.choices.find((c) => c.id === choiceId);
  if (!choice) return false;
  const d = derive(s);
  let reward = choice.effect;
  if (choice.reward === 'hearts') {
    const amount = Math.max(d.hps * 30, d.manualHearts * 20);
    addHearts(s, amount);
    reward = `하트 +${Math.floor(amount)}`;
  } else if (choice.reward === 'bond') {
    const amount = replyBond(s, 'normal', true) * 12;
    addBond(s, amount);
    reward = `유대 +${Math.floor(amount)}`;
  }
  s.meta.narrative.choices.push(choiceId);
  s.meta.narrative.pending = false;
  s.meta.narrative.elapsed = 0;
  out?.push({ t: 'storyChoice', id: episode.id, choice: choiceId, reward });
  return true;
}

export function reply(s: GameState, commentId: number, manual: boolean, out?: Out, eff = 1): boolean {
  const r = s.run;
  const idx = r.comments.findIndex((c) => c.id === commentId);
  if (idx < 0) return false;
  const c = r.comments[idx];
  r.comments.splice(idx, 1);
  const bond = replyBond(s, c.kind, manual) * eff;
  addBond(s, bond);
  let hearts = 0;
  if (has(s, 'qna')) {
    const d = derive(s);
    hearts = Math.max(10, d.hps * 3) * eff;
    addHearts(s, hearts);
  }
  s.meta.totalReplies++;
  if (manual) s.meta.manualReplies++;
  out?.push({ t: 'reply', id: c.id, slot: c.slot, bond, manual, hearts });
  return true;
}

export function buyLine(s: GameState, id: LineId, count: number | 'max', out?: Out, auto = false): number {
  if (!lineUnlocked(s, id)) return 0;
  const n = count === 'max' ? lineMaxAffordable(s, id) : Math.max(0, Math.floor(count));
  if (n <= 0) return 0;
  const cost = n === 1 ? lineCost(s, id) : lineBulkCost(s, id, n);
  if (!spendHearts(s, cost)) return 0;
  s.run.lines[id] += n;
  out?.push({ t: 'buy', kind: 'line', id, n, auto });
  return n;
}

export function canBuyUpgrade(s: GameState, id: string): boolean {
  const u = upgradeDef(id);
  if (!u || s.run.ups[id]) return false;
  if (!reqMet(s, u.req)) return false;
  if (id.startsWith('n_') && !s.run.net) return false;
  return u.currency === 'hearts' ? afford(s.run.hearts, u.cost) : afford(s.run.bond, u.cost);
}

export function buyUpgrade(s: GameState, id: string, out?: Out): boolean {
  if (!canBuyUpgrade(s, id)) return false;
  const u = upgradeDef(id)!;
  if (u.currency === 'hearts') {
    if (!spendHearts(s, u.cost)) return false;
  } else {
    s.run.bond = Math.max(0, s.run.bond - u.cost);
  }
  s.run.ups[id] = true;
  if (u.toggle) s.run.toggles[id] = true;
  out?.push({ t: 'buy', kind: 'upgrade', id });
  if (id === 'phone') flag(s, 'line_photo', out);
  if (id === 'editor') flag(s, 'line_video', out);
  if (id === 'livecomm') flag(s, 'line_live', out);
  if (id === 'n_feedai') flag(s, 'feedai', out);
  return true;
}

export function toggleUpgrade(s: GameState, id: string): boolean {
  if (!s.run.ups[id]) return false;
  const u = upgradeDef(id);
  if (!u?.toggle) return false;
  s.run.toggles[id] = !s.run.toggles[id];
  return true;
}

export function crewUnlocked(s: GameState, id: CrewId): boolean {
  if (!ms(s, 'm1000') && !perk(s, 'p_crew')) return false;
  return reqMet(s, CREW[id].req);
}

export function hireCrew(s: GameState, id: CrewId, out?: Out): boolean {
  if (!crewUnlocked(s, id)) return false;
  const c = crewNextCost(s, id);
  if (!c) return false;
  if (!afford(s.run.hearts, c.hearts) || !afford(s.run.bond, c.bond)) return false;
  spendHearts(s, c.hearts);
  s.run.bond = Math.max(0, s.run.bond - c.bond);
  s.run.crew[id] = crewLv(s, id) + 1;
  out?.push({ t: 'buy', kind: 'crew', id });
  return true;
}

export function joinTrend(s: GameState, auto: boolean, out?: Out): boolean {
  const t = s.run.trend;
  if (t.phase !== 'active' || t.joined) return false;
  t.joined = true;
  s.meta.trendsJoined++;
  out?.push({ t: 'trendJoin', auto });
  return true;
}

export function collabUnlocked(s: GameState): boolean {
  return ms(s, 'm2500');
}

export function doCollab(s: GameState, id: string, out?: Out): boolean {
  if (!collabUnlocked(s) || s.run.collabs[id]) return false;
  if (!COLLABS.some((c) => c.id === id)) return false;
  const c = collabCost(s);
  if (!afford(s.run.hearts, c.hearts) || !afford(s.run.bond, c.bond)) return false;
  spendHearts(s, c.hearts);
  s.run.bond = Math.max(0, s.run.bond - c.bond);
  s.run.collabs[id] = true;
  // the partner's audience discovers you
  addFollowers(s, s.run.followers * 0.1);
  out?.push({ t: 'buy', kind: 'collab', id });
  return true;
}

/** Independence happens once: it moves you from Bloomline to your own network. */
export function canPrestige(s: GameState): boolean {
  return s.meta.runs === 0 && prestigeUnlocked(s) && seedGain(s) >= 1;
}

export function applyPerkGrants(s: GameState): void {
  const r = s.run;
  if (perk(s, 'p_routine')) {
    r.lines.text = Math.max(r.lines.text, 10);
    r.lines.photo = Math.max(r.lines.photo, 5);
    r.ups.phone = true;
  }
  if (perk(s, 'p_studio')) {
    for (const u of STUDIO_UPGRADES.slice(0, 6)) r.ups[u.id] = true;
  }
  if (perk(s, 'p_regulars')) {
    for (const u of COMMUNITY_UPGRADES.slice(0, 4)) r.ups[u.id] = true;
  }
  if (perk(s, 'p_crew')) {
    for (const id of ['manager', 'bori', 'doyun'] as CrewId[]) r.crew[id] = Math.max(1, crewLv(s, id));
  }
}

export function doPrestige(s: GameState, out?: Out): boolean {
  if (!canPrestige(s)) return false;
  const old = s.run;
  const gain = seedGain(s);
  const fans = trueFans(s);
  const m = s.meta;
  m.seeds += gain;
  m.seedsTotal += gain;
  m.runs++;
  m.runHistory.push({ time: old.time, followers: old.followers, bond: old.bondEarned, seeds: gain });
  const r = createRun();
  // automation preferences carry over; they are the player's design, not progress
  r.autoBuy = { ...old.autoBuy };
  r.budget = old.budget;
  r.capOnly = old.capOnly;
  r.trendRule = old.trendRule;
  r.followers = fans;
  r.followersPeak = fans;
  s.run = r;
  applyPerkGrants(s);
  flag(s, 'newhome', out);
  out?.push({ t: 'prestige', seeds: gain, fans });
  return true;
}

export function buyPerk(s: GameState, id: string, out?: Out): boolean {
  const p = PERKS.find((x) => x.id === id);
  if (!p || s.meta.perks[id] || s.meta.runs < 1) return false;
  if (s.meta.seeds < p.cost) return false;
  s.meta.seeds -= p.cost;
  s.meta.perks[id] = true;
  applyPerkGrants(s);
  out?.push({ t: 'buy', kind: 'perk', id });
  return true;
}

export function setChip(s: GameState, sig: SignalId, delta: number): boolean {
  const r = s.run;
  if (!r.net) return false;
  const next = r.chips[sig] + delta;
  if (next < 0) return false;
  if (delta > 0 && usedChips(r) + delta > totalChips(s)) return false;
  r.chips[sig] = next;
  return true;
}

export function setFeedAi(s: GameState, mode: FeedAiMode, focus?: SignalId): void {
  if (!has(s, 'n_feedai')) return;
  s.run.feedAi = mode;
  if (focus) s.run.feedFocus = focus;
  s.run.feedAiTimer = 0;
}

// ── automation internals ────────────────────────────────────────────────────
function managerAct(s: GameState, out?: Out): void {
  const r = s.run;
  const lv = crewLv(s, 'manager');
  const budgetFrac = lv >= 2 ? r.budget : 1;
  const cap = capacity(s);
  for (let i = 0; i < 12; i++) {
    let best: LineId | null = null;
    let bestCost = Infinity;
    for (const id of LINE_IDS) {
      if (!r.autoBuy[id] || !lineUnlocked(s, id)) continue;
      if (r.capOnly && r.lines[id] >= cap) continue;
      const c = lineCost(s, id);
      if (c < bestCost) {
        bestCost = c;
        best = id;
      }
    }
    if (!best || bestCost > r.hearts * budgetFrac + EPS) return;
    if (buyLine(s, best, 1, out, true) === 0) return;
  }
}

function spawnComment(s: GameState, out?: Out): void {
  const r = s.run;
  const used = new Set(r.comments.map((c) => c.slot));
  const free: number[] = [];
  for (let i = 0; i < BAL.commentSlots; i++) if (!used.has(i)) free.push(i);
  if (free.length === 0) return;
  const slot = pick(s, free);
  const kind: CommentKind = r.trend.phase === 'active' && r.trend.joined ? 'trend' : 'normal';
  const ttl = commentTtl(s);
  const c = { id: r.nextCommentId++, slot, ttl, maxTtl: ttl, kind, textIdx: randInt(s, 0, 9999) };
  r.comments.push(c);
  out?.push({ t: 'comment', id: c.id, slot });
}

function rollNextTrend(s: GameState): void {
  const t = s.run.trend;
  let tag = pick(s, TREND_TAGS);
  if (tag === t.tag) tag = pick(s, TREND_TAGS);
  t.nextTag = tag;
  t.nextMult = randInt(s, BAL.trendMultMin, BAL.trendMultMax);
}

function trendAutoJoin(s: GameState, out?: Out): void {
  const r = s.run;
  if (crewLv(s, 'doyun') < 1 || r.trendRule <= 0) return;
  const t = r.trend;
  if (t.phase !== 'active' || t.joined) return;
  if (r.trendRule === 1 || t.mult >= r.trendRule) joinTrend(s, true, out);
}

function trendTick(s: GameState, dt: number, out?: Out): void {
  const r = s.run;
  if (!ms(s, 'm300')) return;
  const t = r.trend;
  if (!t.nextTag) rollNextTrend(s);
  t.timer -= dt;
  if (t.phase === 'idle') {
    if (t.timer <= 0) {
      t.phase = 'active';
      t.tag = t.nextTag;
      t.mult = trendMultValue(s, t.nextMult);
      t.joined = false;
      t.timer = BAL.trendActive;
      rollNextTrend(s);
      s.meta.trendsSeen++;
      out?.push({ t: 'trendStart', tag: t.tag, mult: t.mult });
    }
  } else {
    trendAutoJoin(s, out);
    if (t.timer <= 0) {
      const joined = t.joined;
      t.phase = 'idle';
      t.joined = false;
      const freq = perk(s, 'p_trend') ? 1.5 : 1;
      t.timer = (BAL.trendIdleMin + rand(s) * (BAL.trendIdleMax - BAL.trendIdleMin)) / freq;
      out?.push({ t: 'trendEnd', joined });
    }
  }
}

function checkMilestones(s: GameState, out?: Out): void {
  const r = s.run;
  for (const m of MILESTONES) {
    if (r.milestones[m.id]) continue;
    if (r.followers >= m.at) {
      r.milestones[m.id] = true;
      out?.push({ t: 'milestone', id: m.id });
      flag(s, 'ms_' + m.id, out);
    }
  }
}

function checkFlags(s: GameState, out?: Out): void {
  const r = s.run;
  if (r.heartsEarned >= 3) flag(s, 'tab_studio', out);
  if (lineUnlocked(s, 'text')) flag(s, 'tab_lines', out);
  if (r.followers >= 1) flag(s, 'first_follower', out);
  if (r.bondEarned > 0) flag(s, 'tab_community', out);
  if (ms(s, 'm1000') || perk(s, 'p_crew')) flag(s, 'tab_crew', out);
  if (ms(s, 'm2500')) flag(s, 'tab_collab', out);
  if (prestigeUnlocked(s)) flag(s, 'tab_prestige', out);
  if (s.meta.runs === 0 && r.followers >= 5e4) flag(s, 'platform_slow', out);
  if (r.lines.text + r.lines.photo + r.lines.video + r.lines.live > 0) flag(s, 'first_routine', out);
  const cap = capacity(s);
  for (const id of LINE_IDS) if (r.lines[id] > cap) flag(s, 'overcap', out);
  if (r.net && r.communities >= 1) flag(s, 'communities', out);
}

function checkNetwork(s: GameState, out?: Out): void {
  const r = s.run;
  if (!r.net && s.meta.runs >= 1 && r.followers >= BAL.netUnlockF) {
    r.net = true;
    r.creators = Math.max(1, r.creators);
    const n = totalChips(s);
    r.chips = { heat: 0, depth: 0, novel: 0, close: 0 };
    let k = 0;
    while (k < n) {
      r.chips[SIGNAL_IDS[k % 4]]++;
      k++;
    }
    flag(s, 'network', out);
  }
  if (!r.net) return;
  for (const id of PETAL_IDS) {
    if (!r.petals[id] && petalValue(s, id) >= PETAL_AT[id]) {
      r.petals[id] = true;
      // each petal also returns a seed: late perk choices stay open
      s.meta.seeds += 1;
      s.meta.seedsTotal += 1;
      out?.push({ t: 'petal', id });
      flag(s, 'petal_' + id, out);
    }
  }
  if (!r.festival && allPetals(s)) {
    r.festival = true;
    out?.push({ t: 'festival' });
    flag(s, 'festival', out);
  }
}

/** Enumerate every allocation of n chips over 4 signals. */
function* allocations(n: number): Generator<Record<SignalId, number>> {
  for (let a = 0; a <= n; a++)
    for (let b = 0; b <= n - a; b++)
      for (let c = 0; c <= n - a - b; c++) yield { heat: a, depth: b, novel: c, close: n - a - b - c };
}

/** Feed AI objective value (higher is better) for an allocation. */
export function feedScore(s: GameState, chips: Record<SignalId, number>, hm: number, bm: number, baseFps: number, baseBps: number): number {
  const r = s.run;
  const n = netFlows(s, chips, hm, bm);
  if (r.festival) return festivalRatiosFor(n).min;
  // open the nearest remaining petal as fast as possible
  let best = 1e30;
  for (const id of PETAL_IDS) {
    if (r.petals[id]) continue;
    const need = PETAL_AT[id] - petalValue(s, id);
    if (need <= 0) continue;
    let rate = 0;
    if (id === 'reach') rate = n.fps + baseFps;
    else if (id === 'bond') rate = n.bps + baseBps;
    else if (id === 'create') rate = n.cps;
    else rate = n.kps;
    const t = rate > 0 ? need / rate : 1e30;
    if (t < best) best = t;
  }
  // tie-breaker: overall network activity
  return 1 / best + n.pps * 1e-18;
}

export function bestAllocation(s: GameState, d: Derived): Record<SignalId, number> {
  const r = s.run;
  const n = totalChips(s);
  if (r.feedAi === 'focus') {
    return { heat: 0, depth: 0, novel: 0, close: 0, [r.feedFocus]: n } as Record<SignalId, number>;
  }
  let best = { ...r.chips };
  let bestV = -1;
  for (const a of allocations(n)) {
    const v = feedScore(s, a, d.heartMult, d.bondMult, d.routineFps, d.routineBps);
    if (v > bestV + 1e-15) {
      bestV = v;
      best = a;
    }
  }
  return best;
}

function sanitize(s: GameState): void {
  const r = s.run as unknown as Record<string, unknown>;
  for (const k of ['hearts', 'heartsEarned', 'followers', 'followersPeak', 'bond', 'bondEarned', 'creators', 'communities', 'festivalGauge']) {
    const v = r[k] as number;
    if (!Number.isFinite(v) || v < 0) r[k] = Number.isFinite(v) ? 0 : v > 0 ? 1e300 : 0;
    else if (v > 1e300) r[k] = 1e300;
  }
}

// ── main tick ───────────────────────────────────────────────────────────────
export interface TickOpts {
  offline?: boolean;
  background?: boolean;
}

export function tick(s: GameState, dt: number, out?: Out, opts: TickOpts = {}): Derived {
  const r = s.run;
  const m = s.meta;
  if (!(dt > 0)) return derive(s);
  const d = derive(s);
  const eff = opts.offline ? BAL.offlineEff : 1;
  r.time += dt;
  m.totalTime += dt;

  addHearts(s, d.hps * dt * eff);
  addFollowers(s, d.fps * dt * eff);
  addBond(s, d.bps * dt * eff);

  for (const id of LINE_IDS) {
    const acc = r.postAcc[id] + d.line[id].pps * dt;
    const n = Math.floor(acc);
    r.postAcc[id] = acc - n;
    if (n > 0) {
      r.posts += n;
      m.totalPosts += n;
      out?.push({ t: 'autopost', line: id, n });
    }
  }

  if (r.net) {
    r.creators += Math.min(d.net.cps * dt, Math.max(0, d.net.ccap - r.creators)) * eff;
    r.communities += d.net.kps * dt * eff;
    const acc = r.netPostAcc + d.net.pps * dt;
    const n = Math.floor(acc);
    r.netPostAcc = acc - n;
    if (n > 0) {
      r.netPosts += n;
      m.totalPosts += n;
      out?.push({ t: 'netpost', n });
    }
    for (const id of SIGNAL_IDS) m.chipSeconds[id] += r.chips[id] * dt;
    if (r.festival && !m.ended) {
      const fr = festivalRatiosFor(d.net);
      r.festivalGauge = Math.min(1, r.festivalGauge + (Math.min(1, fr.min) / BAL.festivalFillSec) * dt);
      if (r.festivalGauge >= 1) {
        m.ended = true;
        m.endTime = m.totalTime;
        flag(s, 'ending', out);
        out?.push({ t: 'ending' });
      }
    }
  }

  if (has(s, 'clickbait') && r.toggles.clickbait) m.clickbaitSeconds += dt;
  if (has(s, 'sponsor') && r.toggles.sponsor) m.sponsorSeconds += dt;

  // comments
  if (ms(s, 'm10')) {
    for (let i = r.comments.length - 1; i >= 0; i--) {
      const c = r.comments[i];
      c.ttl -= dt;
      if (c.ttl <= 0) {
        r.comments.splice(i, 1);
        out?.push({ t: 'commentExpire', id: c.id, slot: c.slot });
      }
    }
    r.commentAcc += d.commentRate * dt;
    let guard = 0;
    while (r.commentAcc >= 1 && guard++ < 10) {
      r.commentAcc -= 1;
      spawnComment(s, out);
    }
    if (r.commentAcc > 3) r.commentAcc = 3;
  }

  // crew
  const mgr = crewLv(s, 'manager');
  if (mgr > 0) {
    const iv = mgr >= 2 ? 0.25 : 1;
    r.crewTimers.manager = (r.crewTimers.manager ?? 0) + dt;
    let g = 0;
    while (r.crewTimers.manager >= iv && g++ < 8) {
      r.crewTimers.manager -= iv;
      managerAct(s, out);
    }
    if (r.crewTimers.manager > iv) r.crewTimers.manager = iv;
  }
  const bori = crewLv(s, 'bori');
  if (bori > 0) {
    const iv = boriInterval(bori);
    r.crewTimers.bori = (r.crewTimers.bori ?? 0) + dt;
    let g = 0;
    while (r.crewTimers.bori >= iv && g++ < 8) {
      if (r.comments.length === 0) {
        r.crewTimers.bori = Math.min(r.crewTimers.bori, iv);
        break;
      }
      r.crewTimers.bori -= iv;
      let target = r.comments[0];
      for (const c of r.comments) if (c.ttl < target.ttl) target = c;
      reply(s, target.id, false, out, boriEff(bori) * eff);
    }
  }

  trendTick(s, dt, out);

  if (!opts.offline && ms(s, 'm100')) {
    const chance = BAL.viralChance * (r.trend.phase === 'active' && r.trend.joined ? 3 : 1);
    if (rand(s) < chance * dt) {
      const f = Math.max(5, d.fps * BAL.viralFollowSec);
      const h = Math.max(d.manualHearts * 10, d.hps * BAL.viralHeartSec);
      addFollowers(s, f);
      addHearts(s, h);
      m.virals++;
      out?.push({ t: 'viral', followers: f, hearts: h });
    }
  }

  checkMilestones(s, out);
  checkFlags(s, out);
  checkNetwork(s, out);
  const episode = advanceNarrative(s, dt, !!opts.offline || !!opts.background);
  if (episode) out?.push({ t: 'story', id: episode });

  if (r.net && r.feedAi !== 'off' && has(s, 'n_feedai')) {
    r.feedAiTimer -= dt;
    if (r.feedAiTimer <= 0) {
      r.feedAiTimer = 2;
      r.chips = bestAllocation(s, d);
    }
  }

  sanitize(s);
  return d;
}

/**
 * Offline / hidden-tab catch-up. Runs the same simulation in coarse steps with
 * reduced efficiency and no random viral events. Returns a summary.
 */
export interface OfflineSummary {
  seconds: number;
  simulated: number;
  hearts: number;
  followers: number;
  bond: number;
  creators: number;
}

export function simulateOffline(s: GameState, seconds: number, out?: Out): OfflineSummary {
  const sim = Math.max(0, Math.min(seconds, BAL.offlineMaxSec));
  const h0 = s.run.heartsEarned;
  const f0 = s.run.followers;
  const b0 = s.run.bondEarned;
  const c0 = s.run.creators;
  let left = sim;
  while (left > 0) {
    const step = Math.min(1, left);
    tick(s, step, out, { offline: true });
    left -= step;
  }
  return {
    seconds,
    simulated: sim,
    hearts: s.run.heartsEarned - h0,
    followers: s.run.followers - f0,
    bond: s.run.bondEarned - b0,
    creators: s.run.creators - c0,
  };
}

// Re-exports used by UI and tests
export { derive, heartMult, bondMult, effCount, LINES };
