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
      href: "/today/s?date=2026-08-22&workerId=w",
    });
  });
});
