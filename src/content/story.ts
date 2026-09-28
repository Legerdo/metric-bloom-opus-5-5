// Player-facing narrative text (Korean). Messages are keyed by engine flags so
// each one appears once per save, at the moment the related system unfolds.

export interface Message {
  from: string;
  text: string;
  /** 'dm' = someone in the world, 'sys' = platform notice, 'me' = inner voice */
  kind: 'dm' | 'sys' | 'me';
}

export const MESSAGES: Record<string, Message[]> = {
  tab_studio: [{ from: '블룸라인', kind: 'sys', text: '첫 하트를 받았어요! 모은 하트로 작업실을 꾸밀 수 있어요.' }],
  tab_lines: [{ from: '블룸라인', kind: 'sys', text: '매번 직접 올리기 힘들다면? 루틴을 만들면 정해진 시간마다 자동으로 올라가요.' }],
  first_routine: [{ from: '나', kind: 'me', text: '알람을 맞춰 뒀다. 이제 내가 다른 일을 하는 동안에도 글이 올라간다.' }],
  first_follower: [{ from: '@민트초코_민', kind: 'dm', text: '팔로우했어! 오늘 올린 창밖 사진 좋더라.' }],
  ms_m10: [{ from: '블룸라인', kind: 'sys', text: '댓글이 달리기 시작했어요. 방에 떠오르는 말풍선을 눌러 답글을 달아 보세요.' }],
  tab_community: [
    { from: '나', kind: 'me', text: '답글을 달았더니 기분이 이상하게 좋다. 숫자로는 안 보이는 뭔가가 쌓이는 느낌.' },
    { from: '블룸라인', kind: 'sys', text: '유대가 쌓이면 관객 수용력이 커지고, 커뮤니티 업그레이드를 살 수 있어요.' },
  ],
  overcap: [
    {
      from: '블룸라인 인사이트',
      kind: 'sys',
      text: '같은 종류의 게시물이 너무 많아요. 관객 수용력을 넘은 루틴은 효율이 25%로 떨어져요. 유대를 쌓거나 다른 루틴을 늘려 보세요.',
    },
  ],
  line_photo: [{ from: '나', kind: 'me', text: '카메라가 좋아졌다. 이제 사진도 올려 볼까.' }],
  ms_m100: [{ from: '블룸라인', kind: 'sys', text: '팔로워 100명! 이제 가끔 게시물이 크게 퍼질 거예요.' }],
  line_live: [{ from: '@민트초코_민', kind: 'dm', text: '라이브 한다고? 알림 켜 둘게. 이번엔 네 목소리 좀 들어 보자.' }],
  line_video: [{ from: '나', kind: 'me', text: '편집을 배웠다. 느리지만 멀리 가는 이야기를 만들 수 있다.' }],
  ms_m300: [
    {
      from: '블룸라인',
      kind: 'sys',
      text: '지금 뜨는 해시태그가 보여요. 트렌드에 올라타면 팔로워가 크게 늘지만, 스쳐 가는 사람들의 댓글은 유대가 얕아요.',
    },
  ],
  ms_m1000: [
    { from: '강 실장', kind: 'dm', text: '천 명이면 혼자 다 하시긴 무리예요. 저희가 손을 보탤게요. (크루 탭)' },
    { from: '나', kind: 'me', text: '방이 좁아졌다. 옆방을 작업실로 쓰기로 했다.' },
  ],
  ms_m2500: [{ from: '@곰의부엌', kind: 'dm', text: '안녕하세요! 요즘 피드에서 자주 봐요. 저희 같이 콘텐츠 해 볼래요? (콜라보 탭)' }],
  ms_m5000: [{ from: '블룸라인', kind: 'sys', text: '이름이 알려지고 있어요. 모르는 사람들이 당신을 먼저 소개하기 시작했어요.' }],
  ms_m10000: [{ from: '블룸라인', kind: 'sys', text: '인증 배지가 발급되었습니다. 이제 당신의 게시물은 더 멀리 추천돼요.' }],
  ms_m30000: [
    { from: '@민트초코_민', kind: 'dm', text: '있잖아, 우리끼리 모일 공간이 있으면 좋겠어. 네가 하나 만들면? 다들 따라갈 거야.' },
    { from: '블룸라인', kind: 'sys', text: "'독립' 탭이 열렸어요. 언제 떠날지는 당신이 정해요." },
  ],
  platform_slow: [
    { from: '블룸라인 인사이트', kind: 'sys', text: '계정 도달률이 점점 낮아지고 있어요. 광고를 집행해 보시겠어요?' },
    { from: '나', kind: 'me', text: '여기서 한 계정이 닿을 수 있는 곳은 이쯤인가 보다.' },
  ],
  ms_m100000: [{ from: '블룸라인', kind: 'sys', text: '실버 버튼 달성! 모든 하트 ×2.' }],
  newhome: [
    { from: '나', kind: 'me', text: '새 공간 "블룸"을 열었다. 작은 방, 작은 서버. 그래도 찐팬들이 먼저 와 있다.' },
    { from: '@민트초코_민', kind: 'dm', text: '이사 축하해! 여기선 네가 규칙을 정하는 거지?' },
  ],
  network: [
    {
      from: '블룸',
      kind: 'sys',
      text: '블룸의 유저가 처음으로 자기 글을 올렸어요. 이제 당신의 피드가, 누구의 글을 누구에게 보여줄지 정합니다.',
    },
    { from: '나', kind: 'me', text: '창밖의 불빛들이 전부 누군가의 방이었다. 이제 그 방들에서도 글이 올라온다.' },
  ],
  communities: [{ from: '블룸', kind: 'sys', text: '유저들이 스스로 모임을 만들었어요. 공동체가 늘수록 크리에이터가 더 자주 글을 씁니다.' }],
  feedai: [{ from: '나', kind: 'me', text: '이제 피드가 스스로 균형을 잡는다. 나는 무엇을 향할지만 정하면 된다.' }],
  petal_reach: [{ from: '블룸', kind: 'sys', text: '도달의 꽃잎이 열렸어요. 도시 어디서나 블룸이 보여요.' }],
  petal_bond: [{ from: '블룸', kind: 'sys', text: '유대의 꽃잎이 열렸어요. 사람들이 서로의 글에 오래 머뭅니다.' }],
  petal_create: [{ from: '블룸', kind: 'sys', text: '창작의 꽃잎이 열렸어요. 보는 사람과 만드는 사람의 경계가 흐려집니다.' }],
  petal_community: [{ from: '블룸', kind: 'sys', text: '공동체의 꽃잎이 열렸어요. 골목마다 작은 모임이 불을 밝힙니다.' }],
  festival: [
    {
      from: '블룸',
      kind: 'sys',
      text: '네 꽃잎이 모두 열렸어요. 도달·유대·창작·공동체, 네 흐름이 함께 목표에 닿는 동안 대개화 게이지가 찹니다.',
    },
  ],
};

