import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AlertLevel } from "../../lib/domain";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  AdminControls,
  pushDispatchMessage,
  requestDemoTrigger,
} from "./AdminControls";

describe("requestDemoTrigger", () => {
  it("발령 결과 토스트는 잠시 뒤 화면을 가리지 않도록 닫힌다", () => {
    const source = readFileSync(new URL("./AdminControls.tsx", import.meta.url), "utf8");
    expect(source).toContain("window.setTimeout");
    expect(source).toContain("3_000");
  });

  it("경보 단계 세 개를 즉시 발령하는 버튼으로 제공한다", () => {
    const html = renderToStaticMarkup(
      createElement(AdminControls, { date: "2026-08-22" }),
    );

    expect(html).toContain('aria-label="주의 단계 발령"');
    expect(html).toContain('aria-label="경계 단계 발령"');
    expect(html).toContain('aria-label="심각 단계 발령"');
    expect(html).not.toContain("<select");
  });

  it("선택 날짜와 도메인 경보 단계를 보내고 Push 결과를 돌려받는다", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        data: { alerted: true, targetDate: "2026-08-22" },
        push: { configured: true, claimed: 2, sent: 2, failed: 0 },
      }),
    );

    const result = await requestDemoTrigger(
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
    expect(result).toEqual({ configured: true, claimed: 2, sent: 2, failed: 0 });
  });

  it("발령 성공과 Push 결과를 구분해 관리자에게 알린다", () => {
    expect(pushDispatchMessage(null)).toBe(
      "경보는 발령됐지만 Push 발송 상태를 확인하지 못했습니다.",
    );
    expect(
      pushDispatchMessage({ configured: false, claimed: 0, sent: 0, failed: 0 }),
    ).toBe("경보는 발령됐지만 Push 환경 변수가 설정되지 않았습니다.");
    expect(
      pushDispatchMessage({ configured: true, claimed: 0, sent: 0, failed: 0 }),
    ).toBe("경보를 발령했습니다. 전송할 Push 알림이 없습니다.");
    expect(
      pushDispatchMessage({ configured: true, claimed: 2, sent: 0, failed: 0 }),
    ).toBe("경보는 발령됐지만 구독된 기기가 없습니다.");
    expect(
      pushDispatchMessage({ configured: true, claimed: 3, sent: 2, failed: 1 }),
    ).toBe("경보 발령 · Push 성공 2건 · 실패 1건");
    expect(
      pushDispatchMessage({ configured: true, claimed: 2, sent: 2, failed: 0 }),
    ).toBe("경보 발령 · Push 2건 전송");
    expect(
      pushDispatchMessage({
        configured: true,
        claimed: 1,
        sent: 1,
        failed: 0,
        partialFailures: 1,
      }),
    ).toBe("경보 발령 · Push 성공 1건 · 부분 실패 1건");
  });

  it("음수인 Push 집계는 신뢰하지 않는다", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        data: { alerted: true },
        push: { configured: true, claimed: 1, sent: -1, failed: 0 },
      }),
    );

    await expect(
      requestDemoTrigger(
        { date: "2026-08-22", level: AlertLevel.WARNING },
        fetcher,
      ),
    ).resolves.toBeNull();
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
