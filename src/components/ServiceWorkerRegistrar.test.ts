import { describe, expect, it, vi } from "vitest";
import { registerTodayServiceWorker } from "./ServiceWorkerRegistrar";

describe("registerTodayServiceWorker", () => {
  it("기존 전역 등록을 정리한 뒤 오늘의 대응 보드 scope로 등록한다", async () => {
    const unregisterRoot = vi.fn().mockResolvedValue(true);
    const unregisterToday = vi.fn().mockResolvedValue(true);
    const serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([
        { scope: "https://example.com/", unregister: unregisterRoot },
        { scope: "https://example.com/today", unregister: unregisterToday },
      ]),
      register: vi.fn().mockResolvedValue({}),
    };

    await registerTodayServiceWorker(serviceWorker, "https://example.com");

    expect(unregisterRoot).toHaveBeenCalledOnce();
    expect(unregisterToday).not.toHaveBeenCalled();
    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js", {
      scope: "/today",
    });
  });
});
