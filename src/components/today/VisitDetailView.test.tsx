import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SubjectDetail } from "@/lib/board/subject";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  CALL_RESULT_LABEL,
  CallResult,
  CHECK_KIND_LABEL,
  CheckKind,
  GRADE_PLAN,
  GRADE_SEVERITY_LABEL,
  HOUSEHOLD_STATUS_LABEL,
  HouseholdStatus,
  RiskGrade,
  VISIT_CHECKLIST,
  VISIT_RESULT_LABEL,
  VisitResult,
} from "@/lib/domain";
import { ReasonCategory } from "@/lib/scoring/reasons";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { VisitDetailView } from "./VisitDetailView";

const detail: SubjectDetail = {
  subjectId: "subject-1",
  name: "김○○",
  age: 88,
  birthYear: 1938,
  livesAlone: true,
  phone: "010-0000-0199",
  address: "행복동 중앙로 12-3",
  roadAddress: null,
  dong: "행복동",
  date: "2026-08-22",
  dateLabel: "8월 22일(토)",
  alerted: true,
  levelLabel: ALERT_LEVEL_LABEL[AlertLevel.EMERGENCY],
  feelsLikeMax: 38,
  assessment: {
    grade: RiskGrade.CRITICAL,
    severityLabel: GRADE_SEVERITY_LABEL[RiskGrade.CRITICAL],
    plan: GRADE_PLAN[RiskGrade.CRITICAL],
    score: 42,
    reasons: [
      { category: ReasonCategory.PERSONAL, text: "88세 · 독거" },
      {
        category: ReasonCategory.BUILDING,
        text: "1972년 단독주택 · 슬레이트 지붕",
      },
      {
        category: ReasonCategory.WEATHER,
        text: "체감온도 38℃ · 비상경보",
      },
    ],
  },
  status: HouseholdStatus.VISIT_QUEUED,
  statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED],
  callAttempts: 0,
  open: true,
  nextCheckKind: CheckKind.VISIT,
  lastResult: null,
  recentHistory: [
    {
      id: "check-1",
      date: "2026-08-20",
      dateLabel: "8/20 (목)",
      kind: CheckKind.VISIT,
      kindLabel: CHECK_KIND_LABEL[CheckKind.VISIT],
      result: VisitResult.AIRCON_ISSUE,
      resultLabel: VISIT_RESULT_LABEL[VisitResult.AIRCON_ISSUE],
      memo: "에어컨 고장 확인",
    },
    {
      id: "check-2",
      date: "2026-08-19",
      dateLabel: "8/19 (수)",
      kind: CheckKind.CALL,
      kindLabel: CHECK_KIND_LABEL[CheckKind.CALL],
      result: CallResult.OK,
      resultLabel: CALL_RESULT_LABEL[CallResult.OK],
      memo: null,
    },
  ],
  gradeChange: {
    previousGrade: RiskGrade.HIGH,
    currentGrade: RiskGrade.CRITICAL,
  },
};

describe("VisitDetailView", () => {
  it("Figma 방문 화면의 섹션을 순서대로 보여 준다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView detail={detail} backHref="/today?date=2026-08-22" />,
    );

    expect(html).toContain("방문하기");
    expect(html).toContain("오늘 위험 단계가 올라갔어요");
    expect(html).toContain("위험 사유");
    expect(html).toContain("방문 체크리스트");
    expect(html).toContain("방문 히스토리");
    expect(html).toContain("방문 결과를 눌러 기록하세요");
    expect(html).toContain("메모 (선택)");
  });

  it("위험 사유와 체크리스트 문구를 원본 그대로 표시한다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView detail={detail} backHref="/today" />,
    );

    for (const reason of detail.assessment?.reasons ?? []) {
      expect(html).toContain(reason.text);
    }
    for (const item of VISIT_CHECKLIST) {
      expect(html).toContain(item);
    }
  });

  it("방문 결과 문구는 도메인 상수만 쓰고 결과 버튼이 바로 저장한다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView detail={detail} backHref="/today" />,
    );

    for (const label of Object.values(VISIT_RESULT_LABEL)) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("저장하기");
    expect(html).not.toMatch(
      /<button[^>]* disabled=""[^>]*>.*정상.*<\/button>/,
    );
  });

  it("최근 기록은 결과 라벨을 항상 보여 주고 메모를 함께 표시한다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView detail={detail} backHref="/today" />,
    );

    expect(html).toContain("에어컨 고장 확인");
    expect(html).toContain(VISIT_RESULT_LABEL[VisitResult.AIRCON_ISSUE]);
    expect(html).toContain(CALL_RESULT_LABEL[CallResult.OK]);
  });
});
