import './styles.css';
import './responsive.css';
import { newGame, RESOURCE_IDS, type Focus, type GeneratorId, type Resource, type GameState } from './game/types';
import { FOCI, GENERATORS, PROJECTS, RESOURCE, CONTINUITY_MULTIPLIER } from './game/content';
import { buyGenerator, buyUpgrade, post, setAllocation, invest, buildModule, prestige, chooseContinuity, seedReward, answerEvent, launchFestival, tick, offlineProgress, format, clock, production } from './game/economy';
import { SAVE_KEY, BACKUP_KEY, loadGame, saveGame, decodeSave } from './game/save';
import { AudioGarden } from './audio';
import { createWorld } from './view/world';
import { GardenUI } from './ui';

let storage: Storage | null = null;
try { storage = window.localStorage; } catch { /* The game still works when browser storage is unavailable. */ }
const loaded = storage ? loadGame(storage) : { state: newGame(), warning: '브라우저 저장을 사용할 수 없습니다. 현재 창에서는 계속 플레이할 수 있습니다.' };
let state = loaded.state;
let pendingImport: GameState | null = null;
let seenChapter = state.chapter;
let blockedByOtherTab = false, hiddenAt = 0, last = performance.now(), accumulator = 0, renderClock = 0, saveClock = 0, seenNotice = 0;
const audio = new AudioGarden(state.settings);
const ui = new GardenUI(() => state, dispatch);
const { scene } = createWorld('world', () => state, target => {
  if (target === 'post') dispatch('post');
  else {
    const g = GENERATORS.find(g => g.id === target);
    if (g && state.chapter >= g.stage) { ui.selectTab('work'); document.querySelector(`#buy-${g.id}`)?.scrollIntoView({ block: 'nearest', behavior: state.settings.reducedMotion ? 'instant' : 'smooth' }); }
  }
});
function save(): boolean {
  if (blockedByOtherTab || !state.started) return false;
  if (storage && saveGame(storage, state)) { ui.status('자동 저장됨'); return true; }
  ui.status('저장 불가 · 설정에서 내보내기', true); return false;
}
function start(): void {
  if (!state.started) { state.started = true; state.savedAt = Date.now(); save(); }
  audio.unlock(); ui.close();
}
function settings(): void {
  ui.modal('작업실 설정', `<p>음악과 효과음을 따로 조절할 수 있어요.</p>
    <label class="setting-row"><span>배경 음악</span><input type="range" min="0" max="1" step="0.05" value="${state.settings.music}" data-setting="music" aria-label="배경 음악 음량"></label>
    <label class="setting-row"><span>효과음</span><input type="range" min="0" max="1" step="0.05" value="${state.settings.sfx}" data-setting="sfx" aria-label="효과음 음량"></label>
    <label class="setting-row"><span>움직임 줄이기</span><input type="checkbox" data-setting="reducedMotion" ${state.settings.reducedMotion ? 'checked' : ''}></label>
    <p class="section-note">15초마다 이 브라우저에 자동 저장됩니다. 오프라인 생산은 최대 30분, 평소의 50%예요. 다른 주소나 브라우저에서는 저장이 분리됩니다.</p>
    <div class="utility-buttons"><button data-action="save">지금 저장</button><button data-action="export">저장 내보내기</button><button data-action="import">저장 불러오기</button><button data-action="fullscreen">전체 화면</button><button data-action="reset" class="danger">새 게임</button></div>`);
}
function ending(): void {
  const dominant = (Object.keys(state.focusTime) as Focus[]).sort((a, b) => state.focusTime[b] - state.focusTime[a])[0];
  const text: Record<Focus, string> = {
    balanced: '당신은 여러 목소리가 나란히 자랄 자리를 만들었습니다. 빠른 소식도, 긴 대화도, 오래 남을 기록도 이곳을 찾습니다.',
    reach: '당신의 작업실은 먼 곳으로 닿는 창문이 되었습니다. 넓어진 도달 범위의 끝에서, 한 번도 만나지 못했던 이웃들이 서로를 발견합니다.',
    community: '당신의 마을에는 대화가 머무를 자리가 많습니다. 스쳐 간 반응들이 서로의 다음 창작을 기다리는 관계가 되었습니다.',
    craft: '당신은 다시 찾아올 수 있는 길을 남겼습니다. 피드가 흘러간 다음에도, 누군가는 이곳의 기록에서 자기 이야기의 첫 문장을 발견합니다.',
  };
  ui.modal('모든 신호가 꽃이 된 밤', `<p class="ending-kicker">빛의 개화제 · 본편 완료</p><h3>처음에는, 한 사람의 작은 창가였습니다.</h3><p>이제는 당신이 잠시 손을 놓아도 이야기가 이어집니다. 작업실에서 만든 신호는 다리를 건너 대화가 되고, 기록이 되어, 또 다른 창작의 씨앗이 됩니다.</p><p>${text[dominant]}</p><div class="ending-stats"><div><span>함께한 시간</span><strong>${clock(state.endedAt ?? state.played)}</strong></div><div><span>직접 발행</span><strong>${state.actions}회</strong></div><div><span>지나온 계절</span><strong>${state.reborn ? 2 : 1}</strong></div></div><p>관심 ${format(state.lifetime.attention)} · 연결 ${format(state.lifetime.connection)} · 기록 ${format(state.lifetime.insight)}</p><p><strong>당신이 만든 시스템 전체가 움직이고 있었습니다.</strong></p><div class="credits">METRIC BLOOM<br>게임 설계 · 코드 · 픽셀아트 · 음악: 이 프로젝트를 위해 제작<br>게임 엔진: Phaser · TypeScript · Vite<br>마지막으로 이 정원을 완성한 사람: 당신<br><br>플레이해 주셔서 감사합니다.</div>`, '<button data-action="close" class="primary">완성된 마을 둘러보기</button>');
}
function help(): void {
  ui.modal('작은 신호를 키우는 방법', `<h3>1. 발행하고, 작은 작업대를 마련하세요.</h3><p>이야기를 발행하면 관심이 생겨요. 관심 16으로 첫 작업대를 사면 자동 생산이 시작됩니다. 설비 10·25·50개마다 단계 배율이 커집니다.</p><h3>2. 생산과 다음 계획 사이에서 선택하세요.</h3><p>새 설비와 연구에 투자하면 생산이 늘어요. 아래 계획을 완성하면 새 건물과 시스템이 열립니다. 기본적으로 생산의 20%를 자동 기여하며, 비율을 직접 바꿀 수 있습니다. 보유 자원 전부를 기여하기 전에 설비를 살 몫도 생각해 보세요.</p><h3>3. 반복에서 설계로 나아갑니다.</h3><p>연결이 열리면 제작 방향과 시간 배분을 고를 수 있어요. 기록은 소비해도 누적 생산 배율에 남습니다. 이후 연결망의 이웃 관계와 자동 구매 우선순위를 설계하고, 서로 다른 세 방송으로 개화제를 준비하세요.</p><p class="section-note">Space: 발행/라이브 · 1~4: 관리 탭 · Esc: 창 닫기<br>화면 속 작업실을 눌러도 발행할 수 있어요.<br>음악은 첫 입력 이후 시작됩니다. 놓친 이벤트에 불이익은 없습니다.<br>본편은 엔딩이 있는 단편형 게임입니다. 켜 둔 동안에는 계속 생산하며, 자리를 비우면 최대 30분을 50% 효율로 계산해요.</p>`);
}
function dispatch(action: string, value?: string): void {
  if (action === 'close') { ui.close(); return; }
  if (action === 'reload') { location.reload(); return; }
  if (blockedByOtherTab && !['settings', 'help', 'export'].includes(action)) return;
  audio.unlock();
  let success = false;
  if (action === 'start') start();
  else if (action === 'post') { if (!state.started) start(); success = post(state); if (success) { audio.sound('post'); scene.burst('post', state.chapter >= 2 ? '+ 함께하는 시간' : `+${state.upgrades.includes('pencil') ? 8 : 4}`); } }
  else if (action === 'buy') { success = buyGenerator(state, value as GeneratorId, ui.quantity); }
  else if (action === 'upgrade') success = buyUpgrade(state, value || '');
  else if (action === 'focus' && state.chapter >= 2 && value && Object.hasOwn(FOCI, value)) { state.focus = value as Focus; success = true; }
  else if (action === 'allocation') { const [i, n] = (value || '').split(':').map(Number); setAllocation(state, i, n); }
  else if (action === 'funding' && [0, .2, .4, .6, .8].includes(Number(value))) state.funding = Number(value);
  else if (action === 'invest') success = invest(state);
  else if (action === 'module') success = buildModule(state, Number(value), ui.selectedModule);
  else if (action === 'auto' && state.chapter >= 7) state.automation.enabled = !state.automation.enabled;
  else if (action === 'policy' && state.chapter >= 7 && ['balanced', ...RESOURCE_IDS].includes(value || '')) state.automation.policy = value as Resource | 'balanced';
  else if (action === 'reserve' && state.chapter >= 7 && [0, .25, .5, .75].includes(Number(value))) state.automation.reserve = Number(value);
  else if (action === 'event') success = answerEvent(state, Number(value));
  else if (action === 'continuity' && state.chapter >= 6 && !state.reborn && !state.continuity) {
    ui.modal('지금의 마을과 함께', `<p>설비와 보유 자원, 연구와 연결망을 <strong>모두 유지</strong>하며 전체 생산이 영구적으로 <strong>×${CONTINUITY_MULTIPLIER}</strong>가 됩니다.</p><p>이 길을 선택하면 새 계절로 재출발하는 선택은 닫힙니다. 규모를 유지하며 지금의 마을을 더 깊게 가꾸는 방식입니다.</p>`, '<button data-action="close" class="secondary">조금 더 생각하기</button><button data-action="confirm-continuity" class="primary">연속 제작 협약 맺기</button>');
  }
  else if (action === 'confirm-continuity') { success = chooseContinuity(state); if (success) ui.close(); }
  else if (action === 'prestige' && state.chapter >= 6 && !state.reborn && !state.continuity) {
    ui.modal('두 번째 봄의 설계', `<p>새 계절에는 <strong>씨앗 ${seedReward(state)}개</strong>를 얻어 전체 생산이 영구적으로 <strong>×${(1 + seedReward(state) * .8).toFixed(1)}</strong> 증가합니다.</p><h3>남는 것</h3><p>완성한 계획, 연구, 누적 기록, 연결망, 제작 방향과 배분은 그대로 남습니다.</p><h3>다시 시작하는 것</h3><p>보유 자원은 관심 45,000 / 연결 120 / 기록 25로, 설비는 작업대 25 / 스튜디오 10 / 살롱 5 / 서가 3 / 방송탑 1개로 돌아갑니다. 이 선택은 한 번만 가능합니다.</p><p class="section-note">새 계절을 맞지 않고 지금의 마을로 끝까지 나아가도 됩니다.</p>`, '<button data-action="close" class="secondary">지금의 마을 유지</button><button data-action="confirm-prestige" class="primary">새 계절 시작</button>');
  } else if (action === 'confirm-prestige') { success = prestige(state); if (success) ui.close(); }
  else if (action === 'launch') { success = launchFestival(state); if (success) ending(); }
  else if (action === 'ending' && state.ended) ending();
  else if (action === 'settings') settings();
  else if (action === 'help') help();
  else if (action === 'save') { ui.toast(save() ? '현재 진행을 저장했습니다.' : '저장하지 못했습니다. 저장 내보내기로 진행을 보관해 주세요.'); }
  else if (action === 'export') {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...state, savedAt: Date.now() }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'metric-bloom-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else if (action === 'import') {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        if (file.size > 200000) throw new Error('저장 파일은 200KB 이하여야 합니다.');
        pendingImport = decodeSave(await file.text());
        ui.modal('이 정원을 불러올까요?', `<p>진행한 계획: ${pendingImport.chapter}개<br>플레이 시간: ${clock(pendingImport.played)}<br>보유 관심: ${format(pendingImport.resources.attention)}</p><p>현재 진행을 선택한 저장으로 교체합니다. 현재 정원을 오래 보관하려면 먼저 저장 내보내기를 사용해 주세요.</p>`, '<button data-action="close" class="secondary">취소</button><button data-action="confirm-import" class="primary">불러오기</button>');
      } catch (e) { pendingImport = null; ui.toast(e instanceof Error ? e.message : '저장을 읽을 수 없습니다.'); }
    }); input.click();
  } else if (action === 'confirm-import' && pendingImport) {
    state = pendingImport; pendingImport = null; state.savedAt = Date.now(); seenNotice = 0; seenChapter = state.chapter; accumulator = 0;
    audio.configure(state.settings); ui.selectTab('work'); ui.close(); save(); ui.toast('선택한 정원을 불러왔습니다.');
  } else if (action === 'fullscreen') {
    const result = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    result.catch(() => ui.toast('이 브라우저에서는 전체 화면을 사용할 수 없습니다.'));
  } else if (action === 'reset') {
    ui.modal('새 이야기를 시작할까요?', '<p>현재 진행과 이 게임의 자동 저장을 초기화합니다. 다른 사이트 데이터는 건드리지 않습니다. 남겨 두고 싶은 정원이 있다면 먼저 저장을 내보내 주세요.</p>', '<button data-action="close" class="secondary">계속 플레이</button><button data-action="confirm-reset" class="danger">초기화하고 새 게임</button>');
  } else if (action === 'confirm-reset') {
    const settings = { ...state.settings }; state = newGame(); state.settings = settings; state.started = true; seenNotice = 0; seenChapter = 0; accumulator = 0;
    try { storage?.removeItem(SAVE_KEY); storage?.removeItem(BACKUP_KEY); } catch { ui.toast('기존 저장을 지우지 못했습니다.'); }
    ui.selectTab('work'); ui.close(); save();
  } else if (action === 'setting-music' || action === 'setting-sfx') {
    const n = Number(value); if (Number.isFinite(n)) state.settings[action === 'setting-music' ? 'music' : 'sfx'] = Math.max(0, Math.min(1, n)); audio.configure(state.settings);
  } else if (action === 'setting-reducedMotion') state.settings.reducedMotion = value === 'true';
  if (success && action === 'module') audio.sound('purchase');
  if (action !== 'allocation' && !action.startsWith('setting-') && action !== 'post') save();
  ui.render(); consumeNotices();
}
function consumeNotices(): void {
  if (state.chapter !== seenChapter) { seenChapter = state.chapter; if ([2, 5, 6, 7, 10].includes(state.chapter)) ui.selectTab('design'); }
  const fresh = state.notices.filter(n => n.id > seenNotice); if (!fresh.length) return;
  const lastNotice = fresh[fresh.length - 1]; seenNotice = lastNotice.id;
  ui.toast(lastNotice.text); audio.sound(lastNotice.kind); scene.burst(lastNotice.kind, lastNotice.kind === 'purchase' ? '새 작업을 시작해요' : '새로운 이야기가 열렸어요');
}

