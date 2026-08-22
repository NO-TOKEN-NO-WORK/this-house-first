import type {
  BriefingCategory,
  CheckKind,
  CallResult,
  VisitResult,
} from "../domain";

/** 서버가 DB의 CheckEvent 행에서 만든 근거. 모델이 이 문구를 작성하지 않는다. */
export interface BriefingEvidence {
  checkEventId: string;
  date: string;
  dateLabel: string;
  kind: CheckKind;
  kindLabel: string;
  result: CallResult | VisitResult;
  resultLabel: string;
  label: string;
}

export interface BriefingStatement {
  text: string;
  source: BriefingEvidence;
}

export interface BriefingHandoverItem extends BriefingStatement {
  category: BriefingCategory;
  categoryLabel: string;
}

export interface BriefingConversationSummary extends BriefingStatement {
  ongoingItems: BriefingStatement[];
}

/** GET /api/subjects/[subjectId]/briefing의 브라우저 안전 응답. */
export interface SubjectBriefingView {
  todayPrompt: BriefingStatement | null;
  handover: BriefingHandoverItem[];
  conversationSummaries: BriefingConversationSummary[];
  generatedAt: string;
}

/** 모델 호출 전 DB에서 고른 한 대상자의 확인 기록. */
export interface BriefingSourceEvent {
  id: string;
  subjectId: string;
  date: string;
  kind: string;
  result: string;
  memo: string;
}

/** 모델은 실제 DB id 대신 요청마다 만든 이 별칭만 본다. */
export interface BriefingModelEvent {
  sourceCheckEventId: string;
  date: string;
  kind: string;
  result: string;
  memo: string;
}

export interface UnverifiedBriefingStatement {
  text: string;
  sourceCheckEventId: string;
}

export interface UnverifiedBriefingHandoverItem
  extends UnverifiedBriefingStatement {
  category: string;
}

export interface UnverifiedConversationSummary
  extends UnverifiedBriefingStatement {
  ongoingItems: UnverifiedBriefingStatement[];
}

/** strict Structured Outputs를 파싱했지만 DB 소유권 대조 전인 값. */
export interface UnverifiedSubjectBriefing {
  todayPrompt: UnverifiedBriefingStatement | null;
  handover: UnverifiedBriefingHandoverItem[];
  conversationSummaries: UnverifiedConversationSummary[];
}
