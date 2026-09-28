// Side-panel tabs. Each tab builds its DOM once per structural "key" and then
// updates numbers in place.
import type { Game } from '../game';
import type { GameState } from '../econ/state';
import {
  COLLABS,
  COMMUNITY_UPGRADES,
  CREW,
  CREW_IDS,
  LINE_IDS,
  LINES,
  NET_UPGRADES,
  PERKS,
  PETAL_IDS,
  PETALS,
  SIGNAL_IDS,
  SIGNALS,
  STUDIO_UPGRADES,
  type CrewId,
  type LineId,
  type SignalId,
  type UpgradeDef,
} from '../econ/defs';
import {
  BAL,
  FESTIVAL_AT,
  PETAL_AT,
  bondForCap,
  boriEff,
  boriInterval,
  capacity,
  collabCost,
  commentRate,
  crewLv,
  crewNextCost,
  festivalRatiosFor,
  has,
  lineBulkCost,
  lineCost,
  lineMaxAffordable,
  lineUnlocked,
  ms,
  petalValue,
  platformK,
  replyBond,
  reqMet,
  seedGain,
  totalChips,
  trueFans,
  usedChips,
} from '../econ/calc';
import {
  afford,
  buyLine,
  buyPerk,
  buyUpgrade,
  canBuyUpgrade,
  canPrestige,
  collabUnlocked,
  crewUnlocked,
  doCollab,
  hireCrew,
  setChip,
  setFeedAi,
  toggleUpgrade,
} from '../econ/engine';
import { fmt, fmtTime } from '../util/format';
import { clear, h, setClass, setText } from './dom';
import { icon } from './icons';
import { bar, card, CostBtn, section, selectRow, TextBtn, toggle } from './widgets';
import { SIGNAL_COL } from '../render/city';

export type TabId = 'lines' | 'studio' | 'community' | 'crew' | 'collab' | 'feed' | 'prestige';

export interface TabCtx {
  g: Game;
  confirmPrestige(): void;
  goTab(id: TabId): void;
}

export interface TabView {
  el: HTMLElement;
  update(): void;
}

export interface TabDef {
  id: TabId;
  label: (s: GameState) => string;
  icon: string;
  visible: (s: GameState) => boolean;
  key: (s: GameState) => string;
  build: (c: TabCtx) => TabView;
}

const LINE_ICON: Record<LineId, string> = { text: 'text', photo: 'photo', video: 'video', live: 'live' };
const LINE_REQ: Record<LineId, string> = {
  text: '하트 5개를 모으면 열려요',
  photo: "작업실의 '새 휴대폰'이 필요해요",
  video: "작업실의 '편집 프로그램'이 필요해요",
  live: "커뮤니티의 '정기 소통 방송'이 필요해요",
};

function heartEta(g: Game, cost: number): number | undefined {
  const need = cost - g.s.run.hearts;
  if (need <= 0) return 0;
  return g.d.hps > 0 ? need / g.d.hps : undefined;
}

function bondRate(g: Game): number {
  const s = g.s;
  let r = g.d.bps;
  const lv = crewLv(s, 'bori');
  if (lv > 0) r += Math.min(1 / boriInterval(lv), g.d.commentRate) * replyBond(s, 'normal', false) * boriEff(lv);
  return r;
}

function bondEta(g: Game, cost: number): number | undefined {
  const need = cost - g.s.run.bond;
  if (need <= 0) return 0;
  const r = bondRate(g);
  return r > 0 ? need / r : undefined;
}

// ── generic upgrade list ──────────────────────────────────────────────────
function upgradeVisible(s: GameState, u: UpgradeDef): boolean {
  if (s.run.ups[u.id]) return false;
  if (!reqMet(s, u.req)) return false;
  if (u.id.startsWith('n_') && !s.run.net) return false;
  return true;
}

function nextUps(s: GameState, defs: UpgradeDef[], n: number): UpgradeDef[] {
  return defs
    .filter((u) => upgradeVisible(s, u))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, n);
}

function upKey(s: GameState, defs: UpgradeDef[], n: number): string {
  return nextUps(s, defs, n).map((u) => u.id).join(',') + '|' + defs.filter((u) => s.run.ups[u.id]).length;
}

