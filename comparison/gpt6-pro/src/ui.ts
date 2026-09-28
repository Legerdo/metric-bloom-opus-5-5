import { RESOURCE_IDS, type GameState, type Resource, type Wallet, type Module } from './game/types';
import { RESOURCE, GENERATORS, PROJECTS, UPGRADES, FOCI, MODULES, FESTIVAL, EVENTS, CONTINUITY_MULTIPLIER } from './game/content';
import { production, format, clock, costFor, affordable, levelBonus, nextProductionMilestone, catalogBonus, networkBonus, projectRatio, moduleCost, seedReward, hasPair, festivalReady } from './game/economy';
import { icon } from './view/sprites';
export const esc = (s: unknown): string => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const art = (name: string, size = 32) => `<img class="pixel-icon" src="${icon(name)}" width="${size}" height="${size}" alt="" draggable="false">`;
const costs = (cost: Wallet): string => RESOURCE_IDS.filter(r => cost[r] > 0).map(r => `<span class="cost ${r}">${RESOURCE[r].name} ${format(cost[r])}</span>`).join('');
const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
type Dispatch = (action: string, value?: string) => void;
export class GardenUI {
  tab = 'work'; quantity = 1; selectedModule: Module = 'beacon';
  private signature = ''; private eventSignature = ''; private goalSignature = ''; private toastTimer = 0;
  readonly dialog: HTMLDialogElement;
  constructor(private state: () => GameState, private dispatch: Dispatch) {
    $('#app').innerHTML = `
      <header class="topbar"><div class="brand">${art('flower', 44)}<div><h1>메트릭 블룸</h1><span>작은 신호가 피어나는 곳</span></div></div>
        <div class="header-tools"><span id="save-status" class="save-status">이 브라우저에 저장</span><button data-action="help" class="quiet">플레이 안내</button><button data-action="settings" class="quiet">설정</button></div></header>
      <main class="game-layout"><section class="world-column" aria-label="창작자 마을">
        <div class="world-heading"><span class="eyebrow">우리의 작은 연결망</span><span id="time" class="mono">0:00</span></div>
        <div class="resource-strip">${RESOURCE_IDS.map(r => `<div class="resource ${r}" id="resource-${r}" title="${RESOURCE[r].description}">${art(r, 32)}<div><span class="resource-label">${RESOURCE[r].name}</span><strong id="amount-${r}">0</strong><small id="rate-${r}">+0 / 초</small></div></div>`).join('')}<div class="resource-note" id="resource-note">아직은 작은 작업실 하나.<br>첫 이야기를 세상에 보내 보세요.</div></div>
        <div class="world-frame"><div id="world" role="img" aria-label="성장하며 집과 서가, 다리와 방송탑이 늘어나는 픽셀아트 옥상 마을"></div><div class="world-label"><span class="live-dot"></span><span id="world-name">창가의 작은 작업실</span></div><div id="world-badge" class="world-badge">첫 번째 계절</div></div>
        <div class="action-dock"><div><h2 id="action-title">당신의 첫 이야기를 들려주세요.</h2><p id="action-desc">관심 16으로 작업대를 마련하면 자동 발행이 시작돼요.</p></div><button id="post" data-action="post" class="primary post-button">${art('desk', 30)}<span id="post-text">이야기 발행 <small>관심 +4 · Space</small></span></button></div>
        <section id="project" class="project-board" aria-label="다음 성장 목표"></section>
        <div class="letter"><div class="portrait">${art('flower', 36)}</div><div><strong id="speaker">창가에 남겨진 메모</strong><p id="story">처음엔 한 사람에게 닿는 이야기면 충분해요. 그다음은 함께 만들어 봐요.</p></div></div>
      </section><aside class="workbench" aria-label="작업실 관리"><nav class="tabs" aria-label="관리 탭">
        <button data-tab="work" class="selected">작업실</button><button data-tab="research">연구</button><button data-tab="design" id="design-tab">설계</button><button data-tab="journal">발자취</button>
      </nav><div id="bench-content" class="bench-content"></div><div id="event" class="event-slot"></div><div class="bench-foot">반복은 작업실에, 선택은 당신에게.</div></aside></main>
      <footer class="page-foot"><span>METRIC BLOOM <i>·</i> 소란한 피드 사이, 우리가 가꾼 정원</span><span id="growth-hint">작은 시작 / 첫 번째 계절</span></footer>
      <div id="toast" class="toast" role="status" aria-live="polite"></div><dialog id="modal"><div id="modal-body"></div></dialog>`;
    this.dialog = $('#modal');
    $('#app').addEventListener('click', e => {
      const b = (e.target as Element).closest<HTMLButtonElement>('button'); if (!b || b.disabled) return;
      if (b.dataset.tab) { this.selectTab(b.dataset.tab); return; }
      if (b.dataset.quantity) { this.quantity = Number(b.dataset.quantity); this.signature = ''; this.render(); return; }
      if (b.dataset.module) { this.selectedModule = b.dataset.module as Module; this.signature = ''; this.render(); return; }
      if (b.dataset.action) this.dispatch(b.dataset.action, b.dataset.value);
    });
    $('#app').addEventListener('change', e => {
      const input = e.target as HTMLInputElement;
      if (input.dataset.setting) this.dispatch(`setting-${input.dataset.setting}`, input.type === 'checkbox' ? String(input.checked) : input.value);
      if (input.dataset.control) this.dispatch(input.dataset.control, input.value);
    });
    $('#app').addEventListener('input', e => {
      const input = e.target as HTMLInputElement;
      if (input.dataset.allocation) this.dispatch('allocation', `${input.dataset.allocation}:${input.value}`);
      if (input.dataset.setting && input.type === 'range') this.dispatch(`setting-${input.dataset.setting}`, input.value);
    });
    this.dialog.addEventListener('click', e => { if (e.target === this.dialog) this.dialog.close(); });
    this.render();
  }
  selectTab(tab: string): void {
    if (tab === 'design' && this.state().chapter < 2) return;
    this.tab = tab; this.signature = ''; this.render();
    const s = this.state();
    if (tab === 'design' && s.chapter >= 6 && !s.reborn && !s.continuity && !s.ended) {
      const panel = $('#bench-content'), season = panel.querySelector<HTMLElement>('.season');
      if (season) panel.scrollTop += season.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16;
    }
  }
  status(text: string, warning = false): void { $('#save-status').textContent = text; $('#save-status').classList.toggle('warning', warning); }
  toast(text: string): void {
    const t = $('#toast'); t.textContent = text; t.classList.add('visible'); clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('visible'), 4800);
  }
  private bench(): string {
    const s = this.state();
    if (this.tab === 'work') return `
      <div class="section-head"><div><span class="eyebrow">만들고, 맡기고, 함께하기</span><h2>창작이 자라는 곳</h2></div>${art('desk', 40)}</div>
      <p class="section-note">설비는 구매 즉시 자동으로 일해요.<br>다음 생산 돌파까지 필요한 수량을 확인하세요.</p>
      <div class="quantity"><span>한 번에 구매</span>${[1, 5, 10].map(n => `<button data-quantity="${n}" class="${this.quantity === n ? 'chosen' : ''}">${n}개</button>`).join('')}</div>
      <div class="generator-list">${GENERATORS.filter(g => s.chapter >= g.stage).map(g => `
        <article class="generator"><div class="generator-top">${art(g.art, 48)}<div><h3>${g.name}</h3><span class="owned" id="owned-${g.id}"></span></div></div>
        <small class="next-milestone" id="milestone-${g.id}"></small><p>${g.desc}</p>
        <button class="buy-button" data-action="buy" data-value="${g.id}" id="buy-${g.id}"><span>마련하기 <b>+${this.quantity}</b></span><span id="cost-${g.id}" class="cost-list"></span></button></article>`).join('')}
      </div><div class="next-unlock">${s.chapter < 5 ? '다음 계획을 완성하면 새로운 제작 방식이 열립니다.' : '배분과 연결망을 조정하면 같은 설비로도 다른 결과를 만들 수 있어요.'}</div>`;
    if (this.tab === 'research') return `<div class="section-head"><div><span class="eyebrow">더 많이보다, 다르게</span><h2>새로운 제작 방식</h2></div>${art('insight', 40)}</div><p class="section-note">수치뿐 아니라 작업실 사이의 관계도 바뀝니다.</p>${UPGRADES.filter(u => u.stage <= s.chapter && !s.upgrades.includes(u.id)).map(u => `<article class="research"><h3>${u.name}</h3><p>${u.text}</p><button id="upgrade-${u.id}" data-action="upgrade" data-value="${u.id}" class="buy-button"><span>연구하기</span><span class="cost-list">${costs(u.cost)}</span></button></article>`).join('') || '<div class="completed-note">지금 가능한 연구를 모두 마쳤어요.<br>다음 계획에서 새로운 방식이 열립니다.</div>'}<details class="finished-research"><summary>완료한 연구 ${s.upgrades.length}개</summary>${UPGRADES.filter(u => s.upgrades.includes(u.id)).map(u => `<p><strong>${u.name}</strong><br>${u.text}</p>`).join('')}</details>`;
    if (this.tab === 'journal') return `<div class="section-head"><div><span class="eyebrow">우리가 지나온 계절</span><h2>작은 신호의 발자취</h2></div>${art('flower', 40)}</div><p class="section-note">누적 관심 ${format(s.lifetime.attention)}<br>직접 발행 ${s.actions}회 · 마련한 설비 ${s.purchases}개</p><ol class="journal">${s.milestones.slice().reverse().map(m => `<li><time>${clock(m.time)}</time><span>${esc(m.name)}</span></li>`).join('') || '<li>첫 발행이 첫 번째 기록이 됩니다.</li>'}</ol>`;
    return this.design();
  }

  private design(): string {
    const s = this.state();
    return `<div class="section-head"><div><span class="eyebrow">반복에서, 설계로</span><h2>우리만의 제작 방식</h2></div>${art('relay', 40)}</div>
      <h3 class="subhead">어떤 이야기를 만들까요?</h3><div class="focus-options">${Object.entries(FOCI).map(([id, f]) => `<button data-action="focus" data-value="${id}" class="focus-button ${s.focus === id ? 'chosen' : ''}" title="${f.text}">${f.name}</button>`).join('')}</div><p class="section-note" id="focus-description">${FOCI[s.focus].text}</p>
      <h3 class="subhead">제작 시간 나누기</h3><p class="section-note">총 100%. 적게 배분해도 생산은 멈추지 않아요.<br>지금 부족한 자원에 시간을 더 배분해 보세요.</p><div class="allocations">${RESOURCE_IDS.map((r, i) => `<label class="allocation ${r}"><span>${RESOURCE[r].name} <strong id="allocation-value-${i}">${s.allocation[i]}%</strong></span><input type="range" min="10" max="80" step="5" value="${s.allocation[i]}" data-allocation="${i}" aria-label="${RESOURCE[r].name} 제작 시간" id="allocation-${i}"></label>`).join('')}</div>
      ${s.chapter >= 4 ? `<div class="catalog-note">${art('insight', 32)}<div><strong>기록은 다음 창작의 뿌리</strong><p>소비한 기록도 누적 배율에 남습니다.<br>전체 생산 <b id="catalog-multiplier">×${catalogBonus(s).toFixed(2)}</b></p></div></div>` : ''}
      ${s.chapter >= 5 ? `<h3 class="subhead">지붕 사이의 연결망</h3><p class="section-note">모듈을 고른 뒤 빈 자리를 눌러 설치하세요.<br>이미 설치한 모듈은 무료로 바꿀 수 있어요.</p><div class="module-picker">${Object.entries(MODULES).map(([id, m]) => `<button data-module="${id}" class="${id === this.selectedModule ? 'chosen' : ''}" title="${m.text}">${art(id, 26)}${m.name}</button>`).join('')}</div><div class="network-grid">${s.modules.map((m, i) => `<button data-action="module" data-value="${i}" class="network-node ${m || 'empty'}" aria-label="연결망 ${i + 1}번 ${m ? MODULES[m].name : '빈 자리'}">${art(m || 'flower', 32)}<span>${m ? MODULES[m].name : '설치'}</span></button>`).join('')}</div><p class="section-note">발신 ↔ 대화: 관심 / 대화 ↔ 서가: 연결<br>서가 ↔ 발신: 기록. 가로·세로 이웃끼리 연결돼요.</p><div id="network-bonus" class="network-bonus"></div>${s.modules.includes(null) ? `<p class="section-note">다음 빈 자리 설치 비용</p><div class="cost-list">${costs(moduleCost(s))}</div>` : ''}` : ''}
      ${s.chapter >= 6 ? `<section class="season"><h3>${s.continuity ? '지금의 마을과 함께' : s.reborn ? '다음 계절에도 남는 것' : '어떤 미래를 만들까요?'}</h3><p>${s.continuity ? `연속 제작 협약 · 전체 생산 ×${CONTINUITY_MULTIPLIER}<br>현재 마을을 유지하는 길을 선택했어요.` : s.reborn ? `씨앗 ${s.seeds}개 · 전체 생산 ×${(1 + s.seeds * 0.8).toFixed(1)}<br>완성한 계획과 연구, 연결망은 그대로 남았어요.` : '재출발로 더 큰 배율을 얻거나,<br>지금의 마을을 유지하며 생산을 강화합니다.'}</p>${!s.reborn && !s.continuity ? `<button data-action="prestige" class="secondary">새 계절 살펴보기 · 씨앗 ${seedReward(s)}개</button><button data-action="continuity" class="secondary" style="margin-top:8px">현재 마을 유지 · 생산 ×${CONTINUITY_MULTIPLIER}</button>` : ''}</section>` : ''}
      ${s.chapter >= 7 ? `<h3 class="subhead">스스로 움직이는 작업실</h3><button data-action="auto" class="secondary" id="auto-toggle">자동 구매 ${s.automation.enabled ? '켜짐' : '꺼짐'}</button><label class="control-label">구매 우선순위<select data-control="policy" id="auto-policy">${['balanced', ...RESOURCE_IDS].map(r => `<option value="${r}" ${s.automation.policy === r ? 'selected' : ''}>${r === 'balanced' ? '현재 병목 우선' : RESOURCE[r as Resource].name + ' 우선'}</option>`).join('')}</select></label><label class="control-label">구매하지 않고 남겨 둘 비율<select data-control="reserve" id="auto-reserve">${[0, 0.25, 0.5, 0.75].map(v => `<option value="${v}" ${s.automation.reserve === v ? 'selected' : ''}>${v * 100}%</option>`).join('')}</select></label><p class="section-note">8초마다 예산 안에서 연구와 설비를 마련합니다. 계획 기여금은 별도로 설정해요.</p>` : ''}`;
  }

  private goal(): string {
    const s = this.state(), final = s.chapter >= PROJECTS.length;
    const p = final ? FESTIVAL[s.festival.selected] : PROJECTS[s.chapter];
    if (s.ended) return `<div class="goal-heading"><div><span class="eyebrow">빛의 개화제 · 본편 완료</span><h2>모든 신호가 꽃이 된 밤</h2></div>${art('flower', 48)}</div><p>한 사람의 창가에서 시작한 이야기가, 하나의 마을이 되었습니다.</p><button data-action="ending" class="secondary">우리의 마지막 장면 다시 보기</button>`;
    if (final && s.festival.completed.every(Boolean)) return `<div class="goal-heading"><div><span class="eyebrow">모든 방송 준비 완료</span><h2>이제, 불을 밝힐 시간입니다.</h2></div>${art('flower', 48)}</div><p>세 가지 목소리가 준비됐어요. 우리가 만든 연결망을 세상에 보여 주세요.</p><button data-action="launch" class="primary">개화제 개막하기</button>`;
    return `<div class="goal-heading"><div><span class="eyebrow">${final ? `마지막 무대 · ${s.festival.selected + 1} / 3` : `다음 한 걸음 · ${String(s.chapter + 1).padStart(2, '0')}`}</span><h2>${p.name}</h2></div>${art(final ? 'relay' : 'flower', 40)}</div><p class="goal-subtitle">${final ? FESTIVAL[s.festival.selected].text : PROJECTS[s.chapter].subtitle}</p>
      ${final ? `<div class="festival-steps">${FESTIVAL.map((f, i) => `<span class="${s.festival.completed[i] ? 'done' : i === s.festival.selected ? 'current' : ''}">${i + 1}. ${RESOURCE[f.resource].name}${s.festival.completed[i] ? ' 완료' : ''}</span>`).join('')}</div><p id="festival-condition" class="condition"></p>` : ''}
      <div class="goal-resources">${RESOURCE_IDS.filter(r => p.cost[r] > 0).map(r => `<div class="goal-resource ${r}"><div><span>${RESOURCE[r].name}</span><span id="goal-amount-${r}" class="mono"></span></div><div class="progress-track"><span id="goal-fill-${r}"></span></div></div>`).join('')}</div>
      <div class="goal-controls"><button data-action="invest" class="secondary" id="invest">보유 자원 기여하기</button><label>자동 기여 <select data-control="funding" id="funding">${[0, 0.2, 0.4, 0.6, 0.8].map(v => `<option value="${v}" ${s.funding === v ? 'selected' : ''}>${v * 100}%</option>`).join('')}</select></label></div>
      <p class="goal-reward">${final ? '각 방송의 제작 배분을 조정하면 준비가 빨라집니다.' : '완성하면 · ' + PROJECTS[s.chapter].unlock}</p><p id="goal-hint" class="goal-hint"></p>`;
  }

  render(): void {
    const s = this.state(), rates = production(s);
    document.documentElement.classList.toggle('reduce-motion', s.settings.reducedMotion);
    $('#time').textContent = clock(s.endedAt ?? s.played);
    RESOURCE_IDS.forEach((r, i) => {
      $(`#resource-${r}`).hidden = i === 1 ? s.chapter < 2 : i === 2 ? s.chapter < 3 : false;
      $(`#amount-${r}`).textContent = format(s.resources[r]);
      $(`#amount-${r}`).title = s.resources[r].toLocaleString('ko-KR', { maximumFractionDigits: 2 });
      $(`#rate-${r}`).textContent = `+${format(rates[r])} / 초`;
      $(`#rate-${r}`).title = `전체 생산량입니다. 진행 중인 계획에 최대 ${Math.round(s.funding * 100)}%가 자동으로 기여됩니다.`;
    });
    $('#resource-note').hidden = s.chapter >= 3;
    $('#resource-note').innerHTML = s.chapter >= 2 ? '반응에서 대화로.<br>새로운 관계가 자랍니다.' : s.generators.desk > 0 ? '작업실이 스스로<br>이야기를 전하고 있어요.' : '아직은 작은 작업실 하나.<br>첫 이야기를 세상에 보내 보세요.';
    $('#world-name').textContent = s.ended ? '빛의 개화제' : s.chapter >= 8 ? '도시를 잇는 창작자 마을' : s.chapter >= 5 ? '지붕과 지붕 사이' : s.chapter >= 2 ? '이야기가 모이는 정원' : '창가의 작은 작업실';
    $('#world-badge').textContent = s.reborn ? `두 번째 계절 · 씨앗 ${s.seeds}개` : '첫 번째 계절';
    $('#action-title').textContent = s.ended ? '우리의 이야기는 여기서 피어났어요.' : s.chapter >= 2 ? '함께하는 시간을 열어 볼까요?' : s.generators.desk > 0 ? '작업실이 다음 이야기를 준비하고 있어요.' : '당신의 첫 이야기를 들려주세요.';
    $('#action-desc').textContent = s.chapter >= 2 ? '라이브로 현재 생산 18초분을 함께 나눠요. 자동 생산은 계속됩니다.' : s.generators.desk > 0 ? '이제 숫자를 기다리는 대신, 작업대와 다음 계획에 투자해 보세요.' : '관심 16으로 작업대를 마련하면 자동 발행이 시작돼요.';
    if (s.upgrades.includes('livebot') && !s.ended) {
      $('#action-title').textContent = '라이브도 작업실에 맡겨 두었어요.';
      $('#action-desc').textContent = `예약 라이브 ${s.autoLives}회 진행. 이제 연결망과 다음 방송의 배분을 설계해 주세요.`;
    }
    const postButton = $<HTMLButtonElement>('#post'); postButton.disabled = s.actionCooldown > 0 || s.ended;
    $('#post-text').innerHTML = s.ended ? '오늘의 이야기를 마쳤어요' : `${s.chapter >= 2 ? '라이브 열기' : '이야기 발행'}<small>${s.actionCooldown > 0 ? `${Math.ceil(s.actionCooldown)}초 후` : s.chapter >= 2 ? '전체 생산 18초분 · Space' : `관심 +${s.upgrades.includes('pencil') ? 8 : 4} · Space`}</small>`;
    if (s.upgrades.includes('livebot') && !s.ended) $('#post-text').innerHTML = `라이브 예약됨<small>${Math.ceil(s.actionCooldown)}초 후 자동 진행</small>`;
    $('#design-tab').hidden = s.chapter < 2;
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b => { b.classList.toggle('selected', b.dataset.tab === this.tab); b.setAttribute('aria-current', b.dataset.tab === this.tab ? 'page' : 'false'); });
    const signature = [this.tab, s.chapter, s.upgrades.join(','), s.modules.join(','), s.reborn, s.continuity, s.ended, this.quantity, this.selectedModule, this.tab === 'journal' ? s.milestones.length : 0].join('|');
    if (signature !== this.signature) {
      const panel = $('#bench-content'), scroll = panel.scrollTop; panel.innerHTML = this.bench(); panel.scrollTop = scroll; this.signature = signature;
    }
    if (this.tab === 'work') for (const g of GENERATORS) {
      const b = document.querySelector<HTMLButtonElement>(`#buy-${g.id}`); if (!b) continue;
      const c = costFor(s, g.id, this.quantity); b.disabled = !affordable(s, c) || s.generators[g.id] + this.quantity > 1500;
      $(`#owned-${g.id}`).textContent = `${s.generators[g.id]}개 운영 · 단계 배율 ×${format(levelBonus(s.generators[g.id]))}`;
      const next = nextProductionMilestone(s.generators[g.id]);
      $(`#milestone-${g.id}`).textContent = next ? `${next}개에서 생산 ×${next <= 50 ? 2 : 1.5} · ${next - s.generators[g.id]}개 남음` : '모든 생산 단계를 완성했어요.';
      $(`#cost-${g.id}`).innerHTML = costs(c);
    }
    if (this.tab === 'research') for (const u of UPGRADES) {
      const b = document.querySelector<HTMLButtonElement>(`#upgrade-${u.id}`); if (b) b.disabled = !affordable(s, u.cost);
    }
    if (this.tab === 'design') {
      document.querySelectorAll<HTMLButtonElement>('[data-action="focus"]').forEach(b => b.classList.toggle('chosen', b.dataset.value === s.focus));
      $('#focus-description').textContent = FOCI[s.focus].text;
      s.allocation.forEach((v, i) => { $(`#allocation-value-${i}`).textContent = `${v}%`; const input = $<HTMLInputElement>(`#allocation-${i}`); if (document.activeElement !== input) input.value = String(v); });
      const cb = document.querySelector('#catalog-multiplier'); if (cb) cb.textContent = '×' + catalogBonus(s).toFixed(2);
      const nb = document.querySelector('#network-bonus'); if (nb) { const n = networkBonus(s); nb.innerHTML = RESOURCE_IDS.map(r => `<span class="${r}">${RESOURCE[r].name} ×${n[r].toFixed(1)}</span>`).join(''); }
      document.querySelectorAll<HTMLButtonElement>('[data-action="module"]').forEach(b => { b.disabled = !s.modules[Number(b.dataset.value)] && !affordable(s, moduleCost(s)); });
      const toggle = document.querySelector('#auto-toggle'); if (toggle) toggle.textContent = `자동 구매 ${s.automation.enabled ? '켜짐' : '꺼짐'}`;
    }
    const gs = `${s.chapter}:${s.festival.selected}:${s.festival.completed.join(',')}:${s.ended}`;
    if (gs !== this.goalSignature) { $('#project').innerHTML = this.goal(); this.goalSignature = gs; }
    if (!s.ended && !s.festival.completed.every(Boolean)) {
      const final = s.chapter >= PROJECTS.length, goal = final ? FESTIVAL[s.festival.selected].cost : PROJECTS[s.chapter].cost;
      const progress = final ? s.festival.progress : s.project;
      RESOURCE_IDS.forEach(r => {
        const amount = document.querySelector(`#goal-amount-${r}`); if (!amount) return;
        amount.textContent = `${format(progress[r])} / ${format(goal[r])}`;
        $(`#goal-fill-${r}`).style.width = `${Math.min(100, 100 * progress[r] / goal[r])}%`;
      });
      const needed = RESOURCE_IDS.filter(r => goal[r] > progress[r] + 1e-6);
      const bottleneck = needed.slice().sort((a, b) => (goal[b] - progress[b]) / Math.max(.001, rates[b]) - (goal[a] - progress[a]) / Math.max(.001, rates[a]))[0];
      const hint = $('#goal-hint');
      hint.textContent = bottleneck ? rates[bottleneck] === 0 ? `${RESOURCE[bottleneck].name} 생산 설비를 먼저 마련해 주세요.` : `현재 필요한 것: ${RESOURCE[bottleneck].name}. 설비 구매와 제작 배분으로 속도를 높일 수 있어요.` : '다음 장면을 준비하고 있어요.';
      if (bottleneck && s.chapter >= 5 && rates[bottleneck] > 0) {
        const pair = { attention: '발신–대화', connection: '대화–서가', insight: '서가–발신' }[bottleneck];
        hint.textContent = `현재 병목: ${RESOURCE[bottleneck].name}. 제작 비중과 ${pair} 이웃을 늘리면 빠르게 돌파할 수 있어요.`;
      }
      const b = document.querySelector<HTMLButtonElement>('#invest');
      if (s.chapter >= 6 && !s.reborn && !s.continuity) hint.textContent = '설계 탭에서 새 계절 또는 연속 제작 협약을 선택하면 다음 계획의 생산 병목을 크게 줄일 수 있어요.';
      if (b) b.disabled = !needed.some(r => s.resources[r] > 0) || (final && !festivalReady(s));
      if (final) {
        const signal = FESTIVAL[s.festival.selected];
        $('#festival-condition').textContent = !hasPair(s, signal.pair) ? '설계 탭에서 이 방송에 필요한 두 모듈을 이웃하게 놓아 주세요.' : !festivalReady(s) ? `설계 탭에서 ${RESOURCE[signal.resource].name} 제작 시간을 45% 이상 배분해 방송 경로를 맞춰 주세요.` : '방송 경로가 준비됐어요. 자동 기여금으로 준비를 진행합니다.';
      }
    }
    const last = PROJECTS[Math.min(s.chapter - 1, PROJECTS.length - 1)];
    if (last) { $('#speaker').textContent = last.speaker; $('#story').textContent = last.story; }
    $('#growth-hint').textContent = s.ended ? '우리가 만든 시스템 전체가 움직이고 있었다.' : s.chapter >= 7 ? '설계자 / 스스로 움직이는 마을' : s.chapter >= 2 ? '관리자 / 함께 만드는 정원' : '창작자 / 작은 시작';
    this.renderEvent();
  }

  private renderEvent(): void {
    const s = this.state(), signature = `${s.event?.id}:${s.event?.answered}:${s.chapter}`;
    if (signature !== this.eventSignature) {
      this.eventSignature = signature;
      $('#event').innerHTML = s.event && !s.event.answered ? `<div class="event-paper"><span class="eyebrow">작업실에 도착한 소식 <span id="event-time"></span></span><h3>${EVENTS[s.event.id % EVENTS.length].title}</h3><p>${EVENTS[s.event.id % EVENTS.length].text}</p><div>${EVENTS[s.event.id % EVENTS.length].choices.map((c, i) => `<button data-action="event" data-value="${i}">${c}</button>`).join('')}</div><small>선택한 생산 90초간 ×1.6 · 놓쳐도 손해는 없어요.</small></div>` : '';
    }
    const t = document.querySelector('#event-time'); if (t && s.event) t.textContent = `${Math.ceil(s.event.remaining)}초`;
  }

  modal(title: string, body: string, buttons = '<button data-action="close" class="primary">돌아가기</button>'): void {
    $('#modal-body').innerHTML = `<div class="modal-heading">${art('flower', 42)}<h2 id="dialog-title">${title}</h2><button data-action="close" class="quiet close-modal" aria-label="닫기">×</button></div><div class="modal-copy">${body}</div><div class="modal-actions">${buttons}</div>`;
    this.dialog.setAttribute('aria-labelledby', 'dialog-title');
    if (!this.dialog.open) this.dialog.showModal();
  }
  close(): void { this.dialog.close(); }
}
