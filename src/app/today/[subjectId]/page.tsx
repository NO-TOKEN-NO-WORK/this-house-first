import { notFound } from "next/navigation";
import { SubjectDetailView } from "@/components/today/SubjectDetailView";
import { getSubjectDetail } from "@/lib/board/subject";
import { isIsoDate } from "@/lib/board/format";
import { isRiskGrade } from "@/lib/domain";

/**
 * 직접 주소 진입·새로고침용 대상자 상세.
 * 보드에서 눌러 들어오는 경로는 TodayWorkspace가 서버 왕복 없이 같은 화면을 연다.
 */
export const dynamic = "force-dynamic";

export default async function SubjectDetailPage(
  props: PageProps<"/today/[subjectId]">,
) {
  const { subjectId } = await props.params;
  const params = await props.searchParams;
  let date: string | undefined;
  if (params.date !== undefined) {
    if (!isIsoDate(params.date)) notFound();
    date = params.date;
  }
  const workerId =
    typeof params.workerId === "string" ? params.workerId : undefined;
  const gradeValue = typeof params.grade === "string" ? Number(params.grade) : null;
  const returnGrade = isRiskGrade(gradeValue) ? gradeValue : null;
  const informationOnly = params.view === "info";

  const detail = await getSubjectDetail({ subjectId, date });
  if (!detail) notFound();

  const backQuery = new URLSearchParams();
  if (date) backQuery.set("date", date);
  if (workerId) backQuery.set("workerId", workerId);
  if (returnGrade) backQuery.set("grade", String(returnGrade));
  const backHref = backQuery.size > 0 ? `/today?${backQuery}` : "/today";

  return (
    <SubjectDetailView
      detail={detail}
      backHref={backHref}
      informationOnly={informationOnly}
    />
  );
}
