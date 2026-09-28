// Static content definitions for the economy. Pure data: no rendering, no DOM.
// Effects are resolved in calc.ts by id, which keeps each rule explicit and testable.

export type LineId = 'text' | 'photo' | 'video' | 'live';
export const LINE_IDS: readonly LineId[] = ['text', 'photo', 'video', 'live'];

export interface LineDef {
  id: LineId;
  name: string;
  desc: string;
  baseCost: number;
  growth: number;
  /** posts per second per effective unit */
  rate: number;
  /** base hearts per post */
  hv: number;
  /** base follower value per post (multiplied by BAL.followBase) */
  fv: number;
  /** bond produced per post (live only) */
  bond: number;
}

export const LINES: Record<LineId, LineDef> = {
  text: {
    id: 'text',
    name: '한 줄 일기',
    desc: '짧은 글을 정해진 시간마다 자동으로 올립니다.',
    baseCost: 12,
    growth: 1.15,
    rate: 0.1,
    hv: 1,
    fv: 1,
    bond: 0,
  },
  photo: {
    id: 'photo',
    name: '사진 한 장',
    desc: '하루 한 장씩 사진을 올립니다. 하트를 잘 모읍니다.',
    baseCost: 220,
    growth: 1.16,
    rate: 0.08,
    hv: 6,
    fv: 1,
    bond: 0,
  },
  video: {
    id: 'video',
    name: '브이로그',
    desc: '느리게 올라가지만 멀리 퍼집니다. 팔로워 유입이 큽니다.',
    baseCost: 5000,
    growth: 1.18,
    rate: 0.04,
    hv: 30,
    fv: 4,
    bond: 0,
  },
  live: {
    id: 'live',
    name: '라이브 방송',
    desc: '실시간으로 대화합니다. 방송할 때마다 유대가 쌓입니다.',
    baseCost: 1.5e5,
    growth: 1.2,
    rate: 0.03,
    hv: 200,
    fv: 6,
    bond: 3,
  },
};

export type Currency = 'hearts' | 'bond';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  currency: Currency;
  /** Policy upgrades can be toggled on/off after purchase. */
  toggle?: boolean;
  /** Extra visibility requirement id (see calc.upgradeReqMet) */
  req?: string;
}

// ── Studio upgrades (paid with hearts) ────────────────────────────────────────
export const STUDIO_UPGRADES: UpgradeDef[] = [
  { id: 'window', name: '창가 자리', desc: '자연광이 드는 자리로 옮깁니다. 모든 게시물 하트 ×2', cost: 10, currency: 'hearts' },
  { id: 'hashtag', name: '#해시태그 공부', desc: '모든 게시물의 팔로워 유입 ×2', cost: 40, currency: 'hearts' },
  { id: 'phone', name: '새 휴대폰', desc: "'사진 한 장' 루틴 해금. 직접 게시 하트 ×3", cost: 300, currency: 'hearts' },
  { id: 'ringlight', name: '링 라이트', desc: '사진 루틴 하트 ×2', cost: 1500, currency: 'hearts', req: 'phone' },
  { id: 'heartfelt', name: '진심 한 스푼', desc: '직접 게시할 때마다 초당 하트의 20%를 추가로 받습니다', cost: 5000, currency: 'hearts' },
  { id: 'editor', name: '편집 프로그램', desc: "'브이로그' 루틴 해금", cost: 15000, currency: 'hearts' },
  { id: 'thumbnail', name: '썸네일 공식', desc: '브이로그 팔로워 유입 ×2', cost: 8e4, currency: 'hearts', req: 'editor' },
  { id: 'timetable', name: '업로드 시간표', desc: '모든 루틴 게시 속도 ×1.5', cost: 3e5, currency: 'hearts' },
  { id: 'series', name: '시리즈 기획', desc: '운영 중인 루틴 종류마다 모든 하트 +25%', cost: 1.5e6, currency: 'hearts' },
  {
    id: 'clickbait',
    name: '자극적인 제목',
    desc: '켜 두면 팔로워 유입 ×2, 대신 답글 유대 ×0.5. 언제든 끄고 켤 수 있습니다',
    cost: 6e6,
    currency: 'hearts',
    toggle: true,
  },
  { id: 'mic', name: '마이크와 조명', desc: '라이브 방송 하트 ×2', cost: 2e7, currency: 'hearts', req: 'live' },
  { id: 'analytics', name: '인사이트 분석', desc: '트렌드 배율 +2, 다음 트렌드를 미리 알려 줍니다', cost: 6e7, currency: 'hearts', req: 'trends' },
  { id: 'crosspost', name: '크로스 포스팅', desc: '모든 팔로워 유입 ×2', cost: 2.5e8, currency: 'hearts' },
  {
    id: 'sponsor',
    name: '브랜드 협찬',
    desc: '켜 두면 모든 하트 ×3, 대신 모든 유대 획득 ×0.6. 언제든 끄고 켤 수 있습니다',
    cost: 1e9,
    currency: 'hearts',
    toggle: true,
  },
  { id: 'masterclass', name: '작업 노하우 정리', desc: '모든 루틴 게시 속도 ×2', cost: 5e9, currency: 'hearts' },
  {
    id: 'archive',
    name: '지난 글 다시 보기',
    desc: '지금까지 올린 모든 게시물이 자산이 됩니다. 하트 ×(1 + log₁₀(총 게시물)÷2)',
    cost: 3e10,
    currency: 'hearts',
  },
];

