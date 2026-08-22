import { describe, expect, it } from "vitest";
import { CallResult, CheckKind, HouseholdStatus, VisitResult } from "../domain";
import {
  NO_ANSWER_RETRY_INTERVAL_MS,
  transition,
  TransitionError,
} from "./transition";

const NOW = new Date("2026-08-22T01:00:00.000Z");

const call = (
  current: HouseholdStatus,
  result: CallResult,
  callAttempts = 0,
  lastCallAt: Date | null = null,
) =>
  transition({
    current,
    callAttempts,
    kind: CheckKind.CALL,
    result,
    now: NOW,
    lastCallAt,
  });

const visit = (current: HouseholdStatus, result: VisitResult) =>
  transition({ current, callAttempts: 0, kind: CheckKind.VISIT, result });

describe("전화 기록 전이", () => {
  it("정상이면 전화 확인 완료", () => {
    const r = call(HouseholdStatus.UNCHECKED, CallResult.OK);
    expect(r.status).toBe(HouseholdStatus.CALL_OK);
    expect(r.promoted).toBe(false);
  });

  it("무응답 1회는 재전화 대기, 2회면 방문 큐로 자동 승격 (PRD F4)", () => {
    const first = call(HouseholdStatus.UNCHECKED, CallResult.NO_ANSWER, 0);
    expect(first.status).toBe(HouseholdStatus.NO_ANSWER_1);
    expect(first.callAttempts).toBe(1);
    expect(first.promoted).toBe(false);

    const second = call(
      HouseholdStatus.NO_ANSWER_1,
      CallResult.NO_ANSWER,
      1,
      new Date(NOW.getTime() - NO_ANSWER_RETRY_INTERVAL_MS),
    );
    expect(second.status).toBe(HouseholdStatus.VISIT_QUEUED);
    expect(second.callAttempts).toBe(2);
    expect(second.promoted).toBe(true);
  });

  it("첫 무응답 후 30분 전에는 두 번째 무응답 기록·승격을 막는다", () => {
    const lastCallAt = new Date(
      NOW.getTime() - NO_ANSWER_RETRY_INTERVAL_MS + 1,
    );

    expect(() =>
      call(
        HouseholdStatus.NO_ANSWER_1,
        CallResult.NO_ANSWER,
        1,
        lastCallAt,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<TransitionError>>({
        code: "RETRY_TOO_SOON",
      }),
    );
  });

  it("무응답 상태인데 이전 전화 기록이 없으면 데이터 불일치로 거절한다", () => {
    expect(() =>
      call(HouseholdStatus.NO_ANSWER_1, CallResult.NO_ANSWER, 1),
    ).toThrowError(
      expect.objectContaining<Partial<TransitionError>>({
        code: "PREVIOUS_CALL_NOT_FOUND",
      }),
    );
  });

  it("무응답 1회 후 재전화가 닿으면 확인 완료로 빠진다", () => {
    const r = call(HouseholdStatus.NO_ANSWER_1, CallResult.OK, 1);
    expect(r.status).toBe(HouseholdStatus.CALL_OK);
  });

  it("이상 징후는 횟수와 무관하게 즉시 승격한다", () => {
    const r = call(HouseholdStatus.UNCHECKED, CallResult.SYMPTOM);
    expect(r.status).toBe(HouseholdStatus.VISIT_QUEUED);
    expect(r.promoted).toBe(true);
  });

  it("통화 중 119 신고는 방문의 119와 같은 상태로 종결된다", () => {
    const r = call(HouseholdStatus.UNCHECKED, CallResult.EMERGENCY_119);
    expect(r.status).toBe(HouseholdStatus.EMERGENCY_119);
    // 이미 응급 체계로 넘어갔으므로 방문 큐에 다시 올리지 않는다
    expect(r.promoted).toBe(false);
  });

  it("무응답 1회 뒤 재전화에서 119를 불러도 119 상태로 간다", () => {
    const r = call(HouseholdStatus.NO_ANSWER_1, CallResult.EMERGENCY_119, 1);
    expect(r.status).toBe(HouseholdStatus.EMERGENCY_119);
    expect(r.callAttempts).toBe(2);
  });

  it("연락두절은 승격이 아니라 별도 상태다", () => {
    const r = call(HouseholdStatus.UNCHECKED, CallResult.UNREACHABLE);
    expect(r.status).toBe(HouseholdStatus.UNREACHABLE);
    expect(r.promoted).toBe(false);
  });

  it("방문 대상(심각·승격) 가구에는 전화 기록을 남길 수 없다 — 허위 안심 차단 (PRD F3)", () => {
    expect(() => call(HouseholdStatus.VISIT_QUEUED, CallResult.OK)).toThrow(
      TransitionError,
    );
    expect(() => call(HouseholdStatus.VISITING, CallResult.OK)).toThrow(
      TransitionError,
    );
  });

  it("이미 종료된 가구에는 전화 기록을 추가할 수 없다", () => {
    for (const s of [
      HouseholdStatus.CALL_OK,
      HouseholdStatus.RESOLVED,
      HouseholdStatus.EMERGENCY_119,
      HouseholdStatus.UNREACHABLE,
    ]) {
      expect(() => call(s, CallResult.OK)).toThrow(TransitionError);
    }
  });
});

describe("방문 기록 전이", () => {
  it("정상·조치함은 조치 완료로 닫는다", () => {
    expect(visit(HouseholdStatus.VISIT_QUEUED, VisitResult.OK).status).toBe(
      HouseholdStatus.RESOLVED,
    );
    expect(visit(HouseholdStatus.VISITING, VisitResult.ACTED).status).toBe(
      HouseholdStatus.RESOLVED,
    );
  });

  it("119 연계는 별도 종료 상태다", () => {
    expect(
      visit(HouseholdStatus.VISIT_QUEUED, VisitResult.EMERGENCY_119).status,
    ).toBe(HouseholdStatus.EMERGENCY_119);
  });

  it("걱정돼요·안 계셨어요는 방문 큐에 그대로 남긴다 (ADR-0021)", () => {
    for (const result of [VisitResult.SYMPTOM, VisitResult.ABSENT]) {
      const r = visit(HouseholdStatus.VISIT_QUEUED, result);
      expect(r.status).toBe(HouseholdStatus.VISIT_QUEUED);
      // 이미 큐에 있던 가구라 새 승격이 아니다 — 관리자 알림이 중복으로 나가지 않는다
      expect(r.promoted).toBe(false);
      expect(r.airconIssue).toBe(false);
    }
    expect(visit(HouseholdStatus.VISITING, VisitResult.ABSENT).status).toBe(
      HouseholdStatus.VISIT_QUEUED,
    );
  });

  it("에어컨 없음·고장은 조치 완료로 닫되 익일 가중 플래그를 세운다 (FR-8)", () => {
    const r = visit(HouseholdStatus.VISIT_QUEUED, VisitResult.AIRCON_ISSUE);
    expect(r.status).toBe(HouseholdStatus.RESOLVED);
    expect(r.airconIssue).toBe(true);
  });

  it("방문 큐에 오르지 않은 가구에는 방문 결과를 기록할 수 없다", () => {
    for (const s of [
      HouseholdStatus.UNCHECKED,
      HouseholdStatus.NO_ANSWER_1,
      HouseholdStatus.CALL_OK,
      HouseholdStatus.RESOLVED,
    ]) {
      expect(() => visit(s, VisitResult.OK)).toThrow(TransitionError);
    }
  });
});

// TransitionInput의 kind-result 결합 제약은 런타임 테스트가 아니라 TypeScript가 검증한다.
if (false) {
  // @ts-expect-error 방문 결과는 전화 기록과 결합할 수 없다
  transition({
    current: HouseholdStatus.UNCHECKED,
    callAttempts: 0,
    kind: CheckKind.CALL,
    result: VisitResult.ACTED,
    now: NOW,
    lastCallAt: null,
  });
}
