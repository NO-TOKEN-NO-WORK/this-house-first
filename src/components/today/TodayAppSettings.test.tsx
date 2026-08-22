import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/InstallPwaBanner", () => ({
  InstallPwaBanner: () => <section>홈 화면에 앱 설치</section>,
}));

vi.mock("@/components/PushNotificationManager", () => ({
  PushNotificationManager: () => <section>푸시 알림</section>,
}));

import { TodayAppSettings } from "./TodayAppSettings";

describe("TodayAppSettings", () => {
  it("설치와 알림을 기본으로 닫힌 하나의 후순위 진입점에 모은다", () => {
    const html = renderToStaticMarkup(
      <TodayAppSettings workerId="worker-1" publicKey="public-key" />,
    );

    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("홈 화면에 앱 설치");
    expect(html).toContain("푸시 알림");
    expect(html).toContain("홈 화면 설치 · 푸시 알림");
    expect(html).toContain("설정");
  });

  it("담당자가 선택되지 않으면 푸시 설정을 표시하지 않는다", () => {
    const html = renderToStaticMarkup(
      <TodayAppSettings publicKey="public-key" />,
    );

    expect(html).toContain("홈 화면에 앱 설치");
    expect(html).not.toContain("<section>푸시 알림</section>");
  });
});