function upgradeBlock(c: TabCtx, defs: UpgradeDef[], n: number, iconName: string, title: string, note?: string): TabView {
  const g = c.g;
  const s = g.s;
  const root = h('div');
  const list = nextUps(s, defs, n);
  const sec = section(title, iconName, note);
  root.append(sec);
  const rows: { u: UpgradeDef; btn: CostBtn }[] = [];
  if (list.length === 0) sec.append(h('p', { class: 'note', text: '지금 살 수 있는 것은 모두 갖췄어요.' }));
  for (const u of list) {
    const cd = card(null, u.name, u.desc);
    cd.el.style.gridTemplateColumns = '0 1fr auto';
    const btn = new CostBtn('구매', () => g.do((st, out) => buyUpgrade(st, u.id, out)), 'btn');
    cd.btns.append(btn.el);
    sec.append(cd.el);
    rows.push({ u, btn });
  }
  const owned = defs.filter((u) => s.run.ups[u.id]);
  if (owned.length) {
    sec.append(h('p', { class: 'note' }, h('b', { text: `갖춘 것 ${owned.length}개: ` }), owned.map((u) => u.name).join(' · ')));
  }
  return {
    el: root,
    update: () => {
      for (const { u, btn } of rows) {
        const ok = canBuyUpgrade(g.s, u.id);
        if (u.currency === 'hearts') btn.set(null, u.cost, 0, ok, heartEta(g, u.cost));
        else btn.set(null, 0, u.cost, ok, bondEta(g, u.cost));
      }
    },
  };
}

function policyBlock(c: TabCtx): TabView | null {
  const g = c.g;
  const s = g.s;
  const pols = STUDIO_UPGRADES.filter((u) => u.toggle && s.run.ups[u.id]);
  if (pols.length === 0) return null;
  const sec = section('운영 방침', 'gear', '언제든 켜고 끌 수 있어요. 지금 필요한 쪽을 고르세요.');
  const rows: { id: string; t: { input: HTMLInputElement }; st: HTMLDivElement }[] = [];
  for (const u of pols) {
    const cd = card(null, u.name, u.desc);
    cd.el.style.gridTemplateColumns = '0 1fr auto';
    const t = toggle('켜기', !!s.run.toggles[u.id], () => {
      g.do((st) => toggleUpgrade(st, u.id));
    });
    cd.right.append(t.el);
    sec.append(cd.el);
    rows.push({ id: u.id, t, st: cd.st });
  }
  return {
    el: sec,
    update: () => {
      for (const r of rows) {
        const onNow = !!g.s.run.toggles[r.id];
        if (r.t.input.checked !== onNow) r.t.input.checked = onNow;
        const secs = r.id === 'clickbait' ? g.s.meta.clickbaitSeconds : g.s.meta.sponsorSeconds;
        setText(r.st, `${onNow ? '켜짐' : '꺼짐'} · 지금까지 켜 둔 시간 ${fmtTime(secs)}`);
      }
    },
  };
}

