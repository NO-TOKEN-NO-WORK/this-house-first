import { describe, expect, it } from "vitest";
import { NotificationType } from "../domain";
import { pushPayload } from "./payload";

describe("pushPayload", () => {
  it("승격 사건의 저장된 문구·딥링크와 중복 방지 태그만 전달한다", () => {
    expect(
      JSON.parse(
        pushPayload({
          eventKey: "VISIT_PROMOTED:a:s:m",
          type: NotificationType.VISIT_PROMOTED,
          title: "방문 확인 대상이 추가됐습니다",
          body: "박○○ 대상자가 무응답 2회로 방문 대기 상태가 됐습니다.",
          href: "/today/s?date=2026-08-22&workerId=w",
        }),
      ),
    ).toMatchObject({
      tag: "VISIT_PROMOTED:a:s:m",
      urgent: true,
      renotify: true,
      href: "/today/s?date=2026-08-22&workerId=w",
    });
  });

  it("같은 경보일 요약을 수동 재전송해도 기기에 다시 알리도록 표시한다", () => {
    expect(
      JSON.parse(
        pushPayload({
          eventKey: "ALERT_DAY_SUMMARY:a:w",
          type: NotificationType.ALERT_DAY_SUMMARY,
          title: "오늘은 폭염 비상 단계입니다",
          body: "오늘 확인이 필요합니다.",
          href: "/today?date=2026-08-22&workerId=w",
        }),
      ),
    ).toMatchObject({
      tag: "ALERT_DAY_SUMMARY:a:w",
      renotify: true,
    });
  });
});
