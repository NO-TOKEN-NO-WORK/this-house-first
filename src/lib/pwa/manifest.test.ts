import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("담당자 PWA manifest", () => {
  it("방문 동선 화면을 PWA 탐색 범위에 포함한다", () => {
    const manifest = JSON.parse(
      readFileSync("public/today.webmanifest", "utf8"),
    ) as { scope: string };
    const origin = "https://example.com";
    const scope = new URL(manifest.scope, origin);
    const visitRoute = new URL("/map", origin);

    expect(
      visitRoute.origin === scope.origin &&
        visitRoute.pathname.startsWith(scope.pathname),
    ).toBe(true);
  });

  it("Chromium 설치 창에 필요한 192px·512px PNG 아이콘을 제공한다", () => {
    const manifest = JSON.parse(
      readFileSync("public/today.webmanifest", "utf8"),
    ) as { icons: { src: string; sizes: string; type: string }[] };

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        }),
      ]),
    );
  });
});
