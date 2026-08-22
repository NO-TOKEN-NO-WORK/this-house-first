import type { WelfareProgram } from "../welfare-scan/eligibility";
import {
  PublicDataError,
  type PublicDataFetch,
  requirePublicDataServiceKey,
} from "./client";

const WELFARE_API_BASE =
  "https://apis.data.go.kr/B554287/NationalWelfareInformationsV001";
const WELFARE_HOME = "https://www.bokjiro.go.kr/";
const RELEVANT_TERMS = [
  "노인",
  "노년",
  "독거",
  "에너지",
  "냉방",
  "주거",
  "주택",
  "돌봄",
  "응급",
  "안전",
] as const;

interface WelfareProgramSummary {
  id: string;
  name: string;
  ministry: string;
  summary: string;
  target: string;
  link: string;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

function xmlValue(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return match ? decodeXmlText(match[1]) : "";
}

function xmlBlocks(xml: string, tag: string): string[] {
  return Array.from(
    xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")),
    (match) => match[1],
  );
}

function welfareLink(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "bokjiro.go.kr" || url.hostname.endsWith(".bokjiro.go.kr"))
      ? url.toString()
      : WELFARE_HOME;
  } catch {
    return WELFARE_HOME;
  }
}

function assertSuccessfulXml(xml: string): void {
  const code = xmlValue(xml, "resultCode") || xmlValue(xml, "returnReasonCode");
  if (code && !["0", "00", "INFO-0"].includes(code)) {
    throw new PublicDataError(
      xmlValue(xml, "resultMessage") ||
        xmlValue(xml, "returnAuthMsg") ||
        "복지서비스 API 호출에 실패했습니다.",
      code,
    );
  }
}

async function fetchXml(url: URL, fetcher: PublicDataFetch): Promise<string> {
  let response: Response;
  try {
    response = await fetcher(url, {
      cache: "no-store",
      headers: { Accept: "application/xml" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    throw new PublicDataError(
      error instanceof Error && error.name === "TimeoutError"
        ? "복지서비스 API 응답 시간이 초과되었습니다."
        : "복지서비스 API에 연결하지 못했습니다.",
      "UPSTREAM_UNAVAILABLE",
    );
  }
  const xml = await response.text();
  assertSuccessfulXml(xml);
  if (!response.ok) {
    throw new PublicDataError(
      `복지서비스 API가 HTTP ${response.status}로 응답했습니다.`,
      "UPSTREAM_HTTP_ERROR",
    );
  }
  return xml;
}

function parseSummaries(xml: string): WelfareProgramSummary[] {
  return xmlBlocks(xml, "servList").map((block) => ({
    id: xmlValue(block, "servId"),
    name: xmlValue(block, "servNm"),
    ministry: xmlValue(block, "jurMnofNm"),
    summary: xmlValue(block, "servDgst"),
    target: [xmlValue(block, "lifeArray"), xmlValue(block, "trgterIndvdlArray")]
      .filter(Boolean)
      .join(" · "),
    link: welfareLink(xmlValue(block, "servDtlLink")),
  }));
}

function isRelevant(program: WelfareProgramSummary): boolean {
  const text = `${program.name} ${program.summary} ${program.target}`;
  return RELEVANT_TERMS.some((term) => text.includes(term));
}

function detailUrl(serviceKey: string, serviceId: string): URL {
  const url = new URL(`${WELFARE_API_BASE}/NationalWelfaredetailedV001`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("callTp", "D");
  url.searchParams.set("servId", serviceId);
  return url;
}

export async function refreshWelfarePrograms(
  options: { serviceKey?: string; fetcher?: PublicDataFetch } = {},
): Promise<WelfareProgram[]> {
  const serviceKey = options.serviceKey ?? requirePublicDataServiceKey();
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(`${WELFARE_API_BASE}/NationalWelfarelistV001`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("callTp", "L");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "500");
  url.searchParams.set("srchKeyCode", "003");
  url.searchParams.set("orderBy", "date");

  const summaries = parseSummaries(await fetchXml(url, fetcher))
    .filter((program) => program.id && isRelevant(program))
    .slice(0, 12);

  return Promise.all(
    summaries.map(async (summary) => {
      const detail = await fetchXml(detailUrl(serviceKey, summary.id), fetcher);
      return {
        id: summary.id,
        name: xmlValue(detail, "servNm") || summary.name,
        ministry: xmlValue(detail, "jurMnofNm") || summary.ministry,
        summary: xmlValue(detail, "wlfareInfoOutlCn") || summary.summary,
        selectionCriteria: xmlValue(detail, "slctCritCn"),
        target: xmlValue(detail, "tgtrDtlCn") || summary.target,
        link: summary.link,
      };
    }),
  );
}
