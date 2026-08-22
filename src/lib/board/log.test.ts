import { describe, expect, it } from "vitest";
import {
  CALL_RESULT_LABEL,
  CHECK_KIND_LABEL,
  CallResult,
  CheckKind,
  VISIT_RESULT_LABEL,
  VisitResult,
} from "../domain";
import { formatBoardDate } from "./format";
import { groupLogItems, type LogEventRow, toLogItems } from "./log";

const WORKER = "worker-1";
const OTHER = "worker-2";

function row(
  overrides: Partial<LogEventRow> & Pick<LogEventRow, "id">,
): LogEventRow {
  return {
    workerId: WORKER,
    subjectId: "sub-1",
    subjectName: "김○○",
    alertDate: "2026-08-21",
    kind: CheckKind.CALL,
    result: CallResult.OK,
    createdAt: new Date("2026-08-21T01:00:00.000Z"),
    ...overrides,
  };
}

describe("toLogItems", () => {
  it("전화 정상 라벨은 도메인 상수와 같다", () => {
    const [item] = toLogItems(
      [row({ id: "e1", kind: CheckKind.CALL, result: CallResult.OK })],
      WORKER,
    );

    expect(item.kindLabel).toBe(CHECK_KIND_LABEL[CheckKind.CALL]);
    expect(item.resultLabel).toBe(CALL_RESULT_LABEL[CallResult.OK]);
    expect(item.dateLabel).toBe(formatBoardDate("2026-08-21"));
  });

  it("방문 에어컨 없음·고장 라벨은 도메인 상수와 같다", () => {
    const [item] = toLogItems(
      [
        row({
          id: "e2",
          kind: CheckKind.VISIT,
          result: VisitResult.AIRCON_ISSUE,
        }),
      ],
      WORKER,
    );

    expect(item.kindLabel).toBe(CHECK_KIND_LABEL[CheckKind.VISIT]);
    expect(item.resultLabel).toBe(VISIT_RESULT_LABEL[VisitResult.AIRCON_ISSUE]);
  });

  it("가장 최근 기록이 앞에 온다", () => {
    const items = toLogItems(
      [
        row({
          id: "old",
          createdAt: new Date("2026-08-21T01:00:00.000Z"),
        }),
        row({
          id: "new",
          createdAt: new Date("2026-08-21T03:00:00.000Z"),
        }),
      ],
      WORKER,
    );

    expect(items.map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("입력이 비면 출력도 비어 있다 — 행을 만들지 않는다", () => {
    expect(toLogItems([], WORKER)).toEqual([]);
  });

  it("선택한 담당자가 아닌 기록은 빠진다", () => {
    const items = toLogItems(
      [
        row({ id: "mine", workerId: WORKER }),
        row({
          id: "theirs",
          workerId: OTHER,
          subjectName: "박○○",
        }),
      ],
      WORKER,
    );

    expect(items.map((item) => item.id)).toEqual(["mine"]);
    expect(items.some((item) => item.subjectName === "박○○")).toBe(false);
  });

  it("종류·결과가 도메인에 없으면 라벨을 지어내지 않고 뺀다", () => {
    const items = toLogItems(
      [
        row({ id: "bad-kind", kind: "FAX" }),
        row({ id: "bad-result", result: "MAYBE" }),
        row({ id: "ok" }),
      ],
      WORKER,
    );

    expect(items.map((item) => item.id)).toEqual(["ok"]);
  });
});

describe("groupLogItems", () => {
  it("경보일별로 묶고 최근 날짜가 앞에 온다", () => {
    const items = toLogItems(
      [
        row({
          id: "d21-late",
          alertDate: "2026-08-21",
          createdAt: new Date("2026-08-21T08:00:00.000Z"),
        }),
        row({
          id: "d20",
          alertDate: "2026-08-20",
          createdAt: new Date("2026-08-20T12:00:00.000Z"),
        }),
        row({
          id: "d21-early",
          alertDate: "2026-08-21",
          createdAt: new Date("2026-08-21T02:00:00.000Z"),
        }),
      ],
      WORKER,
    );
    const groups = groupLogItems(items);

    expect(groups.map((g) => g.date)).toEqual(["2026-08-21", "2026-08-20"]);
    expect(groups[0]?.dateLabel).toBe(formatBoardDate("2026-08-21"));
    expect(groups[0]?.items.map((item) => item.id)).toEqual([
      "d21-late",
      "d21-early",
    ]);
    expect(groups[1]?.items.map((item) => item.id)).toEqual(["d20"]);
  });

  it("빈 목록은 빈 그룹이다", () => {
    expect(groupLogItems([])).toEqual([]);
  });
});