function resumeProgress(seconds: number): void {
  if (blockedByOtherTab || !state.started || seconds < 2) return;
  const result = offlineProgress(state, seconds);
  if (seconds >= 15) ui.toast(`자리를 비운 동안 ${Math.floor(result.seconds / 60)}분 · 관심 ${format(result.gain.attention)}, 연결 ${format(result.gain.connection)}, 기록 ${format(result.gain.insight)} 생산. ${result.chapters ? `계획 ${result.chapters}개를 완성했어요.` : '50% 효율로 계산했어요.'}`);
  save(); ui.render();
}
if (state.started) {
  resumeProgress((Date.now() - state.savedAt) / 1000);
} else {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) state.settings.reducedMotion = true;
  ui.modal('작은 신호가 피어나는 곳', '<p>창가에 작은 작업실을 마련했습니다.<br>아직은 당신의 이야기를 기다리는 사람이 없어요.</p><p><strong>첫 이야기를 발행해 보세요.</strong><br>작업대를 마련하고, 동료를 만나고,<br>당신이 만든 연결망으로 하나의 축제를 완성합니다.</p><p class="section-note">단편형 인크리멘탈 게임 · 한국어 · 이 브라우저에 자동 저장<br>마우스/터치로 플레이 · Space로 발행</p>', '<button data-action="start" class="primary">창가에 불 켜기</button>');
}
if (loaded.warning) { ui.status('저장 상태 확인 필요', true); ui.toast(loaded.warning); }

