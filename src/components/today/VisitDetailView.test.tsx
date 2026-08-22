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
  COOLING_STATUS_LABEL,
  VISIT_CHECKLIST,
  VISIT_RECORD_RESULTS,
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
  it("Figma 113:2222의 섹션을 순서대로 보여 준다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView detail={detail} backHref="/today?date=2026-08-22" />,
    );

    const order = [
      "방문하기",
      "오늘 위험 단계가 올라갔어요",
      "위험 사유",
      "방문 체크리스트",
      "방문 히스토리",
      "방문 상황을 기록하세요",
      "냉방기 설비 상태 점검",
      "메모 (선택)",
      "저장하기",
    ];
    let cursor = -1;
    for (const section of order) {
      const at = html.indexOf(section, cursor + 1);
      expect(at, `${section}이(가) 순서대로 없다`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("위험 사유와 체크리스트 문구를 원본 그대로 표시한다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView detail={detail} backHref="/today" />,
    );

    for (const reason of detail.assessment?.reasons ?? []) {
      expect(html).toContain(reason.text);
    }
    for (const item of VISIT_CHECKLIST) {
      // 굵은 앞부분과 이어지는 설명이 모두 domain.ts 원본 그대로여야 한다
      expect(html).toContain(item.emphasis);
      expect(html).toContain(item.rest.trimStart());
    }
  });

  it("방문 결과·냉방기 문구는 도메인 상수만 쓴다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView detail={detail} backHref="/today" />,
    );

    for (const value of VISIT_RECORD_RESULTS) {
      expect(html).toContain(VISIT_RESULT_LABEL[value]);
    }
    for (const label of Object.values(COOLING_STATUS_LABEL)) {
      expect(html).toContain(label);
    }
  });

  it("결과·냉방기를 고르기 전에는 저장하기를 누를 수 없다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView detail={detail} backHref="/today" />,
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>저장하기<\/button>/);
  });

  /** 오늘 남긴 방문 기록 — 되읽기 화면이 여기서 결과·메모를 가져온다 */
  const todayVisit = {
    id: "check-0",
    date: detail.date,
    dateLabel: "8/22 (토)",
    kind: CheckKind.VISIT,
    kindLabel: CHECK_KIND_LABEL[CheckKind.VISIT],
    result: VisitResult.ABSENT,
    resultLabel: VISIT_RESULT_LABEL[VisitResult.ABSENT],
    memo: "문을 두드렸지만 인기척 없음",
  };

  it("되읽기 화면(123:2971)은 저장 없이 기록한 결과·메모를 보여 준다", () => {
    const html = renderToStaticMarkup(
      <VisitDetailView
        detail={{ ...detail, recentHistory: [todayVisit, ...detail.recentHistory] }}
        backHref="/today"
        readOnly
      />,
    );

    expect(html).toContain("방문 기록");
    expect(html).not.toContain("저장하기");
    expect(html).toContain(todayVisit.memo);
    // 기록한 결과 버튼만 눌린 상태(aria-pressed)로 남는다
    expect(html).toMatch(
      new RegExp(
        `aria-pressed="true"[^>]*disabled=""[^>]*>(?:(?!</button>).)*${VISIT_RESULT_LABEL[VisitResult.ABSENT]}`,
        "s",
      ),
    );
  });

  it("되읽기 화면은 오늘 마지막 확인이 전화면 결과를 고르지 않는다", () => {
    /*
      전화·방문 결과는 문자열이 겹친다(OK·SYMPTOM·EMERGENCY_119). `lastResult`를 그대로
      믿으면 주소로 ?view=record에 들어왔을 때 통화 결과가 방문 결과로 보인다.
    */
    const html = renderToStaticMarkup(
      <VisitDetailView
        detail={{ ...detail, lastResult: CallResult.OK, recentHistory: [] }}
        backHref="/today"
        readOnly
      />,
    );

    expect(html).not.toContain('aria-pressed="true"');
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
