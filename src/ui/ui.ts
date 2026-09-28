// HUD, stage overlays, side panel, modals, toasts and the ending sequence.
import type { Game } from '../game';
import type { GameEvent, OfflineSummary } from '../econ/engine';
import { chooseStory, doPrestige, joinTrend } from '../econ/engine';
import { pendingEpisode, narrativeEffects } from '../econ/narrative';
import { ECHO_EPISODES, ECHO_ROUTES, echoRoute } from '../content/echo';
import { MILESTONES, PETALS, SIGNAL_IDS } from '../econ/defs';
import { crewLv, has, ms, seedGain, trueFans } from '../econ/calc';
import { nextGoal, hint } from '../econ/goals';
import { MESSAGES, type Message } from '../content/story';
import { endingData } from '../content/ending';
import { encodeExport, decodeImport } from '../econ/save';
import { audio } from '../audio/audio';
import { fmt, fmtClock, fmtExact, fmtTime, setNumberStyle, type NumberStyle } from '../util/format';
import { PAL } from '../render/pix';
import { SIGNAL_COL } from '../render/city';
import { clear, h, setClass, setText } from './dom';
import { frameURL, icon } from './icons';
import { TABS, type TabCtx, type TabId, type TabView } from './tabs';
import { bar, selectRow, TextBtn, toggle } from './widgets';

const BIG_MOMENTS: Record<string, [string, string, string]> = {
  ms_m1000: ['천 명의 관객', '옆방이 작업실이 되었습니다 · 크루를 고용할 수 있어요', PAL.lamp],
  ms_m10000: ['인증 배지', '모든 하트 ×2 · 팔로워 유입 ×1.5', PAL.teal],
  ms_m30000: ['찐팬의 제안', '독립 탭이 열렸어요', PAL.pink],
  network: ['블룸이 깨어났다', '유저들이 직접 글을 쓰기 시작했어요 · 피드 탭', PAL.lamp],
  festival: ['대개화 준비', '네 흐름을 동시에 목표까지', PAL.lamp],
};

interface Toast {
  el: HTMLDivElement;
  until: number;
}

export class UI {
  g: Game;
  private hud!: {
    hearts: HTMLSpanElement;
    heartsR: HTMLSpanElement;
    fol: HTMLSpanElement;
    folR: HTMLSpanElement;
    folLabel: HTMLSpanElement;
    bond: HTMLSpanElement;
    bondR: HTMLSpanElement;
    bondBox: HTMLDivElement;
    seeds: HTMLSpanElement;
    seedBox: HTMLDivElement;
    cre: HTMLSpanElement;
    creBox: HTMLDivElement;
    heartBox: HTMLDivElement;
    folBox: HTMLDivElement;
    logDot: HTMLSpanElement;
    mute: HTMLButtonElement;
  };
  private goal!: { el: HTMLDivElement; text: HTMLSpanElement; bar: ReturnType<typeof bar>; tab?: string; last: string };
  private hintEl!: HTMLDivElement;
  private trend!: { el: HTMLDivElement; tag: HTMLDivElement; eff: HTMLDivElement; bar: ReturnType<typeof bar>; btn: TextBtn; note: HTMLDivElement };
  private postBtn!: HTMLButtonElement;
  private postLabel!: HTMLSpanElement;
  private postSub!: HTMLSpanElement;
  private viewToggle!: { el: HTMLDivElement; room: TextBtn; city: TextBtn };
  private toastBox!: HTMLDivElement;
  private toasts: Toast[] = [];
  private tabsEl!: HTMLDivElement;
  private tabBody!: HTMLDivElement;
  private tabBtns = new Map<TabId, { el: HTMLButtonElement; label: HTMLSpanElement; dot: HTMLSpanElement }>();
  private activeTab: TabId | null = null;
  private tabView: TabView | null = null;
  private tabKey = '';
  private seenTabs = new Set<string>();
  private modal!: { el: HTMLDivElement; box: HTMLDivElement };
  private modalOpen = false;
  private ending!: { el: HTMLDivElement; scroll: HTMLDivElement };
  private endingStart = -1;
  private endingTimers: number[] = [];
  private uiAcc = 0;
  private welcome: HTMLDivElement | null = null;
  private tctx: TabCtx;
  private unreadLog = false;
  private storyBtn!: HTMLButtonElement;
  private storyLabel!: HTMLSpanElement;
  private storySub!: HTMLSpanElement;
  private lastFocus: HTMLElement | null = null;

  constructor(g: Game, root: HTMLElement) {
    this.g = g;
    this.tctx = { g, confirmPrestige: () => this.confirmPrestige(), goTab: (id) => this.openTab(id) };
    this.applyFrames();
    this.build(root);
    g.ui = { onEvent: (e) => this.onEvent(e), onOffline: (s) => this.showOffline(s) };
    for (const t of TABS) if (t.visible(g.s)) this.seenTabs.add(t.id);
    this.applySettings();
  }

  private applyFrames(): void {
    const r = document.documentElement.style;
    const set = (k: string, url: string): void => r.setProperty(k, `url(${url})`);
    set('--frame-panel', frameURL('#1d1a3a', PAL.ink, '#3a3872', '#15122a'));
    set('--frame-card', frameURL('#231f45', PAL.ink, '#34326a', '#1a1733'));
    set('--frame-btn', frameURL('#353a72', PAL.ink, '#4a57a0', '#262550'));
    set('--frame-btn-hot', frameURL('#4a57a0', PAL.ink, '#6b86c9', '#353a72'));
    set('--frame-btn-off', frameURL('#1f1c3a', '#2c2950', '#25224a', '#1a1733'));
    set('--frame-btn-pink', frameURL(PAL.pink, PAL.ink, PAL.pinkL, PAL.magenta));
    set('--frame-tab', frameURL('#262550', PAL.ink, '#353a72', '#1d1a3a'));
    set('--frame-tab-on', frameURL(PAL.lamp, PAL.ink, '#fff0b0', PAL.lampD));
  }

