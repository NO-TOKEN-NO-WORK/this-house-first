export const WelfareIssue = {
  COOLING_ISSUE: "COOLING_ISSUE",
  ENERGY_COST: "ENERGY_COST",
  MOBILITY: "MOBILITY",
  SAFETY_EQUIPMENT: "SAFETY_EQUIPMENT",
  HOUSING_REPAIR: "HOUSING_REPAIR",
} as const;

export type WelfareIssue = (typeof WelfareIssue)[keyof typeof WelfareIssue];

export const RecommendationStatus = {
  HIGH: "HIGH",
  NEEDS_INFO: "NEEDS_INFO",
} as const;

export type RecommendationStatus =
  (typeof RecommendationStatus)[keyof typeof RecommendationStatus];

export const RECOMMENDATION_STATUS_LABEL: Record<RecommendationStatus, string> = {
  [RecommendationStatus.HIGH]: "가능성 높음",
  [RecommendationStatus.NEEDS_INFO]: "추가 정보 필요",
};

export interface WelfareSubjectProfile {
  subjectId: string;
  name: string;
  age: number;
  livesAlone: boolean;
  hasAircon: boolean | null;
  airconBroken: boolean;
  workerName: string;
  latestMemo: string | null;
}

export interface WelfareSignal {
  subjectId: string;
  issues: WelfareIssue[];
  evidence: string[];
}

export interface WelfareProgram {
  id: string;
  name: string;
  ministry: string;
  summary: string;
  selectionCriteria: string;
  target: string;
  link: string;
}

export interface WelfareRecommendation {
  subjectId: string;
  subjectName: string;
  workerName: string;
  programId: string;
  programName: string;
  ministry: string;
  programSummary: string;
  programLink: string;
  status: RecommendationStatus;
  issues: WelfareIssue[];
  evidence: string[];
  confirmedChecks: string[];
  missingChecks: string[];
}

const ISSUE_KEYWORDS: Record<WelfareIssue, readonly string[]> = {
  [WelfareIssue.COOLING_ISSUE]: ["냉방", "에어컨", "에너지", "폭염", "단열"],
  [WelfareIssue.ENERGY_COST]: ["에너지", "전기", "요금", "바우처", "연료"],
  [WelfareIssue.MOBILITY]: ["이동", "거동", "방문", "돌봄", "가사"],
  [WelfareIssue.SAFETY_EQUIPMENT]: ["응급", "안전", "장비", "화재", "감지"],
  [WelfareIssue.HOUSING_REPAIR]: ["주거", "주택", "수선", "개선", "단열"],
};

const MANUAL_REVIEW_CRITERIA = /(?:등록\s*)?장애|질환|질병|임신|재산|고용|실업|국적|가족관계|세대 구성/;

function matchesIssue(program: WelfareProgram, issue: WelfareIssue): boolean {
  const searchable = `${program.name} ${program.summary} ${program.selectionCriteria} ${program.target}`;
  return ISSUE_KEYWORDS[issue].some((keyword) => searchable.includes(keyword));
}

function missingChecks(criteria: string): string[] {
  const missing: string[] = [];
  if (/기초생활수급|차상위|저소득|소득/.test(criteria)) {
    missing.push("기초생활수급 또는 차상위 여부");
  }
  if (/자가|소유주|주택 소유/.test(criteria)) {
    missing.push("주택 소유 형태");
  }
  if (/지원 이력|중복 지원|최근 \d+년/.test(criteria)) {
    missing.push("최근 동일 사업 지원 이력");
  }
  return missing;
}

export function recommendWelfarePrograms({
  profile,
  signal,
  programs,
}: {
  profile: WelfareSubjectProfile;
  signal: WelfareSignal;
  programs: WelfareProgram[];
}): WelfareRecommendation[] {
  return programs.flatMap((program) => {
    const matchedIssues = signal.issues.filter((issue) => matchesIssue(program, issue));
    if (matchedIssues.length === 0) return [];

    const minimumAge = program.selectionCriteria.match(/(\d{2,3})세 이상/)?.[1];
    if (minimumAge && profile.age < Number(minimumAge)) return [];

    const missing = missingChecks(program.selectionCriteria);
    const confirmedChecks = [
      ...(minimumAge ? [`${minimumAge}세 이상`] : []),
      ...(profile.livesAlone && /독거|1인 가구/.test(`${program.target} ${program.selectionCriteria}`)
        ? ["독거 또는 1인 가구"]
        : []),
      ...(matchedIssues.includes(WelfareIssue.COOLING_ISSUE) &&
      (profile.hasAircon === false || profile.airconBroken)
        ? ["냉방기기 없음 또는 고장"]
        : []),
    ];
    if (
      missing.length === 0 &&
      (confirmedChecks.length === 0 || MANUAL_REVIEW_CRITERIA.test(program.selectionCriteria))
    ) {
      missing.push("사업별 세부 자격요건");
    }

    return [{
      subjectId: profile.subjectId,
      subjectName: profile.name,
      workerName: profile.workerName,
      programId: program.id,
      programName: program.name,
      ministry: program.ministry,
      programSummary: program.summary,
      programLink: program.link,
      status: missing.length > 0
        ? RecommendationStatus.NEEDS_INFO
        : RecommendationStatus.HIGH,
      issues: matchedIssues,
      evidence: signal.evidence,
      confirmedChecks,
      missingChecks: missing,
    }];
  });
}