// ── Community upgrades (paid with bond) ──────────────────────────────────────
export const COMMUNITY_UPGRADES: UpgradeDef[] = [
  { id: 'names', name: '이름 기억하기', desc: '답글 유대 ×2', cost: 3, currency: 'bond' },
  { id: 'regulars', name: '단골 손님', desc: '댓글이 1.5배 자주 달리고 6초 더 머뭅니다', cost: 12, currency: 'bond' },
  { id: 'fanart', name: '팬아트 벽', desc: '관객 수용력 +10', cost: 40, currency: 'bond' },
  { id: 'qna', name: 'Q&A 시간', desc: '답글 하나마다 초당 하트 3초분을 받습니다', cost: 120, currency: 'bond' },
  { id: 'livecomm', name: '정기 소통 방송', desc: "'라이브 방송' 루틴 해금", cost: 300, currency: 'bond' },
  { id: 'meetup', name: '오프라인 모임', desc: '관객 수용력 ×1.5', cost: 1000, currency: 'bond' },
  {
    id: 'rules',
    name: '함께 만든 댓글 규칙',
    desc: "트렌드 중 달린 댓글도 온전한 유대를 줍니다. '자극적인 제목'의 유대 감소가 절반으로",
    cost: 3000,
    currency: 'bond',
    req: 'trends',
  },
  { id: 'fanclub', name: '찐팬 클럽', desc: '독립할 때 함께하는 찐팬 ×1.5', cost: 8000, currency: 'bond', req: 'prestige' },
  { id: 'letters', name: '고마워요 편지', desc: '모든 하트 ×(1 + log₁₀(누적 유대)÷2)', cost: 25000, currency: 'bond' },
];

// ── Crew (automation) ────────────────────────────────────────────────────────
export type CrewId = 'manager' | 'bori' | 'doyun';
export const CREW_IDS: readonly CrewId[] = ['manager', 'bori', 'doyun'];

export interface CrewLevel {
  hearts: number;
  bond: number;
  desc: string;
}
export interface CrewDef {
  id: CrewId;
  name: string;
  role: string;
  levels: CrewLevel[];
  req?: string;
}

export const CREW: Record<CrewId, CrewDef> = {
  manager: {
    id: 'manager',
    name: '강 실장',
    role: '루틴 매니저',
    levels: [
      { hearts: 2e4, bond: 0, desc: '켜 둔 루틴을 1초마다 자동으로 구매합니다 (가장 싼 것부터)' },
      { hearts: 5e5, bond: 0, desc: '0.25초마다 구매, 예산 규칙과 수용력 규칙 사용 가능' },
    ],
  },
  bori: {
    id: 'bori',
    name: '보리',
    role: '커뮤니티 매니저',
    levels: [
      { hearts: 4e4, bond: 30, desc: '3초마다 댓글에 답글 (유대 60%)' },
      { hearts: 6e5, bond: 300, desc: '1.5초마다 답글 (유대 80%)' },
      { hearts: 2e7, bond: 3000, desc: '0.7초마다 답글 (유대 100%)' },
    ],
  },
  doyun: {
    id: 'doyun',
    name: '도윤',
    role: '트렌드 분석가',
    req: 'trends',
    levels: [{ hearts: 2e5, bond: 0, desc: '정해 둔 규칙에 따라 트렌드에 자동으로 참여합니다' }],
  },
};

