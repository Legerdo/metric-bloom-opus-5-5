// "What should I do now?" — the nearest meaningful goal, derived from state.
import { PETAL_IDS, PETALS, type PetalId } from './defs';
import { PETAL_AT, allPetals, capacity, crewLv, has, ms, petalValue, prestigeUnlocked, seedGain } from './calc';
import { BAL } from './calc';
import type { GameState } from './state';

export interface Goal {
  text: string;
  progress: number;
  tab?: string;
}

const logp = (v: number, target: number, from = 1): number => {
  if (v <= from) return 0;
  return Math.min(1, Math.log(v / from) / Math.log(target / from));
};

export function nextGoal(s: GameState): Goal {
  const r = s.run;
  const m = s.meta;
  const F = r.followers;
  if (m.ended) return { text: '대개화를 이뤘습니다. 도시를 마음껏 둘러보세요', progress: 1 };
  if (r.manualPosts === 0 && m.totalManualPosts === 0) return { text: '휴대폰을 눌러 첫 글을 올려 보세요', progress: 0 };
  if (m.runs === 0) {
    if (!has(s, 'window')) return { text: "작업실 탭에서 '창가 자리' 사기", progress: Math.min(1, r.hearts / 10), tab: 'studio' };
    if (r.lines.text === 0) return { text: "루틴 탭에서 '한 줄 일기' 만들기", progress: Math.min(1, r.hearts / 12), tab: 'lines' };
    if (!ms(s, 'm10')) return { text: '팔로워 10명 모으기 → 댓글이 달려요', progress: F / 10 };
    if (r.bondEarned <= 0) return { text: '방에 떠오른 말풍선을 눌러 답글 달기', progress: 0 };
    if (!has(s, 'phone')) return { text: "'새 휴대폰'으로 사진 루틴 열기", progress: Math.min(1, r.hearts / 300), tab: 'studio' };
    if (!ms(s, 'm100')) return { text: '팔로워 100명 → 모든 하트 ×2', progress: F / 100 };
    if (!has(s, 'editor')) return { text: "'편집 프로그램'으로 브이로그 열기", progress: logp(r.hearts, 15000), tab: 'studio' };
    if (!ms(s, 'm300')) return { text: '팔로워 300명 → 트렌드가 보여요', progress: logp(F, 300, 100) };
    if (!ms(s, 'm1000')) return { text: '팔로워 1,000명 → 크루를 고용할 수 있어요', progress: logp(F, 1000, 300) };
    if (crewLv(s, 'manager') + crewLv(s, 'bori') + crewLv(s, 'doyun') === 0) return { text: '크루 탭에서 첫 크루 고용하기', progress: 0, tab: 'crew' };
    if (!ms(s, 'm2500')) return { text: '팔로워 2,500명 → 콜라보 제안', progress: logp(F, 2500, 1000) };
    if (Object.keys(r.collabs).length === 0) return { text: '콜라보 탭에서 첫 콜라보 하기', progress: 0, tab: 'collab' };
    if (!ms(s, 'm10000')) return { text: '팔로워 1만 명 → 인증 배지', progress: logp(F, 1e4, 2500) };
    if (!ms(s, 'm30000')) return { text: '팔로워 3만 명 → 새로운 길이 열려요', progress: logp(F, 3e4, 1e4) };
    const g = seedGain(s);
    return { text: `독립 탭: 나만의 네트워크 '블룸' 열기 (씨앗 +${g})`, progress: Math.min(1, g / 10), tab: 'prestige' };
  }
  // after independence
  const anyPerk = Object.keys(m.perks).length > 0;
  if (!anyPerk && m.seeds > 0 && !r.net) return { text: '노하우 탭에서 씨앗으로 노하우 배우기', progress: 0, tab: 'prestige' };
  if (!r.net) return { text: `팔로워 ${Math.round(BAL.netUnlockF / 1e4)}만 명 → 블룸의 유저들이 글을 쓰기 시작해요`, progress: logp(F, BAL.netUnlockF, 1000) };
  if (!allPetals(s)) {
    let best: PetalId | null = null;
    let bestP = -1;
    for (const id of PETAL_IDS) {
      if (r.petals[id]) continue;
      const p = logp(petalValue(s, id), PETAL_AT[id], 1);
      if (p > bestP) {
        bestP = p;
        best = id;
      }
    }
    if (best) {
      const opened = PETAL_IDS.filter((p) => r.petals[p]).length;
      return { text: `${PETALS[best].name} 열기 (${opened}/4) — ${PETALS[best].stat}`, progress: bestP, tab: 'feed' };
    }
  }
  if (r.festival) return { text: '대개화: 네 흐름을 동시에 목표까지 끌어올리기', progress: r.festivalGauge, tab: 'feed' };
  return { text: '블룸을 키우세요', progress: 0 };
}

/** Optional secondary nudge (bottleneck hints). */
export function hint(s: GameState): string | null {
  const r = s.run;
  if (!ms(s, 'm10')) return null;
  const cap = capacity(s);
  const over = (Object.values(r.lines) as number[]).some((n) => n > cap * 1.5);
  if (over && r.bondEarned < 5000) return `관객 수용력 ${cap}을 크게 넘은 루틴이 있어요. 답글과 커뮤니티로 수용력을 키우거나 다른 루틴을 늘려 보세요.`;
  if (s.meta.runs === 0 && prestigeUnlocked(s) && r.followers > 8e4) return '블룸라인에서의 성장이 느려지고 있어요. 독립할 때가 됐는지도 몰라요.';
  return null;
}
