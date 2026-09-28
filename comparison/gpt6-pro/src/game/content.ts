import { wallet, type Wallet, type Resource, type GeneratorId, type Focus } from './types';
export const CONTINUITY_MULTIPLIER = 4;

export const RESOURCE: Record<Resource, { name: string; color: string; description: string }> = {
  attention: { name: '관심', color: '#efb096', description: '콘텐츠가 만나는 사람들. 작업실과 새로운 제작에 투자합니다.' },
  connection: { name: '연결', color: '#a2d3be', description: '대화가 쌓여 생긴 관계. 커뮤니티와 협업의 기반입니다.' },
  insight: { name: '기록', color: '#c0b3e6', description: '오래 남는 창작과 지식. 서가가 열리면 누적 기록이 모든 생산을 증폭합니다.' },
};
export const FOCI: Record<Focus, { name: string; text: string; factors: [number, number, number] }> = {
  balanced: { name: '함께 자라기', text: '세 가지 생산을 고르게 유지합니다.', factors: [1, 1, 1] },
  reach: { name: '유행의 파도', text: '관심 ×1.65 · 연결 ×0.75 · 기록 ×0.8. 넓게 닿지만 오래 남는 제작은 줄어듭니다.', factors: [1.65, 0.75, 0.8] },
  community: { name: '깊은 대화', text: '관심 ×0.85 · 연결 ×1.65 · 기록 ×1.05. 작은 대화들이 관계를 넓힙니다.', factors: [0.85, 1.65, 1.05] },
  craft: { name: '오래 남을 것', text: '관심 ×0.95 · 연결 ×1 · 기록 ×1.6. 다시 찾을 수 있는 창작을 쌓습니다.', factors: [0.95, 1, 1.6] },
};
export type Generator = { id: GeneratorId; name: string; desc: string; stage: number; cost: Wallet; growth: number; output: Wallet; art: string };
export const GENERATORS: Generator[] = [
  { id: 'desk', name: '작은 작업대', desc: '아이디어를 예약 발행합니다. 처음부터 자동으로 관심을 만듭니다.', stage: 0, cost: wallet(16), growth: 1.17, output: wallet(0.8), art: 'desk' },
  { id: 'studio', name: '창작 스튜디오', desc: '함께 제작하는 콘텐츠. 작업대 10개마다 제작 효율이 높아집니다.', stage: 1, cost: wallet(180), growth: 1.21, output: wallet(8), art: 'studio' },
  { id: 'salon', name: '옥상 살롱', desc: '관심이 대화로 이어집니다. 관심 생산이 높을수록 대화도 풍성해집니다.', stage: 2, cost: wallet(1600), growth: 1.19, output: wallet(0, 0.45), art: 'salon' },
  { id: 'archive', name: '열린 서가', desc: '대화에서 기록을 만듭니다. 연결 생산과 함께 기록 효율이 자랍니다.', stage: 3, cost: wallet(12000, 35), growth: 1.18, output: wallet(0, 0, 0.12), art: 'archive' },
  { id: 'relay', name: '공유 방송탑', desc: '모든 제작물을 도시로 보냅니다. 세 자원을 함께 생산합니다.', stage: 5, cost: wallet(600000, 1200, 80), growth: 1.24, output: wallet(2400, 1.2, 0.24), art: 'relay' },
];
export type Project = { name: string; subtitle: string; cost: Wallet; unlock: string; story: string; speaker: string };
export const PROJECTS: Project[] = [
  { name: '첫 번째 구독자', subtitle: '작은 신호도 누군가에게는 시작이 된다.', cost: wallet(120), unlock: '창작 스튜디오 · 전체 생산 ×1.8', story: '창가의 작은 불빛을 보고 왔어요. 다음 이야기도 기다릴게요.', speaker: '첫 구독자, 모아' },
  { name: '우리의 발행 시간', subtitle: '혼자 쓰던 문장이 대화가 될 때.', cost: wallet(3500), unlock: '옥상 살롱 · 연결 · 제작 방향과 배분', story: '발행은 작업대에 맡겼으니, 이제 사람들이 무슨 이야기를 하는지 들어볼까요?', speaker: '편집자, 윤' },
  { name: '대화가 남는 자리', subtitle: '흘러가는 피드에 책갈피를 꽂는다.', cost: wallet(45000, 180), unlock: '열린 서가 · 기록 생산', story: '어제 나눈 이야기를 오늘 찾아온 사람도 읽을 수 있으면 좋겠어요.', speaker: '기록가, 솔' },
  { name: '다시 찾는 정원', subtitle: '쌓아 둔 기록이 다음 창작의 씨앗이 된다.', cost: wallet(650000, 1400, 120), unlock: '기록 재해석: 누적 기록이 모든 생산을 증폭', story: '기록은 창고가 아니었어요. 오래된 글에서 새 이야기가 자라네요.', speaker: '기록가, 솔' },
  { name: '지붕과 지붕 사이', subtitle: '개별 작업실을 하나의 연결망으로.', cost: wallet(12000000, 10000, 900), unlock: '방송탑 · 6칸 연결망 · 이웃 모듈 시너지', story: '같은 목소리만 크게 만들기보다, 서로 다른 목소리를 이어 봐요.', speaker: '설계자, 다온' },
  { name: '두 번째 봄의 설계', subtitle: '이번에 배운 방법을 다음 계절로 가져간다.', cost: wallet(520000000, 170000, 13000), unlock: '미래 선택: 새 계절 재출발 / 연속 제작 협약', story: '지금의 규모를 잠시 내려놓고 다음 계절로 갈 수도, 이 마을과 연속 제작 협약을 맺을 수도 있어요. 설계 탭에서 미래를 골라 주세요.', speaker: '편집자, 윤' },
  { name: '스스로 움직이는 마을', subtitle: '일이 아니라, 일하는 방식을 설계한다.', cost: wallet(465000000000, 48750000, 3900000), unlock: '조건부 자동 구매 · 예약 라이브 연구 · 자원 유보', story: '이제 무엇을 살지 매번 고르지 않아도 돼요. 남겨 둘 몫과 우선순위만 정해 주세요.', speaker: '설계자, 다온' },
  { name: '멀리서 온 이웃', subtitle: '도달·대화·기록, 다른 강점을 연결한다.', cost: wallet(20000000000000, 650000000, 51250000), unlock: '연결망 공명 ×2 · 동네 큐레이터 연구 · 새로운 구역', story: '우리 동네의 음악이 바다 건너 작업실에서 리믹스됐대요. 숫자 뒤에 새로운 얼굴이 생겼어요.', speaker: '첫 구독자, 모아' },
  { name: '밤을 잇는 방송', subtitle: '누군가 쉬는 동안에도 다른 창작은 이어진다.', cost: wallet(63000000000000, 630000000, 49500000), unlock: '방송탑 협업 배율 · 개화제 준비', story: '모두가 동시에 접속하지 않아도, 이곳의 이야기는 계속 이어질 수 있어요.', speaker: '편집자, 윤' },
  { name: '빛의 개화제', subtitle: '우리가 만든 시스템 전체를 무대 위로.', cost: wallet(2200000000000000, 6600000000, 520000000), unlock: '최종 목표: 세 개의 서로 다른 방송을 완성', story: '가장 큰 숫자를 겨루는 축제가 아니에요. 우리가 만든 연결망으로 무엇을 할 수 있는지 보여 주세요.', speaker: '모두의 초대장' },
];

