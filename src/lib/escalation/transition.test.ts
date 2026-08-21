import { describe, expect, it } from "vitest";
import { CallResult, CheckKind, HouseholdStatus, VisitResult } from "../domain";
import { transition, TransitionError } from "./transition";

const call = (
  current: HouseholdStatus,
  result: CallResult,
  callAttempts = 0,
) => transition({ current, callAttempts, kind: CheckKind.CALL, result });

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

    const second = call(HouseholdStatus.NO_ANSWER_1, CallResult.NO_ANSWER, 1);
    expect(second.status).toBe(HouseholdStatus.VISIT_QUEUED);
    expect(second.callAttempts).toBe(2);
    expect(second.promoted).toBe(true);
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

  it("연락두절은 승격이 아니라 별도 상태다", () => {
    const r = call(HouseholdStatus.UNCHECKED, CallResult.UNREACHABLE);
    expect(r.status).toBe(HouseholdStatus.UNREACHABLE);
    expect(r.promoted).toBe(false);
  });

  it("방문 대상(1등급·승격) 가구에는 전화 기록을 남길 수 없다 — 허위 안심 차단 (PRD F3)", () => {
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
