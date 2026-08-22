import type { Metadata } from "next";
import { WelfareScanWorkspace } from "@/components/admin/WelfareScanWorkspace";
import {
  RecommendationStatus,
  WelfareIssue,
  type WelfareRecommendation,
} from "@/lib/welfare-scan/eligibility";

export const metadata: Metadata = {
  title: "복지 스캔",
  description: "현장 기록과 대상자 상태를 바탕으로 공공 복지사업 연계 후보를 검토합니다.",
};

const PREVIEW_RECOMMENDATIONS: WelfareRecommendation[] = [
  {
    subjectId: "preview-subject-1",
    subjectName: "김○○ (88세)",
    workerName: "이미경",
    programId: "preview-energy-efficiency",
    programName: "저소득층 에너지효율개선사업",
    ministry: "기후에너지환경부",
    programSummary: "냉방기기와 단열 개선이 필요한 가구를 지원하는 사업입니다.",
    programLink: "https://www.bokjiro.go.kr/",
    status: RecommendationStatus.NEEDS_INFO,
    issues: [WelfareIssue.COOLING_ISSUE],
    evidence: ["에어컨에서 미지근한 바람만 나옴"],
    confirmedChecks: ["65세 이상", "독거 또는 1인 가구", "냉방기기 없음 또는 고장"],
    missingChecks: ["기초생활수급 또는 차상위 여부", "최근 동일 사업 지원 이력"],
  },
  {
    subjectId: "preview-subject-2",
    subjectName: "박○○ (82세)",
    workerName: "최영수",
    programId: "preview-energy-voucher",
    programName: "에너지바우처",
    ministry: "기후에너지환경부",
    programSummary: "취약계층의 냉난방 에너지 비용을 지원하는 사업입니다.",
    programLink: "https://www.bokjiro.go.kr/",
    status: RecommendationStatus.HIGH,
    issues: [WelfareIssue.ENERGY_COST],
    evidence: ["전기세가 많이 나와 거의 켜지 않는다고 함"],
    confirmedChecks: ["65세 이상", "독거 또는 1인 가구"],
    missingChecks: [],
  },
  {
    subjectId: "preview-subject-3",
    subjectName: "이○○ (79세)",
    workerName: "이미경",
    programId: "preview-housing-repair",
    programName: "주거급여 수선유지급여",
    ministry: "국토교통부",
    programSummary: "주택 노후도에 따라 보수 범위를 정해 수선을 지원합니다.",
    programLink: "https://www.bokjiro.go.kr/",
    status: RecommendationStatus.NEEDS_INFO,
    issues: [WelfareIssue.HOUSING_REPAIR],
    evidence: ["창문 틈으로 열기가 계속 들어옴"],
    confirmedChecks: ["65세 이상"],
    missingChecks: ["주택 소유 형태", "기초생활수급 또는 차상위 여부"],
  },
];

export default async function WelfareScanPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string | string[] }>;
}) {
  const params = await searchParams;
  const previewMode =
    process.env.NODE_ENV !== "production" && params.preview === "1";
  return (
    <WelfareScanWorkspace
      initialRecommendations={previewMode ? PREVIEW_RECOMMENDATIONS : []}
      previewMode={previewMode}
    />
  );
}
