import { describe, expect, it, vi } from "vitest";
import { registerNotificationServiceWorker } from "./ServiceWorkerRegistrar";

describe("registerNotificationServiceWorker", () => {
  it("기존 부분 scope를 정리한 뒤 알림용 루트 scope로 등록한다", async () => {
    const unregisterRoot = vi.fn().mockResolvedValue(true);
    const unregisterToday = vi.fn().mockResolvedValue(true);
    const unregisterOther = vi.fn().mockResolvedValue(true);
    const serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([
        { scope: "https://example.com/", unregister: unregisterRoot },
        { scope: "https://example.com/today", unregister: unregisterToday },
        { scope: "https://example.com/other", unregister: unregisterOther },
      ]),
      register: vi.fn().mockResolvedValue({}),
    };

    await registerNotificationServiceWorker(serviceWorker);

    expect(unregisterRoot).not.toHaveBeenCalled();
    expect(unregisterToday).toHaveBeenCalledOnce();
    expect(unregisterOther).not.toHaveBeenCalled();
    expect(serviceWorker.register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });
});