// ── lines ─────────────────────────────────────────────────────────────────
function buildLines(c: TabCtx): TabView {
  const g = c.g;
  const s = g.s;
  const root = h('div');
  const capNote = h('p', { class: 'note' });
  root.append(section('루틴', 'clock', capNote));
  const mgr = crewLv(s, 'manager') > 0;
  const rows: { id: LineId; cd: ReturnType<typeof card>; b1: CostBtn; b10: CostBtn; bm: CostBtn; auto?: HTMLInputElement; over: HTMLSpanElement; st2: HTMLSpanElement }[] = [];
  for (const id of LINE_IDS) {
    if (!lineUnlocked(s, id)) continue;
    const d = LINES[id];
    const cd = card(LINE_ICON[id], d.name, d.desc);
    const b1 = new CostBtn('+1', () => g.do((st, out) => buyLine(st, id, 1, out)));
    const b10 = new CostBtn('+10', () => g.do((st, out) => buyLine(st, id, 10, out)));
    const bm = new CostBtn('최대', () => g.do((st, out) => buyLine(st, id, 'max', out)));
    cd.btns.append(b1.el, b10.el, bm.el);
    const over = h('span', { class: 'over' });
    const st2 = h('span');
    cd.st.append(st2, h('br'), over);
    let auto: HTMLInputElement | undefined;
    if (mgr) {
      const t = toggle('자동 구매', s.run.autoBuy[id], (v) => {
        g.s.run.autoBuy[id] = v;
      });
      cd.right.append(t.el);
      auto = t.input;
    }
    root.append(cd.el);
    rows.push({ id, cd, b1, b10, bm, auto, over, st2 });
  }
  const locked = LINE_IDS.find((id) => !lineUnlocked(s, id));
  if (locked) {
    const cd = card('lock', '???', LINE_REQ[locked]);
    cd.el.classList.add('locked');
    root.append(cd.el);
  }
  return {
    el: root,
    update: () => {
      const st = g.s;
      const d = g.d;
      const cap = d.cap;
      if (st.meta.flags.overcap) {
        capNote.replaceChildren(
          '관객 수용력 ',
          h('b', { text: String(cap) }),
          ' — 한 루틴이 수용력을 넘으면 넘은 만큼은 효율이 25%예요. 유대를 쌓으면 수용력이 커져요.',
        );
      } else {
        setText(capNote, '루틴은 정해진 간격으로 알아서 게시해요. 하나 살 때마다 가격이 올라요.');
      }
      for (const r of rows) {
        const ld = d.line[r.id];
        setText(r.cd.lv, `×${ld.count}`);
        setText(r.st2, `게시 ${fmt(ld.pps, true)}/초 · 게시물당 ♥${fmt(ld.hpp, true)} → ♥${fmt(ld.hps, true)}/초 · 팔로워 +${fmt(ld.fps, true)}/초`);
        setText(r.over, ld.count > cap ? `수용력 초과 ${ld.count - cap}개 (효율 25%)` : '');
        const c1 = lineCost(st, r.id);
        const c10 = lineBulkCost(st, r.id, 10);
        r.b1.set(null, c1, 0, afford(st.run.hearts, c1), heartEta(g, c1));
        r.b10.set(null, c10, 0, afford(st.run.hearts, c10), heartEta(g, c10));
        const n = lineMaxAffordable(st, r.id);
        if (n > 0) r.bm.set(`최대 +${n}`, lineBulkCost(st, r.id, n), 0, true);
        else r.bm.set('최대', c1, 0, false);
        if (r.auto && r.auto.checked !== st.run.autoBuy[r.id]) r.auto.checked = st.run.autoBuy[r.id];
      }
    },
  };
}

// ── studio ────────────────────────────────────────────────────────────────
function buildStudio(c: TabCtx): TabView {
  const root = h('div');
  const pol = policyBlock(c);
  const ups = upgradeBlock(c, STUDIO_UPGRADES, 5, 'star', '작업실', '모은 하트로 작업실을 꾸며요. 새 장비는 방에도 나타나요.');
  if (pol) root.append(pol.el);
  root.append(ups.el);
  return {
    el: root,
    update: () => {
      pol?.update();
      ups.update();
    },
  };
}

// ── community ─────────────────────────────────────────────────────────────
function buildCommunity(c: TabCtx): TabView {
  const g = c.g;
  const root = h('div');
  const info = h('div', { class: 'flows' });
  const kv = (k: string): HTMLSpanElement => {
    const v = h('span');
    info.append(h('span', { class: 'k', text: k }), v);
    return v;
  };
  const vCap = kv('관객 수용력');
  const vNext = kv('다음 수용력 +1까지');
  const vBond = kv('답글 하나의 유대');
  const vRate = kv('댓글이 달리는 속도');
  const sec = section('커뮤니티', 'bond', '댓글에 답글을 달면 유대가 쌓여요. 누적 유대가 늘수록 관객 수용력이 커지고, 유대로 커뮤니티를 가꿀 수 있어요.');
  sec.append(info);
  root.append(sec);
  const ups = upgradeBlock(c, COMMUNITY_UPGRADES, 5, 'community', '커뮤니티 가꾸기');
  root.append(ups.el);
  return {
    el: root,
    update: () => {
      const s = g.s;
      const cap = capacity(s);
      setText(vCap, String(cap));
      const need = bondForCap(s, cap + 1) - s.run.bondEarned;
      setText(vNext, Number.isFinite(need) ? `유대 ${fmt(Math.max(0, need))}` : '—');
      const nb = replyBond(s, 'normal', true);
      const tb = replyBond(s, 'trend', true);
      setText(vBond, `${fmt(nb, true)} (트렌드 댓글 ${fmt(tb, true)})`);
      setText(vRate, `${fmt(commentRate(s) * 60, true)}개/분`);
      ups.update();
    },
  };
}

