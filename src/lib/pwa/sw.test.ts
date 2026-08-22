import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("today service worker activate", () => {
  it("다른 기능의 캐시는 남기고 기존 오늘 보드 캐시만 정리한다", async () => {
    let activate: ((event: { waitUntil(promise: Promise<void>): void }) => void) | undefined;
    let activation: Promise<void> | undefined;
    const remove = vi.fn().mockResolvedValue(true);
    const claim = vi.fn().mockResolvedValue(undefined);

    runInNewContext(readFileSync("public/sw.js", "utf8"), {
      URL,
      Response,
      caches: {
        keys: vi
          .fn()
          .mockResolvedValue([
            "unrelated-cache",
            "thf-v1",
            "thf-today-v0",
            "thf-today-v1",
            "thf-today-v2",
          ]),
        delete: remove,
      },
      fetch: vi.fn(),
      self: {
        addEventListener: (
          type: string,
          handler: (event: { waitUntil(promise: Promise<void>): void }) => void,
        ) => {
          if (type === "activate") activate = handler;
        },
        clients: { claim },
        location: { origin: "https://example.com" },
        skipWaiting: vi.fn(),
      },
    });

    expect(activate).toBeTypeOf("function");
    activate?.({
      waitUntil(promise) {
        activation = promise;
      },
    });
    await activation;

    expect(remove.mock.calls.map(([key]) => key)).toEqual([
      "thf-v1",
      "thf-today-v0",
      "thf-today-v1",
    ]);
    expect(claim).toHaveBeenCalledOnce();
  });

  it("Push 사건을 같은 eventKey 태그의 알림으로 표시한다", async () => {
    let push:
      | ((event: {
          data: { json(): unknown };
          waitUntil(promise: Promise<void>): void;
        }) => void)
      | undefined;
    let shown: Promise<void> | undefined;
    const showNotification = vi.fn().mockResolvedValue(undefined);

    runInNewContext(readFileSync("public/sw.js", "utf8"), {
      URL,
      Response,
      caches: { keys: vi.fn(), delete: vi.fn() },
      fetch: vi.fn(),
      self: {
        addEventListener: (type: string, handler: typeof push) => {
          if (type === "push") push = handler;
        },
        clients: { claim: vi.fn() },
        location: { origin: "https://example.com" },
        registration: { showNotification },
        skipWaiting: vi.fn(),
      },
    });

    push?.({
      data: {
        json: () => ({
          title: "방문 확인 대상이 추가됐습니다",
          body: "박○○ 대상자가 방문 대기 상태가 됐습니다.",
          tag: "VISIT_PROMOTED:a:s:m",
          href: "/today/s",
          urgent: true,
        }),
      },
      waitUntil(promise) {
        shown = promise;
      },
    });
    await shown;

    expect(showNotification).toHaveBeenCalledWith(
      "방문 확인 대상이 추가됐습니다",
      expect.objectContaining({
        tag: "VISIT_PROMOTED:a:s:m",
        renotify: true,
        data: { href: "/today/s" },
      }),
    );
  });
});