export const COMMENTS_NORMAL: readonly string[] = [
  '오늘 사진 분위기 최고',
  '이거 어디예요?',
  '매일 보러 와요',
  '덕분에 웃었어요',
  '저도 해 볼래요',
  '글 너무 공감돼요',
  '다음 편 언제예요?',
  '처음 댓글 달아요!',
  '힘내세요!',
  '색감 뭐예요 대체',
  '알림 켜 뒀어요',
  '친구한테 공유했어요',
  '노래 제목 알려 주세요',
  '오늘도 잘 보고 가요',
  '하루의 낙이에요',
  '장비 뭐 쓰세요?',
  '고양이 또 보여 주세요',
  '이런 글 더 써 주세요',
  '퇴근길에 보는 중',
  '저장했어요',
  '어제 댓글 답해 줘서 고마워요',
  '이 방 너무 아늑해요',
];

export const COMMENTS_TREND: readonly string[] = [
  'ㅋㅋㅋㅋㅋ',
  '알고리즘이 데려옴',
  '이거 뭐임?',
  '챌린지 보고 옴',
  'ㄹㅇㅋㅋ',
  '누구세요?',
  '추천에 떠서 옴',
  '와 뜬다 뜬다',
  '나만 몰랐나',
  '1빠',
];

export const START_HINT = '휴대폰을 눌러 첫 글을 올려 보세요';