// ── crew ──────────────────────────────────────────────────────────────────
const CREW_ICON: Record<CrewId, string> = { manager: 'gear', bori: 'bond', doyun: 'trend' };

function buildCrew(c: TabCtx): TabView {
  const g = c.g;
  const s = g.s;
  const root = h('div');
  root.append(section('크루', 'follower', '직접 하던 일을 크루에게 맡기면, 나는 규칙을 정하는 사람이 돼요.'));
  const rows: { id: CrewId; cd: ReturnType<typeof card>; btn: CostBtn; extra: (() => void)[] }[] = [];
  for (const id of CREW_IDS) {
    const def = CREW[id];
    const unlocked = crewUnlocked(s, id);
    if (!unlocked) {
      const cd = card('lock', `${def.name} · ${def.role}`, '트렌드가 보이기 시작하면 합류할 수 있어요 (팔로워 300명).');
      cd.el.classList.add('locked');
      root.append(cd.el);
      continue;
    }
    const lv = crewLv(s, id);
    const cd = card(CREW_ICON[id], `${def.name} · ${def.role}`, '');
    const btn = new CostBtn(lv === 0 ? '고용' : '성장', () => g.do((st, out) => hireCrew(st, id, out)));
    cd.btns.append(btn.el);
    const extra: (() => void)[] = [];
    if (id === 'manager' && lv >= 2) {
      const bud = selectRow(
        [
          { v: 1, label: '하트 전부' },
          { v: 0.5, label: '절반까지' },
          { v: 0.1, label: '10%까지' },
        ],
        () => g.s.run.budget,
        (v) => {
          g.s.run.budget = v;
        },
      );
      const capT = toggle('수용력까지만 구매', s.run.capOnly, (v) => {
        g.s.run.capOnly = v;
      });
      cd.st.after(h('div', { class: 'btns' }, h('span', { class: 'k', text: '예산' }), bud.el), h('div', { class: 'btns' }, capT.el));
      extra.push(bud.update, () => {
        if (capT.input.checked !== g.s.run.capOnly) capT.input.checked = g.s.run.capOnly;
      });
    }
    if (id === 'doyun' && lv >= 1) {
      const rule = selectRow(
        [
          { v: 0, label: '쉬기' },
          { v: 1, label: '모두' },
          { v: 4, label: '×4 이상' },
          { v: 6, label: '×6 이상' },
          { v: 9, label: '×9 이상' },
        ],
        () => g.s.run.trendRule,
        (v) => {
          g.s.run.trendRule = v;
        },
      );
      cd.st.after(h('div', { class: 'btns' }, h('span', { class: 'k', text: '참여 규칙' }), rule.el));
      extra.push(rule.update);
    }
    root.append(cd.el);
    rows.push({ id, cd, btn, extra });
  }
  return {
    el: root,
    update: () => {
      const st = g.s;
      for (const r of rows) {
        const lv = crewLv(st, r.id);
        const def = CREW[r.id];
        setText(r.cd.lv, lv > 0 ? `Lv.${lv}` : '');
        const cur = lv > 0 ? def.levels[lv - 1].desc : '아직 합류 전이에요.';
        const next = crewNextCost(st, r.id);
        setText(r.cd.ds, next ? (lv > 0 ? `${cur} → 다음: ${def.levels[lv].desc}` : def.levels[0].desc) : cur);
        let stat = '';
        if (r.id === 'bori' && lv > 0) stat = `답글 최대 ${fmt(60 / boriInterval(lv), true)}개/분 · 유대 ${Math.round(boriEff(lv) * 100)}%`;
        if (r.id === 'manager' && lv > 0) stat = '루틴 탭에서 루틴별 자동 구매를 켜고 끌 수 있어요.';
        if (r.id === 'doyun' && lv > 0) stat = `지금까지 참여한 트렌드 ${st.meta.trendsJoined}개`;
        setText(r.cd.st, stat);
        if (next) {
          r.btn.el.style.display = '';
          r.btn.set(lv === 0 ? '고용' : '성장', next.hearts, next.bond, afford(st.run.hearts, next.hearts) && afford(st.run.bond, next.bond), heartEta(g, next.hearts));
        } else {
          r.btn.el.style.display = 'none';
        }
        for (const f of r.extra) f();
      }
    },
  };
}

