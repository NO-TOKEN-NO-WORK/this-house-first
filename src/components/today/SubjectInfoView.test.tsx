import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SubjectDetail } from "@/lib/board/subject";
import {
  AlertLevel,
  ALERT_LEVEL_LABEL,
  BriefingCategory,
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
import { SubjectInfoView } from "./SubjectInfoView";
import { BriefingPanel } from "./SubjectInformationTabs";

const detail: SubjectDetail = {
  subjectId: "subject-info",
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
      id: "visit-1",
      date: "2026-08-20",
      dateLabel: "8/20 (목)",
      kind: CheckKind.VISIT,
      kindLabel: CHECK_KIND_LABEL[CheckKind.VISIT],
      result: VisitResult.AIRCON_ISSUE,
      resultLabel: VISIT_RESULT_LABEL[VisitResult.AIRCON_ISSUE],
      memo: "에어컨 고장 확인",
    },
    {
      id: "call-1",
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

describe("SubjectInfoView", () => {
  it("Figma 대상자 정보 섹션을 읽기 전용으로 보여 준다", () => {
    const html = renderToStaticMarkup(
      <SubjectInfoView detail={detail} backHref="/today?date=2026-08-22" />,
    );

    expect(html).toContain("대상자 정보");
    expect(html).toContain("오늘 위험 단계가 올라갔어요");
    expect(html).toContain("위험 사유");
    expect(html).toContain("방문 체크리스트");
    expect(html).toContain("방문 히스토리");
    expect(html).not.toContain("방문 결과를 눌러 기록하세요");
    expect(html).not.toContain("메모 (선택)");
  });

  it("위험 사유·체크리스트·히스토리 문구의 단일 원본을 그대로 표시한다", () => {
    const html = renderToStaticMarkup(
      <SubjectInfoView detail={detail} backHref="/today" />,
    );

    for (const reason of detail.assessment?.reasons ?? []) {
      expect(html).toContain(reason.text);
    }
    for (const item of VISIT_CHECKLIST) {
      expect(html).toContain(item);
    }
    expect(html).toContain(VISIT_RESULT_LABEL[VisitResult.AIRCON_ISSUE]);
    expect(html).toContain(CALL_RESULT_LABEL[CallResult.OK]);
  });

  it("검증된 맥락 문장에 서버가 만든 근거를 함께 표시한다", () => {
    const html = renderToStaticMarkup(
      <BriefingPanel
        loading={false}
        briefing={{
          generatedAt: "2026-08-23T00:00:00.000Z",
          todayPrompt: null,
          handover: [{
            category: BriefingCategory.CAUTION,
            categoryLabel: "조심할 것",
            text: "최근 무릎 불편으로 외출이 줄었다고 했어요.",
            source: {
              checkEventId: "call-1",
              date: "2026-08-19",
              dateLabel: "8/19 (수)",
              kind: CheckKind.CALL,
              kindLabel: "전화",
              result: CallResult.OK,
              resultLabel: "괜찮았어요",
              label: "8/19 (수) 전화 · 괜찮았어요",
            },
          }],
          conversationSummaries: [],
        }}
      />,
    );

    expect(html).toContain("한눈에 보기");
    expect(html).toContain("조심할 것");
    expect(html).toContain("최근 무릎 불편");
    expect(html).toContain("근거 · 8/19 (수) 전화 · 괜찮았어요");
  });
});
