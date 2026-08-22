import {
  CALL_RESULT_LABEL,
  CHECK_KIND_LABEL,
  type CallResult,
  CheckKind,
  isCallResult,
  isCheckKind,
  isVisitResult,
  VISIT_RESULT_LABEL,
  type VisitResult,
} from "../domain";
import { formatBoardDate } from "./format";

/**
 * 담당자 기록 탭용 화면 모델 — 순수 변환만 (Prisma·네트워크 없음).
 *
 * 원터치 기록 자체는 `/today/[subjectId]` + `POST /api/checks`가 담당한다.
 * 여기서는 이미 남은 CheckEvent 행만 라벨·정렬·담당자 필터한다.
 * 비경보일은 행이 없으므로 빈 목록이 맞다.
 */

/** Prisma 조회 결과를 화면 모델로 바꾸기 전에 쓰는 평탄한 행 */
export interface LogEventRow {
  id: string;
  workerId: string;
  subjectId: string;
  subjectName: string;
  /** AlertDay.date "YYYY-MM-DD" */
  alertDate: string;
  kind: string;
  result: string;
  createdAt: Date;
}

export interface LogListItem {
  id: string;
  subjectId: string;
  subjectName: string;
  alertDate: string;
  dateLabel: string;
  kind: CheckKind;
  kindLabel: string;
  result: CallResult | VisitResult;
  resultLabel: string;
  createdAt: Date;
}

export interface LogGroup {
  date: string;
  dateLabel: string;
  items: LogListItem[];
}

export interface LogView {
  /** 오늘 탭과 왕복할 때 쓰는 날짜 문맥 "YYYY-MM-DD" */
  date: string;
  dateLabel: string;
  worker: { id: string; name: string } | null;
  items: LogListItem[];
  groups: LogGroup[];
}

function toItem(
  row: LogEventRow,
): Omit<LogListItem, "kind" | "kindLabel" | "result" | "resultLabel"> {
  return {
    id: row.id,
    subjectId: row.subjectId,
    subjectName: row.subjectName,
    alertDate: row.alertDate,
    dateLabel: formatBoardDate(row.alertDate),
    createdAt: row.createdAt,
  };
}

/**
 * 확인 기록 행 → 화면 모델.
 * 선택한 담당자의 것만, 도메인에 있는 종류·결과만, 최신이 앞. 빈 입력은 빈 출력.
 */
export function toLogItems(
  rows: readonly LogEventRow[],
  selectedWorkerId: string,
): LogListItem[] {
  const items: LogListItem[] = [];
  for (const row of rows) {
    if (row.workerId !== selectedWorkerId) continue;
    if (!isCheckKind(row.kind)) continue;
    const base = toItem(row);
    if (row.kind === CheckKind.CALL) {
      if (!isCallResult(row.result)) continue;
      items.push({
        ...base,
        kind: CheckKind.CALL,
        kindLabel: CHECK_KIND_LABEL[CheckKind.CALL],
        result: row.result,
        resultLabel: CALL_RESULT_LABEL[row.result],
      });
      continue;
    }
    if (!isVisitResult(row.result)) continue;
    items.push({
      ...base,
      kind: CheckKind.VISIT,
      kindLabel: CHECK_KIND_LABEL[CheckKind.VISIT],
      result: row.result,
      resultLabel: VISIT_RESULT_LABEL[row.result],
    });
  }
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items;
}

/** 경보일 날짜로 묶는다. 최근 날짜가 앞, 그룹 안은 이미 최신순인 items를 유지한다. */
export function groupLogItems(items: readonly LogListItem[]): LogGroup[] {
  const byDate = new Map<string, LogListItem[]>();
  for (const item of items) {
    const list = byDate.get(item.alertDate);
    if (list) list.push(item);
    else byDate.set(item.alertDate, [item]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, groupItems]) => ({
      date,
      dateLabel: groupItems[0]?.dateLabel ?? formatBoardDate(date),
      items: groupItems,
    }));
}


