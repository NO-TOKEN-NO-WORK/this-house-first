import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WelfareScanWorkspace } from "./WelfareScanWorkspace";

describe("복지 스캔 관리자 화면", () => {
  it("스캔 현황·필터·검토표와 선택한 제안의 근거를 한 화면에 제공한다", () => {
    const html = renderToStaticMarkup(
      <WelfareScanWorkspace
        initialRecommendations={[
          {
            subjectId: "subject-1",
            subjectName: "김○○",
            workerName: "이미경",
            programId: "energy-1",
            programName: "저소득층 에너지효율개선사업",
            ministry: "기후에너지환경부",
            programSummary: "냉방기기와 단열 개선을 지원합니다.",
            programLink: "https://www.bokjiro.go.kr/energy",
            status: "NEEDS_INFO",
            issues: ["COOLING_ISSUE"],
            evidence: ["에어컨에서 미지근한 바람만 나옴"],
            confirmedChecks: ["65세 이상", "냉방기기 없음 또는 고장"],
            missingChecks: ["기초생활수급 또는 차상위 여부"],
          },
        ]}
        previewMode
      />,
    );
    const navigation = html.match(/<nav[^>]*aria-label="관리자 메뉴"[^>]*>[\s\S]*?<\/nav>/)?.[0] ?? "";

    expect(html).toContain("복지 스캔");
    expect(html).toContain("복지 스캔 시작");
    expect(html).toContain("복지사업 정보 새로고침");
    expect(html).toMatch(/<h2[^>]*>복지 제안 검토<\/h2>/);
    expect(html).toContain("새로운 제안");
    expect(html).toContain("추가 정보 필요");
    expect(html).toContain("저소득층 에너지효율개선사업");
    expect(html).toContain("에어컨에서 미지근한 바람만 나옴");
    expect(html).toContain("기초생활수급 또는 차상위 여부");
    expect(navigation).toContain('href="/admin?preview=1"');
    expect(navigation).not.toContain("생활지원사");
    expect(navigation).not.toContain("대상자 관리");
    expect(navigation).not.toContain("통계 및 리포트");
    expect(navigation).not.toContain("설정 관리");
    expect(html).toMatch(
      /<a aria-current="page"[^>]*href="\/admin\/welfare-scan\?preview=1"[^>]*>[\s\S]*?복지 스캔[\s\S]*?<\/a>/,
    );
    expect(html).not.toContain("AI 분석 정확도");
  });
});
