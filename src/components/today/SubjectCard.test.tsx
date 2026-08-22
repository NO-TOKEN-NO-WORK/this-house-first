import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BoardSubject } from "@/lib/board/today";
import {
  CheckKind,
  HOUSEHOLD_STATUS_LABEL,
  HouseholdStatus,
  RiskGrade,
} from "@/lib/domain";
import { SubjectCard } from "./SubjectCard";

const subject: BoardSubject = {
  subjectId: "subject-visit",
  buildingId: "building-1",
  name: "김○○",
  age: 88,
  birthYear: 1938,
  livesAlone: true,
  phone: "010-0000-0199",
  address: "행복동 중앙로 12-3",
  roadAddress: null,
  lat: 35.8,
  lng: 128.5,
  grade: RiskGrade.CRITICAL,
  score: 42,
  reasons: ["88세 · 독거"],
  status: HouseholdStatus.VISIT_QUEUED,
  statusLabel: HOUSEHOLD_STATUS_LABEL[HouseholdStatus.VISIT_QUEUED],
  callAttempts: 0,
  open: true,
  nextCheckKind: CheckKind.VISIT,
  lastResult: null,
  lastCheckKind: null,
  lastCheckAtLabel: null,
};

describe("SubjectCard 방문하기", () => {
  it("선택한 날짜·담당자·필터를 보존해 방문 상세 라우트로 이동한다", () => {
    const html = renderToStaticMarkup(
      <SubjectCard
        subject={subject}
        grade={RiskGrade.CRITICAL}
        nextCheckKind={CheckKind.VISIT}
        date="2026-08-22"
        workerId="worker-1"
        returnGrade={RiskGrade.CRITICAL}
      />,
    );

    expect(html).toContain(
      'href="/today/subject-visit?date=2026-08-22&amp;workerId=worker-1&amp;grade=1"',
    );
    expect(html).toMatch(/<a[^>]*>.*방문하기.*<\/a>/);
  });

  it("chevron은 필터 문맥을 보존한 대상자 정보 화면으로 이동한다", () => {
    const html = renderToStaticMarkup(
      <SubjectCard
        subject={subject}
        grade={RiskGrade.CRITICAL}
        nextCheckKind={CheckKind.VISIT}
        date="2026-08-22"
        workerId="worker-1"
        returnGrade={RiskGrade.CRITICAL}
      />,
    );

    expect(html).toContain(
      'href="/today/subject-visit?date=2026-08-22&amp;workerId=worker-1&amp;grade=1&amp;view=info"',
    );
    expect(html).toContain('aria-label="김○○ 대상자 정보"');
    expect(html).toContain('/figma/chevron-right.svg');
  });
});
