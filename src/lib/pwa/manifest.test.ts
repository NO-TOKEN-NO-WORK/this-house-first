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
});
