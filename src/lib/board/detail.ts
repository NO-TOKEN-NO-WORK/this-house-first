import {
  GRADE_PLAN,
  GRADE_SEVERITY_LABEL,
  isOpenHouseholdStatus,
  nextCheckKindOf,
  type HouseholdStatus,
} from "../domain";
import { labelReasons } from "../scoring/reasons";
import { dongOf } from "./format";
import type { SubjectDetail } from "./subject";
import type { AlertedBoard, Board, BoardSubject } from "./today";

/** POST /api/checks 성공 응답 + 방금 누른 결과값 */
export interface CheckOutcome {
  status: HouseholdStatus;
  statusLabel: string;
  callAttempts: number;
  result: string;
}

/**
 * 보드가 이미 가진 대상자 한 명으로 상세 화면 데이터를 만든다.
 * 클릭 때 서버를 다시 치지 않기 위한 변환이라, 사유 문장은 보드 값을 그대로 둔다.
 */
export function detailFromBoard(
  subject: BoardSubject,
  board: AlertedBoard,
): SubjectDetail {
  return {
    subjectId: subject.subjectId,
    name: subject.name,
    age: subject.age,
    birthYear: subject.birthYear,
    livesAlone: subject.livesAlone,
    phone: subject.phone,
    address: subject.address,
    roadAddress: subject.roadAddress,
    dong: dongOf(subject.address),
    date: board.date,
    dateLabel: board.dateLabel,
    alerted: true,
    levelLabel: board.levelLabel,
    feelsLikeMax: board.feelsLikeMax,
    assessment: {
      grade: subject.grade,
      severityLabel: GRADE_SEVERITY_LABEL[subject.grade],
      plan: GRADE_PLAN[subject.grade],
      score: subject.score,
      reasons: labelReasons(subject.reasons),
    },
    status: subject.status,
    statusLabel: subject.statusLabel,
    callAttempts: subject.callAttempts,
    open: subject.open,
    nextCheckKind: nextCheckKindOf(subject.status),
    lastResult: subject.lastResult,
    // 보드의 빠른 상세는 전화 흐름용이다. 방문 버튼은 서버 상세로 이동해 이 두 값을 채운다.
    recentHistory: [],
    gradeChange: null,
  };
}

/** 원터치 기록 응답으로 상세 상태를 갱신한다 — 승격 시 같은 화면에서 방문 버튼으로 바뀐다 */
export function applyCheckOutcome(
  detail: SubjectDetail,
  outcome: CheckOutcome,
): SubjectDetail {
  const open = isOpenHouseholdStatus(outcome.status);
  return {
    ...detail,
    status: outcome.status,
    statusLabel: outcome.statusLabel,
    callAttempts: outcome.callAttempts,
    open,
    nextCheckKind: nextCheckKindOf(outcome.status),
    lastResult: outcome.result,
  };
}

export function findBoardSubject(
  board: AlertedBoard,
  subjectId: string,
): BoardSubject | null {
  for (const group of board.groups) {
    const found = group.subjects.find((row) => row.subjectId === subjectId);
    if (found) return found;
  }
  return null;
}

/** 서버 보드가 평상시로 바뀌면 클라이언트에 남은 데모 상세를 즉시 닫는다. */
export function resolveWorkspaceDetail(
  board: Board,
  selectedId: string | null,
  override: SubjectDetail | null,
): SubjectDetail | null {
  if (!board.alerted) return null;
  if (override) return override;
  if (!selectedId) return null;
  const subject = findBoardSubject(board, selectedId);
  return subject ? detailFromBoard(subject, board) : null;
}