  // ── construction ──────────────────────────────────────────────────────
  private build(root: HTMLElement): void {
    const g = this.g;
    const resBox = (ico: string, title: string): { box: HTMLDivElement; v: HTMLSpanElement; r: HTMLSpanElement; label: HTMLSpanElement } => {
      const v = h('span', { class: 'v' });
      const r = h('span', { class: 'r' });
      const label = h('span', { class: 'r' });
      const box = h('div', { class: 'res', title }, icon(ico, 2), label, v, r);
      return { box, v, r, label };
    };
    const heart = resBox('heart', '하트: 업그레이드와 루틴을 사는 데 써요');
    const fol = resBox('follower', '팔로워');
    const bond = resBox('bond', '유대: 답글로 쌓여요. 누적 유대가 관객 수용력을 키워요');
    const seed = resBox('seed', '씨앗: 노하우를 익히는 데 써요');
    const cre = resBox('creator', '크리에이터 · 공동체');
    const logDot = h('span', { class: 'dot' });
    logDot.style.display = 'none';
    const mute = h('button', { class: 'hbtn', type: 'button', title: '소리 켜기/끄기', 'aria-label': '소리 켜기/끄기', onclick: () => this.toggleMute() }, icon('sound', 2));
    const hudEl = h(
      'header',
      { id: 'hud' },
      h('div', { class: 'title', text: 'METRIC BLOOM' }),
      heart.box,
      fol.box,
      bond.box,
      seed.box,
      cre.box,
      h('div', { class: 'spacer' }),
      h('button', { class: 'hbtn', type: 'button', title: '메시지', 'aria-label': '메시지', onclick: () => this.showLog() }, icon('bell', 2), logDot),
      h('button', { class: 'hbtn', type: 'button', title: '기록', 'aria-label': '기록', onclick: () => this.showStats() }, icon('star', 2)),
      mute,
      h('button', { class: 'hbtn', type: 'button', title: '설정', 'aria-label': '설정', onclick: () => this.showSettings() }, icon('gear', 2)),
    );
    this.hud = {
      hearts: heart.v,
      heartsR: heart.r,
      heartBox: heart.box,
      fol: fol.v,
      folR: fol.r,
      folLabel: fol.label,
      folBox: fol.box,
      bond: bond.v,
      bondR: bond.r,
      bondBox: bond.box,
      seeds: seed.v,
      seedBox: seed.box,
      cre: cre.v,
      creBox: cre.box,
      logDot,
      mute,
    };

    // stage
    const canvas = g.view.canvas;
    canvas.setAttribute('aria-label', '게임 화면: 클릭해서 게시하고, 말풍선을 눌러 답글을 달아요');
    canvas.setAttribute('role', 'img');
    const gText = h('span');
    const gBar = bar('lamp');
    const goalEl = h('div', { id: 'goal', role: 'status' }, h('div', { class: 'gt' }, h('span', { class: 'gl', text: '다음 목표' }), gText), gBar.el);
    goalEl.addEventListener('click', () => {
      if (this.goal.tab) this.openTab(this.goal.tab as TabId);
    });
    this.goal = { el: goalEl, text: gText, bar: gBar, last: '' };
    this.hintEl = h('div', { id: 'hintline' });

    const tTag = h('div', { class: 'tag' });
    const tEff = h('div', { class: 'eff' });
    const tNote = h('div', { class: 'eff' });
    const tBar = bar('lamp');
    const tBtn = new TextBtn('참여하기 [J]', () => this.joinTrend(), 'btn pink');
    const trendEl = h('div', { id: 'trend' }, tTag, tEff, tBar.el, h('div', { class: 'btns' }, tBtn.el), tNote);
    this.trend = { el: trendEl, tag: tTag, eff: tEff, bar: tBar, btn: tBtn, note: tNote };

    this.postLabel = h('span', { text: '게시하기' });
    this.postSub = h('span', { class: 'k' });
    this.postBtn = h('button', { id: 'postbtn', type: 'button', 'aria-label': '게시하기 (스페이스바)', onclick: () => this.doPost() }, icon('heart', 2), this.postLabel, this.postSub);

    const vRoom = new TextBtn('내 방', () => {
      g.view.userMode = 'room';
    });
    const vCity = new TextBtn('도시', () => {
      g.view.userMode = 'city';
    });
    const vt = h('div', { id: 'viewtoggle' }, vRoom.el, vCity.el);
    this.viewToggle = { el: vt, room: vRoom, city: vCity };
    this.toastBox = h('div', { id: 'toasts', 'aria-live': 'polite' });

    const overlay = h('div', { id: 'overlay' },
      h('div', { class: 'stage-top' }, goalEl, vt), this.hintEl,
      h('div', { class: 'stage-bottom' }, trendEl, this.postBtn), this.toastBox);
    const stage = h('section', { id: 'stage' }, canvas, overlay);

    // panel
    this.tabsEl = h('div', { id: 'tabs', role: 'tablist', 'aria-label': '운영 메뉴' });
    const scrollTabs = (dir: number): void => this.tabsEl.scrollBy({ left: dir * 200, behavior: this.g.view.reducedMotion ? 'instant' : 'smooth' });
    const tabStrip = h('div', { class: 'tab-strip' },
      h('button', { class: 'tab-scroll', type: 'button', 'aria-label': '이전 메뉴 보기', onclick: () => scrollTabs(-1) }, '‹'),
      this.tabsEl,
      h('button', { class: 'tab-scroll', type: 'button', 'aria-label': '다음 메뉴 보기', onclick: () => scrollTabs(1) }, '›'));
    this.tabsEl.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const visible = TABS.filter((t) => t.visible(g.s));
      const current = visible.findIndex((t) => t.id === this.activeTab);
      const index = e.key === 'Home' ? 0 : e.key === 'End' ? visible.length - 1 : (current + (e.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length;
      if (visible[index]) {
        this.openTab(visible[index].id);
        this.tabBtns.get(visible[index].id)!.el.focus({ preventScroll: true });
      }
    });
    this.tabBody = h('div', { id: 'tabbody', role: 'tabpanel' });
    this.storyLabel = h('span', { class: 'story-title' });
    this.storySub = h('span', { class: 'story-sub' });
    this.storyBtn = h('button', { id: 'story-inbox', type: 'button', onclick: () => this.showStory() },
      h('span', { class: 'story-signal', text: '✦' }),
      h('span', { class: 'story-copy' }, this.storyLabel, this.storySub),
      h('span', { class: 'story-arrow', text: '↗' }));
    this.storyBtn.hidden = true;
    const panel = h('aside', { id: 'panel' }, this.storyBtn, tabStrip, this.tabBody);
    for (const t of TABS) {
      const label = h('span');
      const dot = h('span', { class: 'dot' });
      dot.style.display = 'none';
      const el = h('button', { class: 'tab', type: 'button', role: 'tab', onclick: () => this.openTab(t.id) }, icon(t.icon, 2), label, dot);
      el.style.display = 'none';
      this.tabsEl.append(el);
      this.tabBtns.set(t.id, { el, label, dot });
    }

    const main = h('main', { id: 'main' }, stage, panel);
    // modal + ending
    const box = h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true' });
    const modalEl = h('div', { id: 'modal' }, box);
    modalEl.addEventListener('pointerdown', (e) => {
      if (e.target === modalEl) this.closeModal();
    });
    this.modal = { el: modalEl, box };
    const scroll = h('div', { class: 'scroll' });
    const endEl = h('div', { id: 'ending' }, h('div', { class: 'veil' }), scroll);
    this.ending = { el: endEl, scroll };

    const app = h('div', { id: 'app' }, hudEl, main);
    root.append(app, modalEl, endEl);

    // stage input
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.modalOpen || this.ending.el.classList.contains('on')) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = g.view.bubbleAt(x, y);
      if (id >= 0) {
        g.reply(id);
      } else {
        this.doPost();
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      g.view.hoverBubble = g.view.bubbleAt(e.clientX - rect.left, e.clientY - rect.top);
    });
    canvas.addEventListener('pointerleave', () => {
      g.view.hoverBubble = -1;
    });
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (this.modalOpen && e.key === 'Tab') {
        const focusable = [...this.modal.box.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, [tabindex="0"]')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === this.modal.box)) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        return;
      }
      if (e.key === 'Escape' && this.modalOpen) {
        this.closeModal();
        return;
      }
      if (this.modalOpen || this.ending.el.classList.contains('on')) return;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (tag === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.doPost();
      } else if (e.code === 'KeyJ') {
        this.joinTrend();
      } else if (e.code === 'KeyR') {
        const c = [...g.s.run.comments].sort((a, b) => a.ttl - b.ttl)[0];
        if (c) g.reply(c.id);
      }
    });

    const ro = new ResizeObserver(() => this.layout(stage));
    ro.observe(stage);
    this.layout(stage);
  }

  private layout(stage: HTMLElement): void {
    const top = stage.querySelector('.stage-top')?.getBoundingClientRect().height ?? 0;
    const bottom = stage.querySelector('.stage-bottom')?.getBoundingClientRect().height ?? 0;
    this.g.view.resize(stage.clientWidth - 16, Math.max(60, stage.clientHeight - top - bottom - 24));
    stage.style.paddingTop = `${top + 8}px`;
    stage.style.paddingBottom = `${bottom + 8}px`;
  }

  // ── actions ───────────────────────────────────────────────────────────
  private doPost(): void {
    if (this.g.post()) {
      this.postBtn.classList.add('press');
      window.setTimeout(() => this.postBtn.classList.remove('press'), 80);
    }
  }

  private joinTrend(): void {
    this.g.do((s, out) => joinTrend(s, false, out));
  }

  openTab(id: TabId): void {
    const def = TABS.find((t) => t.id === id);
    if (!def || !def.visible(this.g.s)) return;
    this.activeTab = id;
    this.tabKey = '';
    const b = this.tabBtns.get(id);
    if (b) b.dot.style.display = 'none';
    b?.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.seenTabs.add(id);
    this.tabBody.scrollTop = 0;
    this.renderTab();
    audio.play('click');
  }

  private renderTab(): void {
    const def = TABS.find((t) => t.id === this.activeTab);
    if (!def) return;
    const key = def.key(this.g.s);
    if (key !== this.tabKey || !this.tabView) {
      const scroll = this.tabBody.scrollTop;
      this.tabKey = key;
      this.tabView = def.build(this.tctx);
      clear(this.tabBody);
      this.tabBody.append(this.tabView.el);
      this.tabBody.scrollTop = scroll;
    }
    this.tabView.update();
    for (const [id, b] of this.tabBtns) {
      const active = id === this.activeTab;
      setClass(b.el, 'on', active);
      b.el.setAttribute('aria-selected', String(active));
      b.el.tabIndex = active ? 0 : -1;
    }
  }

  // ── events ────────────────────────────────────────────────────────────
  onEvent(e: GameEvent): void {
    const g = this.g;
    const net = g.s.run.net;
    switch (e.t) {
      case 'post':
        audio.play(net ? 'spot' : 'post');
        break;
      case 'reply':
        if (e.manual) audio.play('reply');
        break;
      case 'comment':
        audio.play('comment');
        break;
      case 'buy':
        if (e.kind === 'line') {
          if (!e.auto) audio.play('buy');
        } else audio.play('upgrade');
        break;
      case 'milestone': {
        audio.play('milestone');
        const m = MILESTONES.find((x) => x.id === e.id);
        if (m) this.toast({ from: `팔로워 ${fmt(m.at)}명 · ${m.name}`, text: m.reward, kind: 'sys' }, 'ms');
        pulse(this.hud.folBox);
        break;
      }
      case 'unlock': {
        const msgs = MESSAGES[e.id];
        if (msgs) {
          for (const m of msgs) this.toast(m);
          this.unreadLog = true;
        }
        const big = BIG_MOMENTS[e.id];
        if (big) {
          g.view.bigMoment(big[0], big[1], big[2]);
          audio.play('unlock');
        } else if (e.id.startsWith('tab_') || e.id.startsWith('line_')) audio.play('unlock');
        if (e.id === 'network') {
          g.view.startNetworkTransition();
          audio.play('prestige');
        }
        if (e.id.startsWith('petal_')) {
          const pid = e.id.slice(6) as keyof typeof PETALS;
          const p = PETALS[pid];
          if (p) g.view.bigMoment(p.name, `${p.reward} · 씨앗 +1`, SIGNAL_COL[p.signal][0]);
        }
        break;
      }
      case 'trendStart':
        audio.play('trend');
        break;
      case 'trendJoin':
        audio.play('join');
        break;
      case 'viral':
        audio.play('viral');
        pulse(this.hud.folBox);
        break;
      case 'prestige':
        audio.play('prestige');
        g.view.bigMoment('독립', `찐팬 ${fmt(e.fans)}명과 함께 · 씨앗 +${e.seeds}`, PAL.pink, 4);
        this.openTab('prestige');
        break;
      case 'petal':
        audio.play('petal');
        break;
      case 'festival':
        audio.play('milestone');
        break;
      case 'ending':
        this.startEnding();
        break;
      case 'story': {
        const episode = pendingEpisode(g.s);
        if (episode) {
          this.unreadLog = true;
          audio.play('echo');
          this.toast({ from: episode.sender, text: `${episode.preview} · 사건 메시지를 열어 보세요.`, kind: 'dm' });
          g.save();
        }
        break;
      }
      case 'storyChoice': {
        const choice = ECHO_EPISODES.find((ep) => ep.id === e.id)?.choices.find((c) => c.id === e.choice);
        if (choice) {
          audio.play('resolve');
          g.view.bigMoment(choice.route ? ECHO_ROUTES[choice.route].name : '답장을 보냈다', choice.effect, PAL.teal, 3);
          this.toast({ from: '기록에 남긴 선택', text: e.reward, kind: 'sys' });
        }
        break;
      }
      default:
        break;
    }
  }

  private toast(m: Message, extra = ''): void {
    const el = h('div', { class: `toast ${m.kind} ${extra}` }, h('div', { class: 'from', text: m.from }), h('div', { class: 'msg', text: m.text }));
    el.addEventListener('click', () => this.dismissToast(el));
    this.toastBox.append(el);
    const dur = 5000 + m.text.length * 70;
    this.toasts.push({ el, until: performance.now() + dur });
    while (this.toasts.length > (matchMedia('(max-width: 820px)').matches ? 1 : 2)) {
      const t = this.toasts.shift()!;
      t.el.remove();
    }
  }

  private dismissToast(el: HTMLElement): void {
    el.classList.add('out');
    window.setTimeout(() => el.remove(), 400);
    this.toasts = this.toasts.filter((t) => t.el !== el);
  }

  // ── per-frame UI update (throttled) ───────────────────────────────────
  frame(dt: number): void {
    // ending animation drives the stage
    if (this.endingStart >= 0) {
      const t = (performance.now() - this.endingStart) / 1000;
      this.g.view.endingT = Math.min(1, t / 6);
    } else if (this.g.s.meta.ended) {
      this.g.view.endingT = 1;
    }
    this.uiAcc += dt;
    if (this.uiAcc < 0.12) return;
    this.uiAcc = 0;
    this.update();
  }

  private update(): void {
    const g = this.g;
    const s = g.s;
    const r = s.run;
    const d = g.d;
    const episode = pendingEpisode(s);
    const route = echoRoute(s.meta.narrative.choices);
    this.storyBtn.hidden = !episode && s.meta.narrative.choices.length === 0;
    setClass(this.storyBtn, 'pending', !!episode);
    setText(this.storyLabel, episode ? episode.title : route ? ECHO_ROUTES[route].name : '나와 에코의 기록');
    setText(this.storySub, episode ? `${episode.preview} · 열기` : route ? ECHO_ROUTES[route].effect : '답장은 기록에 남아 있어요 · 다시 읽기');
    document.getElementById('stage')!.classList.toggle('echo-pending', !!episode);
    const now = performance.now();
    for (const t of [...this.toasts]) if (now > t.until) this.dismissToast(t.el);

    // HUD
    setText(this.hud.hearts, fmt(r.hearts));
    this.hud.heartBox.title = `하트 ${fmtExact(r.hearts)}`;
    setText(this.hud.heartsR, `+${fmt(d.hps, true)}/초`);
    setText(this.hud.folLabel, r.net ? '유저' : '');
    setText(this.hud.fol, fmt(r.followers));
    setText(this.hud.folR, `+${fmt(d.fps, true)}/초`);
    this.hud.folBox.title = `${r.net ? '블룸 유저' : '팔로워'} ${fmtExact(r.followers)}`;
    const showBond = !!s.meta.flags.tab_community;
    this.hud.bondBox.style.display = showBond ? '' : 'none';
    if (showBond) {
      setText(this.hud.bond, fmt(r.bond, r.bond < 100));
      setText(this.hud.bondR, `누적 ${fmt(r.bondEarned)}`);
    }
    this.hud.seedBox.style.display = s.meta.runs > 0 ? '' : 'none';
    setText(this.hud.seeds, String(s.meta.seeds));
    this.hud.creBox.style.display = r.net ? '' : 'none';
    if (r.net) {
      const compact = matchMedia('(max-width: 820px)').matches;
      setText(this.hud.cre, `${fmt(r.creators)} · ${compact ? '' : '공동체 '}${fmt(r.communities)}`);
      this.hud.creBox.title = `크리에이터 ${fmt(r.creators)} · 공동체 ${fmt(r.communities)}`;
    }
    this.hud.logDot.style.display = this.unreadLog || episode ? '' : 'none';

    // goal
    const goal = nextGoal(s);
    if (goal.text !== this.goal.last) {
      this.goal.last = goal.text;
      setText(this.goal.text, goal.text);
      this.goal.el.classList.remove('flash');
      void this.goal.el.offsetWidth;
      this.goal.el.classList.add('flash');
    }
    this.goal.bar.set(goal.progress);
    this.goal.tab = goal.tab;
    this.goal.el.style.cursor = goal.tab ? 'pointer' : 'default';
    setText(this.hintEl, hint(s) ?? '');

    // trend
    const tr = r.trend;
    const trendVisible = ms(s, 'm300') && (tr.phase === 'active' || has(s, 'analytics'));
    setClass(this.trend.el, 'on', trendVisible);
    if (trendVisible) {
      if (tr.phase === 'active') {
        setText(this.trend.tag, `${tr.tag} 지금 뜨는 중!`);
        setText(this.trend.eff, `${Math.ceil(tr.timer)}초 · 팔로워 유입 ×${tr.mult} · 하트 ×1.5${has(s, 'rules') ? '' : ' · 스쳐 가는 댓글은 유대가 얕아요'}`);
        this.trend.bar.set(tr.timer / 30);
        this.trend.btn.el.style.display = '';
        this.trend.btn.set(tr.joined ? '참여 중' : '참여하기 [J]', !tr.joined);
        setClass(this.trend.el, 'joined', tr.joined);
      } else {
        setText(this.trend.tag, `다음 트렌드 ${tr.nextTag}`);
        setText(this.trend.eff, `${Math.ceil(tr.timer)}초 뒤 · 예상 배율 ×${tr.nextMult + (has(s, 'analytics') ? 2 : 0) + (s.meta.perks.p_trend ? 2 : 0) + (r.collabs.pickle ? 3 : 0)}`);
        this.trend.bar.set(0);
        this.trend.btn.el.style.display = 'none';
        setClass(this.trend.el, 'joined', false);
      }
      const dy = crewLv(s, 'doyun') > 0;
      setText(this.trend.note, dy ? (r.trendRule === 0 ? '도윤: 쉬는 중' : r.trendRule === 1 ? '도윤: 모든 트렌드에 참여' : `도윤: ×${r.trendRule} 이상이면 참여`) : '');
    }

    // post button
    if (r.net) {
      setText(this.postLabel, '스포트라이트');
      setText(this.postSub, `♥+${fmt(d.manualHearts + d.net.hps * 0.1 * (has(s, 'n_spot') ? 3 : 1) * narrativeEffects(s).manual)} [Space]`);
    } else {
      setText(this.postLabel, '게시하기');
      setText(this.postSub, `♥+${fmt(d.manualHearts, true)} [Space]`);
    }
    this.postBtn.title = r.net ? '내 글을 올리고, 블룸의 크리에이터 한 명을 오늘의 발견에 올려요' : '글을 올려 하트와 팔로워를 모아요';

    // view toggle
    setClass(this.viewToggle.el, 'on', r.net);
    if (r.net) {
      const city = g.view.mode === 'city';
      this.viewToggle.room.set('내 방', true, !city);
      this.viewToggle.city.set('도시', true, city);
    }

    // tabs
    let anyVisible = false;
    for (const t of TABS) {
      const b = this.tabBtns.get(t.id)!;
      const vis = t.visible(s);
      b.el.style.display = vis ? '' : 'none';
      if (!vis) continue;
      anyVisible = true;
      setText(b.label, t.label(s));
      if (!this.seenTabs.has(t.id)) {
        this.seenTabs.add(t.id);
        b.dot.style.display = '';
        b.el.classList.add('newtab');
        if (!this.activeTab) this.openTab(t.id);
      }
    }
    if (anyVisible && !this.activeTab) {
      const pref: TabId[] = r.net ? ['feed', 'lines'] : ['lines', 'studio'];
      const first = pref.find((id) => TABS.find((t) => t.id === id)?.visible(s)) ?? TABS.find((t) => t.visible(s))?.id;
      if (first) this.openTab(first);
    }
    if (!anyVisible) {
      if (!this.welcome) {
        this.welcome = h(
          'div',
          { class: 'sec' },
          h('h3', {}, icon('bloom', 2), '블룸라인에 오신 걸 환영해요'),
          h('p', { class: 'note', text: '오늘 처음 계정을 만들었어요. 방 안의 휴대폰을 누르거나, 아래 게시하기 버튼(스페이스바)으로 첫 글을 올려 보세요.' }),
        );
        clear(this.tabBody);
        this.tabBody.append(this.welcome);
      }
    } else if (this.welcome) {
      this.welcome = null;
    }
    if (this.activeTab) this.renderTab();

    // music intensity follows progress
    let lvl = 0;
    if (r.lines.text > 0 || s.meta.runs > 0) lvl = 1;
    if (ms(s, 'm100') || s.meta.runs > 0) lvl = 2;
    if (ms(s, 'm1000')) lvl = 3;
    if (r.net) lvl = 4;
    if (r.festival) lvl = 5;
    audio.setIntensity(lvl);
    this.layout(document.getElementById('stage')!);
  }

  // ── modals ────────────────────────────────────────────────────────────
  private openModal(title: string, body: (Node | string)[], actions: HTMLElement[] = []): void {
    if (!this.modalOpen) this.lastFocus = document.activeElement as HTMLElement | null;
    clear(this.modal.box);
    const close = new TextBtn('닫기', () => this.closeModal());
    this.modal.box.classList.remove('story-dialog');
    this.modal.box.setAttribute('aria-labelledby', 'modal-title');
    this.modal.box.append(h('h2', { id: 'modal-title', text: title }), ...body, h('div', { class: 'actions' }, ...actions, close.el));
    this.modal.el.classList.add('on');
    this.modalOpen = true;
    this.g.paused = true;
    document.getElementById('app')!.inert = true;
    this.modal.box.tabIndex = -1;
    this.modal.box.focus({ preventScroll: true });
    this.modal.box.scrollTop = 0;
  }

  closeModal(): void {
    this.modal.el.classList.remove('on');
    this.modalOpen = false;
    this.g.paused = false;
    this.g.syncClock();
    document.getElementById('app')!.inert = false;
    this.lastFocus?.focus({ preventScroll: true });
  }

  private storyHistory(): HTMLElement[] {
    return this.g.s.meta.narrative.choices.map((id, i) => {
      const episode = ECHO_EPISODES[i];
      const choice = episode.choices.find((c) => c.id === id)!;
      return h('article', { class: 'story-record' }, h('h3', { text: episode.title }),
        ...episode.lines.map((text) => h('p', { text })),
        h('p', { class: 'story-decision', text: `나의 선택 · ${choice.label}` }),
        h('p', { text: choice.response }));
    });
  }

  showStory(): void {
    const episode = pendingEpisode(this.g.s);
    if (!episode) {
      this.openModal('나와 에코의 기록', this.storyHistory());
      return;
    }
    const choices = episode.choices.map((choice) => h('button', {
      class: 'story-choice', type: 'button', 'data-choice': choice.id,
      onclick: () => {
        const changed = this.g.do((s, out) => chooseStory(s, episode.id, choice.id, out));
        if (!changed) return;
        this.g.save();
        this.openModal('전송 완료', [h('p', { class: 'story-response', text: choice.response }),
          h('p', { class: 'story-effect', text: choice.effect }),
          h('p', { class: 'note', text: '이 대화는 메시지 기록에서 다시 읽을 수 있어요.' })]);
        this.modal.box.classList.add('story-dialog');
      },
    }, h('strong', { text: choice.label }), h('span', { text: choice.effect })));
    this.openModal(episode.title, [
      h('div', { class: 'story-meta', text: `${episode.sender} → 나 / 비공개 대화` }),
      h('div', { class: 'story-transcript' }, ...episode.lines.map((text, i) => h('p', { class: i === 0 ? 'quoted-post' : '', text }))),
      h('p', { class: 'story-note', text: '대화 중에는 시간이 멈춰요. 닫아도 선택은 기다립니다.' }),
      h('div', { class: 'story-choices' }, ...choices),
    ]);
    this.modal.box.classList.add('story-dialog');
  }

  confirmPrestige(): void {
    const g = this.g;
    const s = g.s;
    const gain = seedGain(s);
    const fans = trueFans(s);
    const go = new TextBtn(`떠나기 (씨앗 +${gain})`, () => {
      this.closeModal();
      g.do((st, out) => doPrestige(st, out));
      g.save();
    }, 'btn pink');
    this.openModal(
      '블룸라인을 떠날까요?',
      [
        h('p', { text: `찐팬 ${fmt(fans)}명이 새 네트워크 "블룸"으로 함께 떠나요. 씨앗 ${gain}개를 얻고, 노하우를 익힐 수 있어요.` }),
        h('p', { text: '하트, 루틴, 업그레이드, 크루, 콜라보, 마일스톤은 처음부터 다시 시작해요. 한 번뿐인 결정이에요.' }),
        h('p', { class: 'note', text: '씨앗이 많을수록 블룸에서 더 빨리 자라요. 조금 더 모았다가 떠나도 괜찮아요.' }),
      ],
      [go.el],
    );
  }

  showOffline(sum: OfflineSummary): void {
    const capped = sum.seconds > sum.simulated;
    this.openModal('다녀오셨어요?', [
      h('p', { text: `자리를 비운 ${fmtTime(sum.seconds)} 동안 루틴과 크루가 절반의 속도로 일했어요.${capped ? ` (최대 ${this.g.offlineCapMinutes()}분까지 계산해요)` : ''}` }),
      h(
        'div',
        { class: 'stats' },
        h('span', { class: 'k', text: '하트' }),
        h('span', { text: `+${fmt(sum.hearts)}` }),
        h('span', { class: 'k', text: this.g.s.run.net ? '유저' : '팔로워' }),
        h('span', { text: `+${fmt(sum.followers)}` }),
        h('span', { class: 'k', text: '유대' }),
        h('span', { text: `+${fmt(sum.bond)}` }),
        ...(sum.creators > 0 ? [h('span', { class: 'k', text: '크리에이터' }), h('span', { text: `+${fmt(sum.creators)}` })] : []),
      ),
    ]);
  }

  showLog(): void {
    this.unreadLog = false;
    const items: HTMLElement[] = [];
    for (const id of Object.keys(this.g.s.meta.flags)) {
      const msgs = MESSAGES[id];
      if (!msgs) continue;
      for (const m of msgs) items.push(h('div', {}, h('span', { class: 'from', text: m.from + ' ' }), m.text));
    }
    items.reverse();
    const pending = pendingEpisode(this.g.s);
    this.openModal('메시지', [
      ...(pending ? [new TextBtn(`미확인 사건 · ${pending.title}`, () => this.showStory(), 'btn pink').el] : []),
      ...this.storyHistory().reverse(),
      h('div', { class: 'log' }, ...(items.length ? items : [h('p', { class: 'note', text: '아직 메시지가 없어요.' })])),
    ]);
  }

  showStats(): void {
    const s = this.g.s;
    const m = s.meta;
    const rows: [string, string][] = [
      ['플레이 시간', fmtTime(m.totalTime)],
      ['이번 여정', m.runs === 0 ? '블룸라인' : '블룸'],
      ['받은 하트', fmt(m.totalHearts)],
      ['모든 게시물', fmt(m.totalPosts)],
      ['직접 올린 글', fmt(m.totalManualPosts)],
      ['답글 (직접 / 전체)', `${fmt(m.manualReplies)} / ${fmt(m.totalReplies)}`],
      ['참여한 트렌드', `${m.trendsJoined} / ${m.trendsSeen}`],
      ['크게 퍼진 게시물', String(m.virals)],
      ['최고 팔로워', fmt(m.peakFollowers)],
      ['씨앗 (모은 것)', String(m.seedsTotal)],
    ];
    if (m.ended) rows.push(['대개화까지', fmtTime(m.endTime)]);
    const grid = h('div', { class: 'stats' }, ...rows.flatMap(([k, v]) => [h('span', { class: 'k', text: k }), h('span', { text: v })]));
    const acts: HTMLElement[] = [];
    if (m.ended) acts.push(new TextBtn('엔딩 다시 보기', () => {
      this.closeModal();
      this.startEnding(true);
    }).el);
    this.openModal('기록', [grid], acts);
  }

  private toggleMute(): void {
    const st = this.g.settings;
    audio.unlock();
    if (st.music > 0 || st.sfx > 0) {
      (st as Settings & { _m?: number; _s?: number })._m = st.music;
      (st as Settings & { _m?: number; _s?: number })._s = st.sfx;
      st.music = 0;
      st.sfx = 0;
    } else {
      const ex = st as Settings & { _m?: number; _s?: number };
      st.music = ex._m ?? 0.5;
      st.sfx = ex._s ?? 0.7;
    }
    audio.setVolumes(st.music, st.sfx);
    this.hud.mute.style.opacity = st.music + st.sfx > 0 ? '1' : '0.4';
    this.g.saveSettings();
  }

  applySettings(): void {
    const st = this.g.settings;
    document.body.classList.toggle('big', st.big);
    document.body.classList.toggle('reduced', st.reduced);
    setNumberStyle(st.num);
    audio.setVolumes(st.music, st.sfx);
    this.g.view.reducedMotion = st.reduced || matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.hud.mute.style.opacity = st.music + st.sfx > 0 ? '1' : '0.4';
  }

  showSettings(): void {
    const g = this.g;
    const st = g.settings;
    const slider = (label: string, get: () => number, set: (v: number) => void): HTMLElement => {
      const inp = h('input', { type: 'range', min: '0', max: '100', 'aria-label': label }) as HTMLInputElement;
      inp.value = String(Math.round(get() * 100));
      const out = h('span', { text: `${inp.value}%` });
      inp.addEventListener('input', () => {
        set(Number(inp.value) / 100);
        setText(out, `${inp.value}%`);
        audio.unlock();
        audio.setVolumes(st.music, st.sfx);
        g.saveSettings();
      });
      inp.addEventListener('change', () => audio.play('click'));
      return h('div', { class: 'row' }, h('span', { text: label }), inp, out);
    };
    const nums = selectRow<NumberStyle>(
      [
        { v: 'ko', label: '1.2만 · 3.4억' },
        { v: 'intl', label: '12K · 340M' },
        { v: 'sci', label: '3.4e8' },
      ],
      () => st.num,
      (v) => {
        st.num = v;
        this.applySettings();
        g.saveSettings();
        nums.update();
        this.tabKey = '';
      },
    );
    nums.update();
    const big = toggle('큰 글씨', st.big, (v) => {
      st.big = v;
      this.applySettings();
      g.saveSettings();
    });
    const red = toggle('화면 효과 줄이기', st.reduced, (v) => {
      st.reduced = v;
      this.applySettings();
      g.saveSettings();
    });
    const exportBtn = new TextBtn('내보내기', () => {
      ta.value = encodeExport(g.s);
      ta.select();
      try {
        void navigator.clipboard?.writeText(ta.value);
        setText(msg, '저장 코드를 복사했어요.');
      } catch {
        setText(msg, '저장 코드를 선택했어요. 복사해 두세요.');
      }
    });
    const importBtn = new TextBtn('불러오기', () => {
      const ns = decodeImport(ta.value);
      if (!ns) {
        setText(msg, '저장 코드를 읽지 못했어요.');
        audio.play('error');
        return;
      }
      g.replaceState(ns);
      setText(msg, '불러왔어요. 다시 시작합니다…');
      window.setTimeout(() => location.reload(), 400);
    });
    const ta = h('textarea', { 'aria-label': '저장 코드', spellcheck: 'false' }) as HTMLTextAreaElement;
    const msg = h('p', { class: 'note' });
    const reset = new TextBtn('처음부터 다시…', () => this.confirmReset(), 'btn');
    this.openModal('설정', [
      slider('음악', () => st.music, (v) => (st.music = v)),
      slider('효과음', () => st.sfx, (v) => (st.sfx = v)),
      h('div', { class: 'row' }, h('span', { text: '숫자 표기' }), nums.el),
      h('div', { class: 'row' }, big.el, red.el),
      h('p', { class: 'note', text: '진행은 10초마다, 그리고 창을 닫을 때 자동 저장돼요.' }),
      h('div', { class: 'row' }, exportBtn.el, importBtn.el),
      ta,
      msg,
      h('div', { class: 'row' }, reset.el),
      h('p', { class: 'note', text: '글꼴: Galmuri (Lee Minseo, SIL OFL 1.1)' }),
    ]);
  }

  private confirmReset(): void {
    const yes = new TextBtn('모두 지우고 새로 시작', () => {
      this.g.hardReset();
      location.reload();
    }, 'btn pink');
    this.openModal('정말 처음부터 할까요?', [h('p', { text: '모든 진행과 기록이 지워져요. 되돌릴 수 없어요.' })], [yes.el]);
  }

  // ── ending ────────────────────────────────────────────────────────────
  startEnding(replay = false): void {
    const g = this.g;
    if (!replay && this.endingStart >= 0) return;
    this.endingTimers.forEach(clearTimeout);
    this.endingTimers = [];
    if (this.modalOpen) this.closeModal();
    document.getElementById('app')!.inert = true;
    this.endingStart = performance.now();
    g.view.endingT = 0;
    g.view.userMode = 'city';
    g.view.bigMoment('대개화', '블룸이 활짝 피었습니다', PAL.lamp, 5);
    audio.play('ending');
    audio.setIntensity(5);
    const data = endingData(g.s);
    const sc = this.ending.scroll;
    clear(sc);
    const lineEls: HTMLElement[] = [];
    const revealAll = (): void => {
      this.endingTimers.forEach(clearTimeout);
      this.endingTimers = [];
      this.ending.el.classList.add('show');
      lineEls.forEach((el) => el.classList.add('show'));
      sc.scrollTop = 0;
      readAll.el.hidden = true;
    };
    const readAll = new TextBtn('한 번에 읽기', revealAll);
    sc.append(h('div', { class: 'ending-tools' }, readAll.el));
    const add = (el: HTMLElement): void => {
      el.classList.add('line');
      sc.append(el);
      lineEls.push(el);
    };
    add(h('h1', { text: 'METRIC BLOOM' }));
    for (const l of data.lines) add(h('p', { class: l === data.style ? 'style' : '', text: l }));
    const mix = h('div', { class: 'mix', title: '피드 칩을 어디에 두었는지' });
    for (const m of data.mix) {
      const seg = h('div', { title: `${m.id} ${Math.round(m.share * 100)}%` });
      seg.style.flex = String(Math.max(0.001, m.share));
      seg.style.background = SIGNAL_COL[m.id][0];
      mix.append(seg);
    }
    add(
      h(
        'div',
        {},
        h('p', { class: 'note', text: '당신의 피드가 비춘 것' }),
        mix,
        h('p', { class: 'note', text: SIGNAL_IDS.map((id, i) => `${['자극', '깊이', '새로움', '가까움'][i]} ${Math.round(data.mix.find((x) => x.id === id)!.share * 100)}%`).join(' · ') }),
      ),
    );
    add(h('div', { class: 'stats' }, ...data.stats.flatMap(([k, v]) => [h('span', { class: 'k', text: k }), h('span', { text: v })])));
    add(
      h(
        'div',
        { class: 'credits' },
        h('p', {}, h('b', { text: 'Metric Bloom' })),
        h('p', { text: '기획 · 프로그래밍 · 픽셀아트 · 사운드 — Kiro' }),
        h('p', { text: '글꼴 — Galmuri, Lee Minseo (SIL Open Font License 1.1)' }),
        h('p', { text: '끝까지 함께해 주셔서 고마워요.' }),
      ),
    );
    const cont = new TextBtn('계속 둘러보기', () => {
      this.endingTimers.forEach(clearTimeout);
      this.endingTimers = [];
      this.ending.el.classList.remove('on', 'show');
      document.getElementById('app')!.inert = false;
      this.postBtn.focus({ preventScroll: true });
      g.s.meta.endingSeen = true;
      this.endingStart = -1;
      g.save();
    }, 'btn pink');
    const again = new TextBtn('처음부터 다시…', () => {
      this.endingTimers.forEach(clearTimeout);
      this.endingTimers = [];
      this.ending.el.classList.remove('on');
      g.s.meta.endingSeen = true;
      this.confirmReset();
    });
    add(h('div', { class: 'btns', style: 'justify-content:center;display:flex;gap:8px;margin-top:10px' }, cont.el, again.el));
    this.ending.el.classList.remove('show');
    this.ending.el.classList.add('on');
    sc.scrollTop = 0;
    // let the bloom open on screen first, then bring in the results panel
    if (g.view.reducedMotion) revealAll();
    else {
      this.endingTimers.push(window.setTimeout(() => this.ending.el.classList.add('show'), 3200));
      lineEls.forEach((el, i) => this.endingTimers.push(window.setTimeout(() => {
        el.classList.add('show');
        if (i > 3) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 3800 + i * 1100)));
    }
    g.save();
  }

  /** On load: re-show the ending if it has not been dismissed yet. */
  resumeEndingIfNeeded(): void {
    const m = this.g.s.meta;
    if (m.ended && !m.endingSeen) this.startEnding(true);
  }
}

type Settings = Game['settings'];

function pulse(el: HTMLElement): void {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

export { fmtClock };