// ── Collabs ──────────────────────────────────────────────────────────────────
export interface CollabDef {
  id: string;
  name: string;
  who: string;
  desc: string;
}
export const COLLABS: CollabDef[] = [
  { id: 'cook', name: '@곰의부엌', who: '요리 사진가', desc: '사진 루틴 하트 ×2' },
  { id: 'walk', name: '@밤산책러', who: '산책 에세이스트', desc: '모든 유대 획득 ×2' },
  { id: 'cat', name: '@코딩고양이', who: '개발 브이로거', desc: '브이로그 하트 ×2, 팔로워 유입 ×1.5' },
  { id: 'pickle', name: '@춤추는피클', who: '댄스 챌린저', desc: '트렌드 배율 +3' },
  { id: 'books', name: '@동네책방', who: '책방 주인', desc: '관객 수용력 +15' },
  { id: 'radio', name: '@새벽라디오', who: '라디오 DJ', desc: '라이브 하트 ×2, 라이브 유대 ×2' },
];

// ── Perks (bought with seeds, permanent across runs) ─────────────────────────
export interface PerkDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
}
export const PERKS: PerkDef[] = [
  { id: 'p_routine', name: '몸이 기억하는 루틴', desc: '한 줄 일기 10개, 사진 한 장 5개(새 휴대폰 포함)를 가진 채 시작합니다', cost: 1 },
  { id: 'p_studio', name: '작업실 그대로', desc: '작업실 업그레이드 처음 6개를 가진 채 시작합니다', cost: 2 },
  { id: 'p_regulars', name: '단골의 귀환', desc: '커뮤니티 업그레이드 처음 4개를 가진 채 시작합니다', cost: 1 },
  { id: 'p_crew', name: '다시 모인 크루', desc: '크루 세 명이 처음부터 함께합니다', cost: 3 },
  { id: 'p_trend', name: '트렌드 감각', desc: '트렌드 배율 +2, 트렌드가 1.5배 자주 옵니다', cost: 1 },
  { id: 'p_voice', name: '목소리의 무게', desc: '직접 게시와 직접 답글 효과 ×5', cost: 1 },
  { id: 'p_collab', name: '넓어진 인맥', desc: '콜라보 하트 비용 ×0.1', cost: 2 },
  { id: 'p_blueprint', name: '네트워크 설계도', desc: '피드 슬롯 +2로 시작합니다', cost: 2 },
];

// ── Feed signals (network phase) ─────────────────────────────────────────────
export type SignalId = 'heat' | 'depth' | 'novel' | 'close';
export const SIGNAL_IDS: readonly SignalId[] = ['heat', 'depth', 'novel', 'close'];

export interface SignalDef {
  id: SignalId;
  name: string;
  short: string;
  up: string;
  down: string;
}
export const SIGNALS: Record<SignalId, SignalDef> = {
  heat: { id: 'heat', name: '자극', short: '반응이 뜨거운 글', up: '유저 유입↑ 하트↑', down: '유대·공동체 형성↓ (갈등)' },
  depth: { id: 'depth', name: '깊이', short: '오래 읽히는 글', up: '유대↑ 하트 조금↑', down: '유저 유입 조금↓' },
  novel: { id: 'novel', name: '새로움', short: '처음 쓰는 사람의 글', up: '크리에이터 비율↑', down: '게시물당 하트↓' },
  close: { id: 'close', name: '가까움', short: '아는 사람의 글', up: '공동체 형성↑', down: '유저 유입↓ (버블)' },
};