// ── collab ────────────────────────────────────────────────────────────────
function buildCollab(c: TabCtx): TabView {
  const g = c.g;
  const s = g.s;
  const root = h('div');
  if (!collabUnlocked(s)) {
    root.append(section('콜라보', 'community', '팔로워 2,500명이 되면 다시 제안이 들어와요.'));
    return { el: root, update: () => {} };
  }
  root.append(section('콜라보', 'community', '콜라보를 하면 상대의 관객이 찾아와요(현재 팔로워의 10%). 할 때마다 다음 비용이 올라가니 순서를 골라 보세요.'));
  const rows: { id: string; btn: CostBtn; cd: ReturnType<typeof card> }[] = [];
  for (const cb of COLLABS) {
    const cd = card('follower', cb.name, cb.desc);
    setText(cd.lv, cb.who);
    const btn = new CostBtn('함께하기', () => g.do((st, out) => doCollab(st, cb.id, out)));
    cd.btns.append(btn.el);
    root.append(cd.el);
    rows.push({ id: cb.id, btn, cd });
  }
  return {
    el: root,
    update: () => {
      const st = g.s;
      const cost = collabCost(st);
      for (const r of rows) {
        const done = !!st.run.collabs[r.id];
        setClass(r.cd.el, 'done', done);
        if (done) {
          r.btn.el.style.display = 'none';
          setText(r.cd.st, '함께했어요');
        } else {
          r.btn.el.style.display = '';
          setText(r.cd.st, '');
          r.btn.set(null, cost.hearts, cost.bond, afford(st.run.hearts, cost.hearts) && afford(st.run.bond, cost.bond), heartEta(g, cost.hearts));
        }
      }
    },
  };
}

// ── prestige / perks ─────────────────────────────────────────────────────
function buildPrestige(c: TabCtx): TabView {
  const g = c.g;
  const s = g.s;
  const root = h('div');
  if (s.meta.runs === 0) {
    const info = h('div', { class: 'flows' });
    const kv = (k: string): HTMLSpanElement => {
      const v = h('span');
      info.append(h('span', { class: 'k', text: k }), v);
      return v;
    };
    const vFans = kv('함께 떠날 찐팬');
    const vSeeds = kv('얻을 씨앗');
    const vNext = kv('다음 씨앗까지');
    const sec = section(
      '독립',
      'bloom',
      '블룸라인에서 한 계정이 닿을 수 있는 곳에는 한계가 있어요. 독립하면 나만의 작은 네트워크 "블룸"을 엽니다.',
    );
    sec.append(info);
    sec.append(
      h('p', { class: 'note' }, h('b', { text: '찐팬' }), ' = √(팔로워 × 누적 유대) × 0.1 — 많이 모은 것만큼, 깊이 나눈 것도 중요해요.'),
      h('p', { class: 'note' }, h('b', { text: '처음부터 다시: ' }), '하트, 팔로워(찐팬과 함께 시작), 유대, 루틴, 작업실, 커뮤니티, 크루, 콜라보, 마일스톤'),
      h('p', { class: 'note' }, h('b', { text: '그대로: ' }), '씨앗과 노하우, 자동화 설정, 기록'),
      h('p', { class: 'note' }, h('b', { text: '블룸에서는: ' }), `씨앗 하나마다 하트·팔로워 +${Math.round(BAL.seedBonus * 100)}%, 도달 한계 4배. 팔로워 ${fmt(BAL.netUnlockF)}명이 모이면 유저들이 직접 글을 쓰기 시작해요.`),
    );
    const btn = new TextBtn('독립하기…', () => c.confirmPrestige(), 'btn pink');
    sec.append(h('div', { class: 'btns' }, btn.el));
    root.append(sec);
    return {
      el: root,
      update: () => {
        const st = g.s;
        const fans = trueFans(st);
        const gain = seedGain(st);
        setText(vFans, `${fmt(fans)}명`);
        setText(vSeeds, `${gain}개`);
        const needFans = BAL.seedDiv * (gain + 1) * (gain + 1);
        setText(vNext, `찐팬 ${fmt(Math.max(0, needFans - fans))}명 더`);
        btn.set(gain >= 1 ? `독립하기 (씨앗 +${gain})` : '독립하기 (씨앗이 아직 없어요)', canPrestige(st));
      },
    };
  }
  const seedsV = h('b');
  const sec = section('노하우', 'seed', h('p', { class: 'note' }, '씨앗 ', seedsV, '개 — 블룸라인에서 배운 것을 몸에 익혀요. 꽃잎이 열릴 때마다 씨앗을 하나 더 얻어요.'));
  root.append(sec);
  const rows: { id: string; btn: TextBtn; cd: ReturnType<typeof card> }[] = [];
  for (const p of PERKS) {
    const cd = card('seed', p.name, p.desc);
    cd.el.style.gridTemplateColumns = 'auto 1fr auto';
    const btn = new TextBtn(`씨앗 ${p.cost}`, () => g.do((st, out) => buyPerk(st, p.id, out)));
    cd.btns.append(btn.el);
    sec.append(cd.el);
    rows.push({ id: p.id, btn, cd });
  }
  if (s.meta.runHistory.length) {
    const hst = s.meta.runHistory[0];
    sec.append(h('p', { class: 'note', text: `블룸라인 시절: ${fmtTime(hst.time)} · 팔로워 ${fmt(hst.followers)} · 누적 유대 ${fmt(hst.bond)} · 씨앗 ${hst.seeds}` }));
  }
  return {
    el: root,
    update: () => {
      const st = g.s;
      setText(seedsV, String(st.meta.seeds));
      for (const r of rows) {
        const p = PERKS.find((x) => x.id === r.id)!;
        const own = !!st.meta.perks[r.id];
        setClass(r.cd.el, 'done', own);
        r.btn.el.style.display = own ? 'none' : '';
        setText(r.cd.st, own ? '익힘' : '');
        if (!own) r.btn.set(`씨앗 ${p.cost}로 익히기`, st.meta.seeds >= p.cost);
      }
    },
  };
}

