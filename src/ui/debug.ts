// Developer tools. Only mounted when the page is opened with ?debug=1.
import type { Game } from '../game';
import type { GameState } from '../econ/state';
import { runBot } from '../sim/bot';
import { simulateOffline } from '../econ/engine';
import { PETAL_IDS } from '../econ/defs';
import { h } from './dom';
import type { UI } from './ui';

function jump(g: Game, pred: (s: GameState) => boolean): void {
  const res = runBot('typical', 240, (Date.now() | 0) >>> 0, pred);
  g.replaceState(res.state);
  location.reload();
}

export function mountDebug(g: Game, ui: UI): void {
  const b = (label: string, fn: () => void): HTMLButtonElement => h('button', { type: 'button', onclick: fn }, label);
  const info = h('div');
  const el = h(
    'div',
    { id: 'debug', class: 'on' },
    h('b', { text: 'DEBUG' }),
    h('div', { class: 'row' }, ...[1, 5, 20, 100].map((x) => b(`×${x}`, () => (g.speed = x)))),
    h(
      'div',
      { class: 'row' },
      b('♥×10', () => {
        g.s.run.hearts = Math.max(1000, g.s.run.hearts * 10);
      }),
      b('유대×10', () => {
        g.s.run.bond = Math.max(100, g.s.run.bond * 10);
        g.s.run.bondEarned = Math.max(g.s.run.bondEarned, g.s.run.bond);
      }),
      b('팔로워×2', () => {
        g.s.run.followers = Math.max(10, g.s.run.followers * 2);
      }),
    ),
    h(
      'div',
      { class: 'row' },
      b('크루 직전', () => jump(g, (s) => s.run.followers >= 900 && s.meta.runs === 0)),
      b('독립 직전', () => jump(g, (s) => !!s.run.milestones.m30000 && s.meta.runs === 0)),
      b('독립 직후', () => jump(g, (s) => s.meta.runs > 0)),
      b('블룸 개화', () => jump(g, (s) => s.run.net)),
      b('꽃잎 3', () => jump(g, (s) => PETAL_IDS.filter((p) => s.run.petals[p]).length >= 3)),
      b('대개화', () => jump(g, (s) => s.run.festival)),
      b('엔딩 직전', () => jump(g, (s) => s.run.festivalGauge >= 0.93)),
    ),
    h(
      'div',
      { class: 'row' },
      b('오프라인 30분', () => {
        const sum = simulateOffline(g.s, 1800);
        g.out.length = 0;
        ui.showOffline(sum);
      }),
      b('저장', () => g.save()),
      b('저장 후 새로고침', () => {
        g.save();
        location.reload();
      }),
      b('초기화', () => {
        g.hardReset();
        location.reload();
      }),
    ),
    info,
  );
  document.body.append(el);
  let fpsAcc = 0;
  let frames = 0;
  let last = performance.now();
  const loop = (): void => {
    const now = performance.now();
    fpsAcc += now - last;
    last = now;
    frames++;
    if (fpsAcc > 500) {
      info.textContent = `fps ${Math.round((frames * 1000) / fpsAcc)} · t ${Math.round(g.s.meta.totalTime)}s · particles ${g.view.fx.count()} · speed ×${g.speed}`;
      fpsAcc = 0;
      frames = 0;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