export type Upgrade = { id: string; name: string; text: string; stage: number; cost: Wallet };
export const UPGRADES: Upgrade[] = [
  { id: 'livebot', name: '예약 라이브 편성표', text: '라이브를 90초마다 자동 진행합니다. 반복 입력 없이 생산 18초분을 얻습니다.', stage: 7, cost: wallet(2000000000000, 40000000, 3000000) },
  { id: 'curator', name: '동네 큐레이터', text: '새 소식에 15초간 응답이 없으면 현재 병목에 도움이 되는 선택을 자동으로 합니다.', stage: 8, cost: wallet(7000000000000, 100000000, 7500000) },
  { id: 'pencil', name: '가벼워진 첫 문장', text: '작업대 생산 ×2. 직접 발행의 첫 보상도 ×2.', stage: 0, cost: wallet(80) },
  { id: 'schedule', name: '빈틈없는 예약표', text: '관심 생산 ×2. 발행은 시스템이 맡습니다.', stage: 1, cost: wallet(1600) },
  { id: 'reply', name: '댓글의 다음 문장', text: '연결 생산 ×2. 일회성 반응이 대화로 이어집니다.', stage: 2, cost: wallet(22000, 50) },
  { id: 'remix', name: '열린 리믹스', text: '살롱 5개마다 스튜디오 생산 배율 +0.25. 서로의 창작이 다음 제작을 돕습니다.', stage: 2, cost: wallet(48000, 120) },
  { id: 'index', name: '살아 있는 색인', text: '기록 생산 ×2. 찾을 수 있는 기록을 만듭니다.', stage: 3, cost: wallet(280000, 500, 35) },
  { id: 'roots', name: '깊이 뻗는 뿌리', text: '기록 누적 배율의 효과 ×2. 소비한 기록도 기억합니다.', stage: 4, cost: wallet(3000000, 2400, 220) },
  { id: 'weave', name: '서로 다른 목소리', text: '서로 다른 이웃의 자원 배율을 +0.4에서 +1.2로.', stage: 5, cost: wallet(24000000, 12000, 1000) },
  { id: 'coop', name: '공동 제작 규약', text: '전체 생산 ×2. 방송탑도 다른 작업실을 돕습니다.', stage: 5, cost: wallet(70000000, 24000, 1800) },
  { id: 'seedbank', name: '계절을 건너는 씨앗', text: '전체 생산 ×2. 새 계절 이후에도 유지됩니다.', stage: 6, cost: wallet(950000000, 100000, 8000) },
  { id: 'relay', name: '빛의 중계', text: '방송탑 생산 ×3. 신호를 멀리 보내는 새로운 방식.', stage: 7, cost: wallet(18000000000, 900000, 75000) },
  { id: 'commons', name: '공유지의 약속', text: '연결과 기록 생산 ×3. 도달 이후의 관계를 뒷받침합니다.', stage: 8, cost: wallet(390000000000, 6000000, 500000) },
  { id: 'bloom', name: '모두의 앙코르', text: '전체 생산 ×3. 개화제에서 세 종류의 목소리를 함께 보냅니다.', stage: 9, cost: wallet(8500000000000, 50000000, 4000000) },
];
export const FESTIVAL = [
  { name: '먼 곳까지, 하나의 노래', resource: 'attention' as Resource, cost: wallet(3.75e15, 7.5e8, 3.75e7), text: '발신과 대화를 연결하고 관심 제작을 45% 이상 배분하세요.', pair: ['beacon', 'circle'] },
  { name: '수많은 목소리의 합창', resource: 'connection' as Resource, cost: wallet(3.75e14, 7.5e9, 7.5e7), text: '대화와 서가를 연결하고 연결 제작을 45% 이상 배분하세요.', pair: ['circle', 'library'] },
  { name: '내일도 꺼지지 않는 빛', resource: 'insight' as Resource, cost: wallet(3.75e14, 7.5e8, 7.5e8), text: '서가와 발신을 연결하고 기록 제작을 45% 이상 배분하세요.', pair: ['library', 'beacon'] },
];
export const EDGES = [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5]];
export const MODULES = {
  beacon: { name: '발신', text: '대화와 이웃하면 관심 증폭', resource: 'attention' as Resource },
  circle: { name: '대화', text: '서가와 이웃하면 연결 증폭', resource: 'connection' as Resource },
  library: { name: '서가', text: '발신과 이웃하면 기록 증폭', resource: 'insight' as Resource },
};
export const EVENTS = [
  { title: '작은 글이 큰 파도를 탔어요', text: '예상하지 못한 사람들이 작업실을 찾아왔어요. 어떤 창을 열까요?', choices: ['새 독자에게 인사하기', '오래 머물 대화 열기'], resources: ['attention', 'connection'] as Resource[] },
  { title: '누군가 오래된 글을 찾습니다', text: '흘러간 피드에서 예전 작품을 다시 찾는 사람이 있어요.', choices: ['다시 소개하기', '주제별 기록으로 엮기'], resources: ['attention', 'insight'] as Resource[] },
  { title: '함께 만드는 주말', text: '이웃 작업실에서 공동 작업을 제안했어요.', choices: ['작업 과정을 함께 나누기', '결과물을 열린 서가에 남기기'], resources: ['connection', 'insight'] as Resource[] },
  { title: '화면 너머의 작은 인사', text: '멀리 있는 창작자가 당신의 작업을 리믹스했어요.', choices: ['더 멀리 공유하기', '다음 협업 이야기하기'], resources: ['attention', 'connection'] as Resource[] },
];
