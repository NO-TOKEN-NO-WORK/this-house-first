import {
  AlertLevel,
  CallResult,
  CheckKind,
  VisitResult,
} from "../../src/lib/domain";

/**
 * 합성 확인 기록 이력 — 맥락 브리핑(FR-12)의 유일한 입력 (ADR-0024 구현).
 *
 * 시드는 지금까지 `CheckEvent`를 지우기만 하고 만들지 않았다. 그러면 브리핑의 입력이 0건이라
 * 기능이 있어도 화면이 늘 빈 상태다. 여기서 과거 경보일 세 날과 그날의 전화·방문 기록을 만든다.
 *
 * 메모는 전부 합성 문장이다. 실존 인물·발화와 무관하다 (PRD §3 비목표).
 * 문장은 브리핑의 세 축(생활 리듬 / 반복 신호 / 조심할 것)이 실제로 뽑히도록 설계했다.
 *  - 김순자: 새벽 밭일(리듬) · 부산 따님(대화 추천) · 에어컨 없음(조심할 것) — Figma 164:6169의 예시와 같은 자리
 *  - 박영희·최말순: 같은 말이 두 번 나오는 반복 신호(어지럼·복약)
 *  - 정옥분: 에어컨 리모컨 — PRD F6의 "지난주에 리모컨이 안 된다고 하셨어요"
 *
 * 대상자마다 최소 2건을 둔다. 기록이 한 건이면 브리핑이 `반복 신호`를 만들 수 없고
 * 기록별 대화 요약도 한 줄에서 끝나 데모에서 화면이 비어 보인다.
 *
 * 마스킹 경로(`src/lib/briefing/mask.ts`)를 실제로 태우기 위해 이름·전화·기관명이 섞인 문장을
 * 일부러 남겨 뒀다. 외부 모델에는 지워진 뒤에 나간다.
 */

/** 오늘(KST) 기준 며칠 전인지 — 시드를 언제 돌려도 "최근 기록"이 되게 상대 날짜로 둔다 */
export interface HistoryAlertDay {
  daysAgo: number;
  level: AlertLevel;
  feelsLikeMax: number;
}

export const HISTORY_ALERT_DAYS: readonly HistoryAlertDay[] = [
  { daysAgo: 9, level: AlertLevel.WARNING, feelsLikeMax: 35.4 },
  { daysAgo: 7, level: AlertLevel.EMERGENCY, feelsLikeMax: 38.2 },
  { daysAgo: 2, level: AlertLevel.WARNING, feelsLikeMax: 36.1 },
];

export interface HistoryCheck {
  daysAgo: number;
  /** 같은 날 여러 건일 때의 순서 — 작을수록 먼저 (기록 시각이 벌어지게 쓴다) */
  order?: number;
  kind: CheckKind;
  result: string;
  memo: string | null;
}