// ── feed (network) ────────────────────────────────────────────────────────
function pips(n: number, col: string, el: HTMLElement): void {
  if (el.childElementCount === n) return;
  clear(el);
  for (let i = 0; i < n; i++) {
    const p = h('i', { class: 'pip' });
    p.style.background = col;
    el.append(p);
  }
}

function buildFeed(c: TabCtx): TabView {
  const g = c.g;
  const s = g.s;
  const root = h('div');
  const updaters: (() => void)[] = [];

  // status
  const info = h('div', { class: 'flows' });
  const kv = (k: string): HTMLSpanElement => {
    const v = h('span');
    info.append(h('span', { class: 'k', text: k }), v);
    return v;
  };
  const vUsers = kv('블룸 유저');
  const vGrow = kv('유입 − 이탈');
  const vCre = kv('크리에이터');
  const vComm = kv('공동체');
  const vPosts = kv('올라오는 글');
  const vTension = kv('갈등 · 버블');
  const st0 = section('블룸', 'bloom', '이제 글을 쓰는 건 블룸의 유저들이에요. 당신의 피드는 누구의 글을 누구에게 보여줄지 정합니다.');
  st0.append(info);
  root.append(st0);
  updaters.push(() => {
    const st = g.s;
    const n = g.d.net;
    setText(vUsers, `${fmt(st.run.followers)} (+${fmt(g.d.fps, true)}/초)`);
    setText(vGrow, `${(n.inflow * 6000).toFixed(2)}% − ${(n.churn * 6000).toFixed(2)}% /분`);
    setText(vCre, `${fmt(st.run.creators)} / 목표 ${fmt(n.ccap)} (유저의 ${(n.share * 100).toFixed(2)}%)`);
    setText(vComm, `${fmt(st.run.communities)} (+${fmt(n.kps, true)}/초)`);
    setText(vPosts, `${fmt(n.pps, true)}/초 · 유대 +${fmt(n.bps, true)}/초`);
    setText(vTension, `${Math.round((1 - n.conflict) * 100)}% · ${Math.round((1 - n.bubble) * 100)}%`);
  });

  // chips
  const chipTitle = h('span');
  const chipSec = section('피드 칩', 'chip', h('p', { class: 'note' }, chipTitle));
  const grid = h('div', { class: 'chips' });
  const aiNote = h('p', { class: 'note' });
  const chipRows: { id: SignalId; cnt: HTMLSpanElement; pipEl: HTMLDivElement; minus: TextBtn; plus: TextBtn }[] = [];
  for (const id of SIGNAL_IDS) {
    const def = SIGNALS[id];
    const cnt = h('span', { class: 'cnt' });
    const pipEl = h('div', { class: 'pips' });
    const minus = new TextBtn('−', () => g.do((st) => setChip(st, id, -1)), 'btn', `${def.name} 칩 빼기`);
    const plus = new TextBtn('+', () => g.do((st) => setChip(st, id, 1)), 'btn', `${def.name} 칩 더하기`);
    const name = h('span', {}, h('b', { text: def.name }), ` ${def.short}`);
    name.style.color = SIGNAL_COL[id][1];
    grid.append(icon(id, 2), h('div', {}, name, pipEl), minus.el, cnt, plus.el, h('span', { class: 'eff', text: `${def.up} · ${def.down}` }));
    chipRows.push({ id, cnt, pipEl, minus, plus });
  }
  chipSec.append(grid, aiNote);
  root.append(chipSec);
  updaters.push(() => {
    const st = g.s;
    const tot = totalChips(st);
    const used = usedChips(st.run);
    const ai = st.run.feedAi !== 'off';
    setText(chipTitle, `사용 ${used} / ${tot} — 칩을 배분해 피드가 무엇을 더 보여줄지 정해요. 한쪽에 몰면 부작용도 커져요.`);
    for (const r of chipRows) {
      const n = st.run.chips[r.id];
      setText(r.cnt, String(n));
      pips(n, SIGNAL_COL[r.id][0], r.pipEl);
      r.minus.set('−', !ai && n > 0);
      r.plus.set('+', !ai && used < tot);
    }
    setText(aiNote, ai ? '피드 AI가 칩을 배분하는 중이에요. 직접 조정하려면 피드 AI를 끄세요.' : '');
  });

  // feed AI
  if (has(s, 'n_feedai')) {
    const modes: { v: string; label: string }[] = [
      { v: 'off', label: '직접' },
      { v: 'balance', label: '목표 자동' },
      ...SIGNAL_IDS.map((id) => ({ v: 'focus:' + id, label: `${SIGNALS[id].name} 집중` })),
    ];
    const sel = selectRow(
      modes,
      () => (g.s.run.feedAi === 'focus' ? 'focus:' + g.s.run.feedFocus : g.s.run.feedAi),
      (v) => {
        if (v.startsWith('focus:')) setFeedAi(g.s, 'focus', v.slice(6) as SignalId);
        else setFeedAi(g.s, v as 'off' | 'balance');
      },
    );
    const aiSec = section('피드 AI', 'gear', "'목표 자동'은 가장 가까운 꽃잎(대개화 중에는 가장 약한 흐름)을 향해 2초마다 칩을 다시 배분해요.");
    aiSec.append(sel.el);
    root.append(aiSec);
    updaters.push(sel.update);
  }

  // petals
  const petSec = section('대개화의 꽃잎', 'bloom', '네 꽃잎이 모두 열리면 대개화가 시작돼요. 각 꽃잎은 서로 다른 흐름에서 자라요.');
  const petRows: { id: (typeof PETAL_IDS)[number]; el: HTMLDivElement; val: HTMLSpanElement; b: ReturnType<typeof bar> }[] = [];
  for (const id of PETAL_IDS) {
    const p = PETALS[id];
    const val = h('span');
    const b = bar();
    b.el.querySelector('i')!.setAttribute('style', `background:${SIGNAL_COL[p.signal][0]}`);
    const el = h('div', { class: 'petal' }, icon(p.signal, 2), h('span', { class: 'nm', text: `${p.name} — ${p.stat} ${fmt(PETAL_AT[id])}` }), val, b.el, h('span', { class: 'note', text: `보상: ${p.reward}, 씨앗 +1` }));
    (el.lastChild as HTMLElement).style.gridColumn = '1 / 4';
    petSec.append(el);
    petRows.push({ id, el, val, b });
  }
  root.append(petSec);
  updaters.push(() => {
    const st = g.s;
    for (const r of petRows) {
      const v = petalValue(st, r.id);
      const open = st.run.petals[r.id];
      setClass(r.el, 'open', open);
      setText(r.val, open ? '열림' : fmt(v));
      const f = open ? 1 : Math.log10(1 + v) / Math.log10(1 + PETAL_AT[r.id]);
      r.b.set(f);
      r.b.el.querySelector('i')!.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
    }
  });

  // festival
  if (s.run.festival) {
    const fsec = section('대개화', 'star', '네 흐름이 모두 목표에 닿아 있는 동안 게이지가 차요. 가장 약한 흐름이 속도를 정해요.');
    const fg = h('div', { class: 'fest' });
    const flows: { k: 'users' | 'bond' | 'posts' | 'comm'; label: string; sig: SignalId }[] = [
      { k: 'users', label: `유저 유입 ${fmt(FESTIVAL_AT.users)}/초`, sig: 'heat' },
      { k: 'bond', label: `유대 ${fmt(FESTIVAL_AT.bond)}/초`, sig: 'depth' },
      { k: 'posts', label: `글 ${fmt(FESTIVAL_AT.posts)}/초`, sig: 'novel' },
      { k: 'comm', label: `공동체 ${fmt(FESTIVAL_AT.comm)}/초`, sig: 'close' },
    ];
    const fr: { k: (typeof flows)[number]['k']; v: HTMLSpanElement; b: ReturnType<typeof bar> }[] = [];
    for (const f of flows) {
      const v = h('span');
      const b = bar();
      b.el.querySelector('i')!.setAttribute('style', `background:${SIGNAL_COL[f.sig][0]}`);
      b.el.style.gridColumn = '1 / 4';
      fg.append(icon(f.sig, 2), h('span', { text: f.label }), v, b.el);
      fr.push({ k: f.k, v, b });
    }
    const gauge = bar('lamp');
    const gv = h('span');
    fsec.append(fg, h('p', { class: 'note' }, '대개화 게이지 ', gv), gauge.el);
    root.append(fsec);
    updaters.push(() => {
      const ratios = festivalRatiosFor(g.d.net);
      for (const r of fr) {
        const x = ratios[r.k];
        setText(r.v, `${Math.round(Math.min(9.99, x) * 100)}%`);
        r.b.el.querySelector('i')!.style.width = `${Math.round(Math.min(1, x) * 100)}%`;
      }
      setText(gv, `${Math.floor(g.s.run.festivalGauge * 100)}%`);
      gauge.set(g.s.run.festivalGauge);
    });
  }

  const ups = upgradeBlock(c, NET_UPGRADES, 5, 'bloom', '블룸 개발', '하트는 이제 블룸을 더 좋은 곳으로 만드는 데 써요.');
  root.append(ups.el);
  updaters.push(ups.update);
  return { el: root, update: () => updaters.forEach((f) => f()) };
}

