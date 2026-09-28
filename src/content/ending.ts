// Ending text and results. Descriptive, not graded: the city reflects how it was built.
import { SIGNAL_IDS, SIGNALS, type SignalId } from '../econ/defs';
import { derive } from '../econ/calc';
import type { GameState } from '../econ/state';
import { fmt, fmtTime } from '../util/format';
import { ECHO_ROUTES, echoRoute } from './echo';

export interface EndingData {
  lines: string[];
  style: string;
  mix: { id: SignalId; share: number }[];
  stats: [string, string][];
}

const STYLE: Record<SignalId, string> = {
  heat: '당신의 블룸은 늘 뜨거웠다. 사람들은 빠르게 몰려왔고, 자주 부딪쳤고, 그 소란 속에서도 무언가를 만들어 냈다.',
  depth: '당신의 블룸은 천천히 읽히는 도시가 되었다. 긴 글 아래 긴 답글이 달렸고, 사람들은 오래 머물렀다.',
  novel: '당신의 블룸은 처음 쓰는 사람들의 도시가 되었다. 서툰 첫 글들이 매일 밤 새 창문에 불을 켰다.',
  close: '당신의 블룸은 아는 얼굴들의 도시가 되었다. 골목마다 작은 모임이 있었고, 서로의 이름을 불렀다.',
};
const BALANCED = '당신의 블룸은 어느 한쪽으로 기울지 않았다. 뜨거운 글도, 느린 글도, 서툰 첫 글도, 아는 얼굴의 글도 모두 자리가 있었다.';

export function endingData(s: GameState): EndingData {
  const m = s.meta;
  const r = s.run;
  const d = derive(s);
  const tot = SIGNAL_IDS.reduce((a, id) => a + m.chipSeconds[id], 0) || 1;
  const mix = SIGNAL_IDS.map((id) => ({ id, share: m.chipSeconds[id] / tot }));
  const top = [...mix].sort((a, b) => b.share - a.share)[0];
  const style = top.share < 0.36 ? BALANCED : STYLE[top.id];

  const lines: string[] = [
    '그날 밤, 블룸이 활짝 피었다.',
    `${fmt(r.followers)}명이 이 도시에서 쓰고, 읽고, 답했다.`,
    '처음엔 휴대폰 하나, 창가 자리 하나였다.',
    `내가 직접 올린 글은 ${fmt(m.totalManualPosts)}개. 지금 블룸에는 매초 ${fmt(d.net.pps)}개의 글이 올라온다.`,
    '내가 쓰지 않은 글들이, 내가 만든 길을 따라 흐른다.',
    style,
  ];
  if (m.clickbaitSeconds > 300) lines.push(`자극적인 제목은 ${fmtTime(m.clickbaitSeconds)} 동안 켜져 있었다. 그 덕에 찾아온 사람도, 그 때문에 스쳐 간 사람도 있었다.`);
  if (m.sponsorSeconds > 300) lines.push(`협찬은 ${fmtTime(m.sponsorSeconds)} 동안 방을 밝혔다. 장비가 늘었고, 답장은 조금 늦어졌다.`);
  if (m.manualReplies > 0) lines.push(`내가 직접 단 답글은 ${fmt(m.manualReplies)}개였다. 몇 개는 아직도 기억난다.`);
  lines.push('숫자는 오늘 밤에도 계속 자란다. 그 숫자 하나하나가 누군가의 하루였다.');
  const route = echoRoute(m.narrative.choices);
  if (route) lines.push(ECHO_ROUTES[route].ending);

  const stats: [string, string][] = [
    ...(route ? [['계정의 목소리', ECHO_ROUTES[route].name] as [string, string]] : []),
    ['플레이 시간', fmtTime(m.endTime || m.totalTime)],
    ['블룸 유저', fmt(r.followers)],
    ['크리에이터', fmt(r.creators)],
    ['공동체', fmt(r.communities)],
    ['모든 게시물', fmt(m.totalPosts)],
    ['직접 올린 글', fmt(m.totalManualPosts)],
    ['답글 (직접 / 전체)', `${fmt(m.manualReplies)} / ${fmt(m.totalReplies)}`],
    ['참여한 트렌드', `${fmt(m.trendsJoined)} / ${fmt(m.trendsSeen)}`],
    ['크게 퍼진 게시물', fmt(m.virals)],
    ['받은 하트', fmt(m.totalHearts)],
    ['씨앗', String(m.seedsTotal)],
  ];
  return { lines, style, mix, stats };
}

export function signalName(id: SignalId): string {
  return SIGNALS[id].name;
}