/** 대상자 이름(`synthetic.ts`의 합성 이름) → 그 사람의 확인 기록 */
export const CHECK_HISTORY: Readonly<Record<string, readonly HistoryCheck[]>> = {
  김순자: [
    {
      daysAgo: 9,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "새벽 5시에 밭에 나갔다 오신다고 하심. 낮에는 마루에 누워 계심",
    },
    {
      daysAgo: 7,
      order: 0,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "부산 사는 따님 이야기를 오래 즐겁게 하심. 다음 달에 오신다고",
    },
    {
      daysAgo: 7,
      order: 1,
      kind: CheckKind.VISIT,
      result: VisitResult.AIRCON_ISSUE,
      memo: "선풍기만 있고 에어컨은 없음. 낮에 방 안이 계속 더움",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "아침 혈압약은 챙겨 드셨다고 함. 새벽 밭일은 계속 나가심",
    },
  ],
  박영희: [
    {
      daysAgo: 9,
      order: 0,
      kind: CheckKind.CALL,
      result: CallResult.NO_ANSWER,
      memo: null,
    },
    {
      daysAgo: 9,
      order: 1,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "화장실에 계셨다고. 다리가 아파 전화 받기까지 오래 걸리심",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "어지럽다는 말씀을 또 하심. 지팡이 짚고 마당까지만 다니심",
    },
  ],
  이정순: [
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "아드님이 저녁마다 들르신다고. 낮 시간에만 연락 달라고 하심",
    },
    {
      daysAgo: 7,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "아드님과 같이 계셔서 낮에는 걱정 없다고 하심",
    },
  ],
  최말순: [
    {
      daysAgo: 9,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "혈압약은 아침에 챙겨 드심. 오후에는 경로당에 가신다고",
    },
    {
      daysAgo: 7,
      kind: CheckKind.CALL,
      result: CallResult.SYMPTOM,
      memo: "머리가 아프다고 하셔서 방문으로 올림",
    },
    {
      daysAgo: 2,
      kind: CheckKind.VISIT,
      result: VisitResult.OK,
      memo: "약은 잘 드시고 계심. 경로당 다니는 것도 그대로",
    },
  ],
  정옥분: [
    {
      daysAgo: 7,
      kind: CheckKind.VISIT,
      result: VisitResult.ACTED,
      memo: "에어컨 리모컨이 안 눌린다고 하셔서 건전지 갈아 드림",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "리모컨은 아직 잘 된다고 하심. 밤에는 창문 열고 주무심",
    },
  ],
  강복남: [
    {
      daysAgo: 7,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "이웃 밭일은 오전에만 하신다고. 점심 뒤에는 그늘에서 쉬신다고 하심",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "낮에는 이웃 밭일 도우러 나가심. 물은 챙겨 다니신다고",
    },
  ],
  조영자: [
    {
      daysAgo: 9,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "귀가 어두워 큰 소리로 말씀드려야 함. 두 번 여쭈면 알아들으심",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.NO_ANSWER,
      memo: null,
    },
  ],
  윤분이: [
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "며느리가 이번 주에는 못 온다고 해서 혼자 계시는 낮이 길어짐",
    },
    {
      daysAgo: 7,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "며느리가 낮에 들른다고 하심",
    },
  ],
  장갑순: [
    {
      daysAgo: 7,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "성당에 다니셔서 수요일 오전에는 집에 안 계심",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "에어컨은 전기세가 무서워 잘 안 켜신다고 하심",
    },
  ],
  임춘식: [
    {
      daysAgo: 9,
      kind: CheckKind.CALL,
      result: CallResult.NO_ANSWER,
      memo: null,
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "낮에는 일 나가시고 저녁에만 통화 가능하다고 하심",
    },
  ],
  한병철: [
    {
      daysAgo: 9,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "아침 산책을 오래 하심. 더운 날에도 나가신다고",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "산책은 이제 해 뜨기 전에만 하신다고 하심",
    },
  ],
  오금례: [
    {
      daysAgo: 7,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "당뇨약 시간을 자주 놓치신다고. 달력에 적어 두시기로 함",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "약 시간을 또 놓치셨다고 함. 달력은 잘 보고 계심",
    },
  ],
  서정길: [
    {
      daysAgo: 7,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "선풍기는 있다고 하시는데 에어컨은 말씀을 피하심",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "에어컨이 있는지 아직 확인 못 함. 다음에 방문해서 보기로",
    },
  ],
  신옥희: [
    {
      daysAgo: 9,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "맨 위층이라 오후에 너무 덥다고 하심. 행복동주민센터 무더위쉼터 안내",
    },
    {
      daysAgo: 7,
      kind: CheckKind.VISIT,
      result: VisitResult.ACTED,
      memo: "선풍기 한 대뿐이라 창문 열어 드리고 물 챙겨 드림",
    },
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.NO_ANSWER,
      memo: null,
    },
  ],
  권태식: [
    {
      daysAgo: 2,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "밤에 잠을 설친다고 하심. 낮에 창문을 계속 열어 두신다고",
    },
    {
      daysAgo: 7,
      kind: CheckKind.CALL,
      result: CallResult.OK,
      memo: "혼자 계셔도 잘 지내신다고. 연락은 010-0000-0115로 하면 된다고 하심",
    },
  ],
};
