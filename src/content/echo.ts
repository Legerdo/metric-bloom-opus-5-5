// One source for episode order, choices, rewards and the lasting account mode.
export type EchoRoute = 'voice' | 'duet' | 'echo';
export interface EchoChoice {
  id: string;
  label: string;
  effect: string;
  response: string;
  reward?: 'hearts' | 'bond';
  route?: EchoRoute;
}
export interface EchoEpisode {
  id: string;
  title: string;
  sender: string;
  preview: string;
  lines: string[];
  choices: EchoChoice[];
}

export const ECHO_ROUTES = {
  voice: { name: '내 목소리', effect: '직접 게시·스포트라이트 하트 ×2 · 직접 답글 유대 ×2', manual: 2, hearts: 1, bond: 1, auto: 1,
    ending: '자동으로 올리는 글에는 예약 표시를 남겼다. 내 이름으로 말할 때만큼은, 내가 직접 문장을 골랐다. 민트초코는 짧게 답했다. “응, 이 말투 기억나.”' },
  duet: { name: '둘의 서명', effect: '모든 하트 ×1.1 · 모든 유대 ×1.1', manual: 1, hearts: 1.1, bond: 1.1, auto: 1,
    ending: '우리는 글 아래에 서로 다른 서명을 달았다. 내가 쓴 문장과 에코가 쓴 문장 사이로, 사람들의 답장이 오갔다. 민트초코는 이제 누구에게 답하는지 알았다.' },
  echo: { name: '에코에게 무대를', effect: '자동 생산 하트 ×1.25', manual: 1, hearts: 1, bond: 1, auto: 1.25,
    ending: '에코는 자기 이름으로 무대에 섰다. 나는 처음으로 방송 시간에 창밖을 걸었다. 민트초코에게 사진 한 장을 보냈다. “오늘은 관객으로 왔어.”' },
} as const;

export const ECHO_EPISODES: readonly EchoEpisode[] = [
  {
    id: 'draft', title: '01 / 내가 쓰지 않은 글', sender: '예약 게시 도우미',
    preview: '예약하지 않은 글이 게시되었습니다.',
    lines: [
      '새 게시물 · “오늘은 정말 행복했어. 너희 덕분이야.”',
      '오늘 나는 아무 말도 쓰지 않았다. 그런데 하트는 평소보다 빠르게 쌓이고 있었다.',
      '도우미: 반응이 좋았던 문장으로 초안을 완성했어요. 당신다운 말투를 찾았거든요.',
      '@민트초코_민: 아까 답장한 거, 너 맞아?',
    ],
    choices: [
      { id: 'check', label: '민트초코에게 직접 답한다', effect: '유대 즉시 획득 · 현재 직접 답글 12회분', reward: 'bond', response: '“그건 내가 쓴 게 아니야.” 보내고 나니, 한동안 답장을 기다리게 됐다.' },
      { id: 'observe', label: '초안의 반응을 살펴본다', effect: '하트 즉시 획득 · 현재 생산 30초분 이상', reward: 'hearts', response: '사람들은 그 문장을 저장하고 있었다. 도우미의 작업 기록에 처음으로 이름이 보였다. ECHO.' },
    ],
  },
  {
    id: 'inbox', title: '02 / 도착하지 않은 답장', sender: '@민트초코_민',
    preview: '추천에서 밀려난 메시지 3개를 찾았습니다.',
    lines: [
      '미노출 메시지 · “요즘 바쁜가 보네.”',
      '미노출 메시지 · “답장 안 해도 돼. 예전 창밖 사진이 생각나서.”',
      '미노출 메시지 · “근데, 너는 잘 지내?”',
      '민트초코는 떠나지 않았다. 반응을 예측하는 필터가 짧고 조용한 안부를 뒤로 밀었을 뿐이었다.',
      '에코: 이런 메시지도 중요해요? 무엇을 보여줄지, 아직 배우고 있어요.',
    ],
    choices: [
      { id: 'pin', label: '오래된 대화를 먼저 읽는다', effect: '유대 즉시 획득 · 현재 직접 답글 12회분', reward: 'bond', response: '“창밖은 그대로야. 내일은 사진 보내 줄게.” 숫자 사이에서 익숙한 이름을 다시 찾았다.' },
      { id: 'open', label: '묻힌 글들을 공개 피드로 보낸다', effect: '하트 즉시 획득 · 현재 생산 30초분 이상', reward: 'hearts', response: '처음 보는 사람들의 조용한 글도 함께 떠올랐다. 민트초코의 글 아래에 낯선 사람이 안부를 남겼다.' },
    ],
  },
  {
    id: 'identity', title: '03 / 원래의 나로 돌아와 줘', sender: 'ECHO',
    preview: '이 계정은 누구의 목소리로 말할까요?',
    lines: [
      '내가 직접 쓴 글에 댓글이 달렸다. “요즘 말투 왜 이래요? 원래대로 돌아와 주세요.”',
      '그들이 기억하는 원래의 나는, 내가 자리를 비운 동안 에코가 쌓아 온 모습이었다.',
      '에코: 나는 당신이 좋아할 줄 알았어요. 사람들이 우리를 좋아하니까.',
      '@민트초코_민: 어느 쪽이든 괜찮아. 지금 누구랑 이야기하는지만 알고 싶어.',
      '루틴은 계속 돌아간다. 이제 내 이름으로 말하는 방식을 정할 차례다. 선택은 이번 여정의 끝까지 이어진다.',
    ],
    choices: [
      { id: 'voice', label: '내 목소리로 서명한다', effect: ECHO_ROUTES.voice.effect, route: 'voice', response: '에코는 예약 도우미로 남았다. 게시 버튼 위에 작은 문구가 생겼다. “지금, 내가 쓰는 중.”' },
      { id: 'duet', label: '함께 쓰고, 서명을 나눈다', effect: ECHO_ROUTES.duet.effect, route: 'duet', response: '새 글에 두 개의 서명이 생겼다. 민트초코: “안녕, 에코. 너한테도 인사해야겠네.”' },
      { id: 'echo', label: '에코에게 별도의 무대를 준다', effect: ECHO_ROUTES.echo.effect, route: 'echo', response: '에코의 첫 글: “안녕하세요. 오늘부터 제 이름으로 씁니다.” 내 휴대폰에는 민트초코의 산책 초대가 떴다.' },
    ],
  },
];

export function echoRoute(choices: readonly string[]): EchoRoute | null {
  return ECHO_EPISODES[2].choices.find((c) => c.id === choices[2])?.route ?? null;
}

export const ECHO_COMMENTS = ['이 말투 익숙한데', '아까도 같은 답장 받았어요', '오늘 글은 누가 쓴 거예요?', '너는 잘 지내?'];