function frame(now: number): void {
  const delta = Math.max(0, (now - last) / 1000); last = now;
  if (!document.hidden && !blockedByOtherTab) {
    if (delta > 3) { resumeProgress(delta); accumulator = 0; }
    else {
      accumulator += delta;
      while (accumulator >= .25) { tick(state, .25); accumulator -= .25; }
    }
    renderClock += delta; saveClock += delta;
    if (renderClock >= .2) { renderClock = 0; ui.render(); consumeNotices(); }
    if (saveClock >= 15 && state.started) { saveClock = 0; save(); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); hiddenAt = Date.now(); audio.suspend(); }
  else { if (hiddenAt) resumeProgress((Date.now() - hiddenAt) / 1000); hiddenAt = 0; last = performance.now(); accumulator = 0; }
});
window.addEventListener('pagehide', () => { if (!hiddenAt) save(); });
window.addEventListener('beforeunload', () => { if (!hiddenAt) save(); });
window.addEventListener('storage', e => {
  if (e.key === SAVE_KEY && e.newValue) {
    blockedByOtherTab = true; audio.suspend(); ui.status('다른 창에서 플레이 중', true);
    ui.modal('다른 창에서 정원을 가꾸고 있어요', '<p>진행이 서로 덮어써지지 않도록 이 창을 멈췄습니다. 이 창에서 계속하려면 다른 게임 창을 닫고 최신 저장을 불러와 주세요.</p>', '<button data-action="reload" class="primary">최신 저장 불러오기</button>');
  }
});
document.addEventListener('keydown', e => {
  if (e.repeat || ui.dialog.open || (e.target as HTMLElement).matches('input,textarea,select,button')) return;
  if (e.code === 'Space') { e.preventDefault(); dispatch('post'); }
  else if (/^[1-4]$/.test(e.key)) ui.selectTab(['work', 'research', 'design', 'journal'][Number(e.key) - 1]);
});
if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { bloomDebug: { state: () => structuredClone(state), advance: (seconds: number) => {
    const limit = Math.min(10800, Math.max(0, Math.floor(seconds)));
    for (let i = 0; i < limit; i++) tick(state, 1);
    ui.render(); save();
  } } });
}