// ── Network upgrades (hearts) ────────────────────────────────────────────────
export const NET_UPGRADES: UpgradeDef[] = [
  { id: 'n_slot1', name: '피드 슬롯 확장 I', desc: '피드 칩 +1', cost: 1e8, currency: 'hearts' },
  { id: 'n_recommend', name: '추천 탭', desc: '유저 유입 속도 ×1.15', cost: 2e9, currency: 'hearts' },
  { id: 'n_fund', name: '크리에이터 펀드', desc: '유저 중 크리에이터가 되는 비율 ×2', cost: 3e10, currency: 'hearts' },
  { id: 'n_moderation', name: '모더레이션 도구', desc: '자극이 만드는 갈등 페널티 절반', cost: 5e11, currency: 'hearts' },
  { id: 'n_slot2', name: '피드 슬롯 확장 II', desc: '피드 칩 +1', cost: 1.5e12, currency: 'hearts' },
  { id: 'n_groups', name: '그룹 기능', desc: '공동체 형성 ×2, 공동체의 게시 보너스 ×2', cost: 4e12, currency: 'hearts' },
  { id: 'n_feedai', name: '피드 AI', desc: '목표에 맞춰 피드 칩을 자동으로 배분합니다', cost: 8e12, currency: 'hearts' },
  { id: 'n_archive', name: '아카이브 검색', desc: '네트워크 유대 ×2', cost: 2e13, currency: 'hearts' },
  { id: 'n_translate', name: '번역 기능', desc: '가까움의 버블 페널티 절반, 유저 유입 속도 ×1.1', cost: 8e13, currency: 'hearts' },
  { id: 'n_slot3', name: '피드 슬롯 확장 III', desc: '피드 칩 +1', cost: 2e14, currency: 'hearts' },
  { id: 'n_notif', name: '알림 요약', desc: '크리에이터 게시 속도 ×2', cost: 6e14, currency: 'hearts' },
  { id: 'n_spot', name: '오늘의 발견', desc: '스포트라이트 효과 ×3, 크리에이터 비율 ×1.5', cost: 2e15, currency: 'hearts' },
  { id: 'n_slot4', name: '피드 슬롯 확장 IV', desc: '피드 칩 +1', cost: 6e15, currency: 'hearts' },
  { id: 'n_festivalprep', name: '축제 준비 위원회', desc: '네트워크 게시 속도 ×2, 공동체 형성 ×1.5', cost: 2e16, currency: 'hearts' },
];

// ── Petals of the Great Bloom ────────────────────────────────────────────────
export type PetalId = 'reach' | 'bond' | 'create' | 'community';
export const PETAL_IDS: readonly PetalId[] = ['reach', 'bond', 'create', 'community'];

export interface PetalDef {
  id: PetalId;
  name: string;
  signal: SignalId;
  stat: string;
  reward: string;
}
export const PETALS: Record<PetalId, PetalDef> = {
  reach: { id: 'reach', name: '도달의 꽃잎', signal: 'heat', stat: '유저', reward: '유저 유입 속도 ×1.15' },
  bond: { id: 'bond', name: '유대의 꽃잎', signal: 'depth', stat: '누적 유대', reward: '모든 유대 ×2, 피드 칩 +1' },
  create: { id: 'create', name: '창작의 꽃잎', signal: 'novel', stat: '크리에이터', reward: '크리에이터 게시 속도 ×2' },
  community: { id: 'community', name: '공동체의 꽃잎', signal: 'close', stat: '공동체', reward: '공동체 형성 ×2, 피드 칩 +1' },
};

// ── Trends ───────────────────────────────────────────────────────────────────
export const TREND_TAGS: readonly string[] = [
  '#퇴근길하늘',
  '#3초챌린지',
  '#오늘의점심',
  '#고양이자랑',
  '#비오는날',
  '#레트로필터',
  '#새벽감성',
  '#운동인증',
  '#책한줄',
  '#노래추천',
  '#여행기록',
  '#방꾸미기',
  '#첫눈',
  '#동네산책',
  '#손글씨',
  '#야식토론',
];

// ── Milestones (followers) ───────────────────────────────────────────────────
export interface MilestoneDef {
  id: string;
  at: number;
  name: string;
  reward: string;
}
export const MILESTONES: MilestoneDef[] = [
  { id: 'm10', at: 10, name: '첫 열 명', reward: '댓글이 달리기 시작합니다' },
  { id: 'm100', at: 100, name: '백 명의 이웃', reward: '모든 하트 ×2, 게시물이 가끔 크게 퍼집니다' },
  { id: 'm300', at: 300, name: '작은 파도', reward: '트렌드가 보이기 시작합니다' },
  { id: 'm1000', at: 1000, name: '천 명의 관객', reward: '모든 하트 ×2, 크루를 고용할 수 있습니다' },
  { id: 'm2500', at: 2500, name: '입소문', reward: '콜라보 제안이 들어옵니다' },
  { id: 'm5000', at: 5000, name: '이름이 알려지다', reward: '팔로워 유입 ×1.5' },
  { id: 'm10000', at: 1e4, name: '인증 배지', reward: '모든 하트 ×2, 팔로워 유입 ×1.5' },
  { id: 'm30000', at: 3e4, name: '찐팬의 제안', reward: '나만의 네트워크를 열 수 있습니다' },
  { id: 'm100000', at: 1e5, name: '실버 버튼', reward: '모든 하트 ×2' },
  { id: 'm1e6', at: 1e6, name: '골드 버튼', reward: '모든 하트 ×2' },
  { id: 'm1e7', at: 1e7, name: '천만의 도시', reward: '모든 하트 ×2' },
];
