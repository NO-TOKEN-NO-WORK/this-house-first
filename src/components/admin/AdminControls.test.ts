import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AlertLevel } from "../../lib/domain";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { AdminControls, requestDemoTrigger } from "./AdminControls";

describe("requestDemoTrigger", () => {
  it("경보 단계 세 개를 즉시 발령하는 버튼으로 제공한다", () => {
    const html = renderToStaticMarkup(
      createElement(AdminControls, { date: "2026-08-22" }),
    );

    expect(html).toContain('aria-label="주의 단계 발령"');
    expect(html).toContain('aria-label="경계 단계 발령"');
    expect(html).toContain('aria-label="심각 단계 발령"');
    expect(html).not.toContain("<select");
  });

  it("선택 날짜와 도메인 경보 단계를 기존 트리거 API로 보낸다", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ data: { alerted: true, targetDate: "2026-08-22" } }),
    );

    await requestDemoTrigger(
      { date: "2026-08-22", level: AlertLevel.EMERGENCY },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledWith("/api/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetDate: "20260822",
        level: AlertLevel.EMERGENCY,
      }),
    });
  });

  it("트리거 API 오류 메시지를 사용자에게 전달한다", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        { error: { code: "NO_SUBJECTS", message: "대상자가 없습니다." } },
        { status: 409 },
      ),
    );

    await expect(
      requestDemoTrigger(
        { date: "2026-08-22", level: AlertLevel.WARNING },
        fetcher,
      ),
    ).rejects.toThrow("대상자가 없습니다.");
  });

  it("오류 본문이 올바르지 않으면 발령 실패를 사실대로 알린다", async () => {
    const fetcher = vi.fn(async () => new Response("not json", { status: 500 }));

    await expect(
      requestDemoTrigger(
        { date: "2026-08-22", level: AlertLevel.ADVISORY },
        fetcher,
      ),
    ).rejects.toThrow("데모 경보를 발령하지 못했습니다.");
  });

  it("오류 메시지가 비어 있으면 발령 실패를 사실대로 알린다", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ error: { message: "" } }, { status: 500 }),
    );

    await expect(
      requestDemoTrigger(
        { date: "2026-08-22", level: AlertLevel.ADVISORY },
        fetcher,
      ),
    ).rejects.toThrow("데모 경보를 발령하지 못했습니다.");
  });
});