export const TABS: TabDef[] = [
  { id: 'lines', label: () => '루틴', icon: 'clock', visible: (s) => !!s.meta.flags.tab_lines, key: (s) => LINE_IDS.filter((id) => lineUnlocked(s, id)).join() + '|' + (crewLv(s, 'manager') > 0), build: buildLines },
  {
    id: 'studio',
    label: () => '작업실',
    icon: 'star',
    visible: (s) => !!s.meta.flags.tab_studio,
    key: (s) => upKey(s, STUDIO_UPGRADES, 5) + STUDIO_UPGRADES.filter((u) => u.toggle && s.run.ups[u.id]).length,
    build: buildStudio,
  },
  { id: 'community', label: () => '커뮤니티', icon: 'bond', visible: (s) => !!s.meta.flags.tab_community, key: (s) => upKey(s, COMMUNITY_UPGRADES, 5), build: buildCommunity },
  {
    id: 'crew',
    label: () => '크루',
    icon: 'follower',
    visible: (s) => !!s.meta.flags.tab_crew,
    key: (s) => CREW_IDS.map((id) => `${crewUnlocked(s, id)}${crewLv(s, id)}`).join(),
    build: buildCrew,
  },
  { id: 'collab', label: () => '콜라보', icon: 'community', visible: (s) => !!s.meta.flags.tab_collab, key: (s) => String(collabUnlocked(s)), build: buildCollab },
  {
    id: 'feed',
    label: () => '피드',
    icon: 'chip',
    visible: (s) => s.run.net,
    key: (s) => `${has(s, 'n_feedai')}|${s.run.festival}|` + upKey(s, NET_UPGRADES, 5),
    build: buildFeed,
  },
  {
    id: 'prestige',
    label: (s) => (s.meta.runs === 0 ? '독립' : '노하우'),
    icon: 'seed',
    visible: (s) => !!s.meta.flags.tab_prestige,
    key: (s) => `${s.meta.runs}`,
    build: buildPrestige,
  },
];

export function platformNote(s: GameState): string {
  return `도달 한계: 팔로워 ${fmt(platformK(s))}명 근처부터 성장이 느려져요`;
}

export { ms };
