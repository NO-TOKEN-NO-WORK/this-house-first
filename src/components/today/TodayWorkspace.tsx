"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { CallGuideDialog } from "@/components/today/CallGuideDialog";
import { CallResultSheet } from "@/components/today/CallResultSheet";
import { SubjectDetailView } from "@/components/today/SubjectDetailView";
import {
  applyCheckOutcome,
  detailFromBoard,
  findBoardSubject,
  type CheckOutcome,
} from "@/lib/board/detail";
import type { SubjectDetail } from "@/lib/board/subject";
import type { Board } from "@/lib/board/today";
import {
  type CallResult,
  CheckKind,
  type CoolingStatus,
  type RiskGrade,
} from "@/lib/domain";

/**
 * 보드→상세를 같은 문서 안에서 전환한다.
 * Next Link로 상세 URL을 치면 Vercel 왕복을 기다리므로, 보드가 이미 가진 데이터로 화면만 바꾼다.
 * 주소는 pushState로 `/today/[id]`를 맞춰 새로고침·공유가 기존 라우트를 타게 한다.
 */

interface WorkspaceValue {
  openDetail: (subjectId: string) => void;
  /** 전화 안내 → 통화 → 결과 시트로 이어지는 흐름을 연다 (FR-5, Figma ④→⑤) */
  openCallGuide: (subjectId: string) => void;
}

const TodayWorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useTodayWorkspace(): WorkspaceValue | null {
  return useContext(TodayWorkspaceContext);
}

function boardHref(opts: {
  date: string;
  workerId?: string;
  returnGrade?: RiskGrade | null;
}): string {
  const query = new URLSearchParams({ date: opts.date });
  if (opts.workerId) query.set("workerId", opts.workerId);
  if (opts.returnGrade) query.set("grade", String(opts.returnGrade));
  return `/today?${query.toString()}`;
}

function detailHref(
  subjectId: string,
  opts: { date: string; workerId?: string; returnGrade?: RiskGrade | null },
): string {
  const query = new URLSearchParams({ date: opts.date });
  if (opts.workerId) query.set("workerId", opts.workerId);
  if (opts.returnGrade) query.set("grade", String(opts.returnGrade));
  return `/today/${subjectId}?${query.toString()}`;
}

function subjectIdFromPath(pathname: string): string | null {
  const match = /^\/today\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}

export function TodayWorkspace({
  board,
  workerId,
  returnGrade,
  children,
}: {
  board: Board;
  workerId?: string;
  returnGrade?: RiskGrade | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [override, setOverride] = useState<SubjectDetail | null>(null);
  /**
   * 전화 흐름의 단계. `guide`는 걸기 전 안내(④), `call`은 통화 결과 시트(⑤).
   *
   * 통화가 언제 끝났는지 웹은 알 수 없다. 그래서 `tel:`로 넘어가는 순간 시트로 바꿔 둔다 —
   * 통화를 마치고 앱으로 돌아오면 시트가 이미 떠 있다. 포그라운드 복귀 이벤트를 기다리면
   * 데스크톱처럼 앱이 백그라운드로 가지 않는 환경에서 아무것도 뜨지 않는다.
   */
  const [callPhase, setCallPhase] = useState<"guide" | "result" | null>(null);
  const [callSubjectId, setCallSubjectId] = useState<string | null>(null);

  const nav = useMemo(
    () => ({ date: board.date, workerId, returnGrade }),
    [board.date, workerId, returnGrade],
  );

  const openDetail = useCallback(
    (subjectId: string) => {
      if (!board.alerted) return;
      if (!findBoardSubject(board, subjectId)) return;
      window.history.pushState(
        { ...(window.history.state ?? {}), todayDetail: true, subjectId },
        "",
        detailHref(subjectId, nav),
      );
      setSelectedId(subjectId);
      setOverride(null);
    },
    [board, nav],
  );

  const openCallGuide = useCallback(
    (subjectId: string) => {
      if (!board.alerted) return;
      if (!findBoardSubject(board, subjectId)) return;
      setCallSubjectId(subjectId);
      setCallPhase("guide");
    },
    [board],
  );

  const closeCall = useCallback(() => {
    setCallPhase(null);
    setCallSubjectId(null);
  }, []);

  const closeDetail = useCallback(() => {
    const state = window.history.state as { todayDetail?: boolean } | null;
    if (state?.todayDetail) {
      window.history.back();
      return;
    }
    setSelectedId(null);
    setOverride(null);
    window.history.pushState(window.history.state, "", boardHref(nav));
  }, [nav]);

  useEffect(() => {
    function onPopState() {
      const id = subjectIdFromPath(window.location.pathname);
      setSelectedId(id);
      setOverride(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const selected =
    selectedId && board.alerted ? findBoardSubject(board, selectedId) : null;
  const detail =
    override ?? (selected && board.alerted ? detailFromBoard(selected, board) : null);

  /**
   * 통화 결과 저장 — `RecordGrid`와 같은 계약으로 `/api/checks`에 남긴다.
   *
   * 실패는 던진다. 시트가 받아 문구를 그대로 보여 주고 시트를 닫지 않는다 —
   * 상태머신이 막은 기록(재전화 30분 규칙 등)은 이유를 읽고 다시 눌러야 하기 때문이다.
   * 성공하면 보드를 다시 받아 카드가 `무응답 1회 · 9시 10분`으로 바뀐다.
   *
   * `workerId`는 싣지 않는다 — 생략하면 API가 대상자의 배정 담당자를 기록자로 쓴다(RecordGrid와 같다).
   */
  async function handleCallSaved(
    result: CallResult,
    coolingStatus: CoolingStatus,
    memo: string,
  ) {
    if (!callSubjectId) return;

    let response: Response;
    let payload: { error?: { message?: string } };
    try {
      response = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: callSubjectId,
          kind: CheckKind.CALL,
          result,
          coolingStatus,
          ...(memo ? { memo } : {}),
          date: board.date,
        }),
      });
      payload = await response.json();
    } catch {
      throw new Error("연결이 끊겨 기록하지 못했습니다. 다시 눌러 주세요.");
    }

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "기록하지 못했습니다.");
    }

    closeCall();
    startRefresh(() => router.refresh());
  }

  function handleRecorded(outcome: CheckOutcome) {
    setOverride((current) => {
      const base =
        current ??
        (selected && board.alerted ? detailFromBoard(selected, board) : null);
      return base ? applyCheckOutcome(base, outcome) : null;
    });
  }

  if (detail) {
    return (
      <SubjectDetailView
        detail={detail}
        backHref={boardHref(nav)}
        onBack={closeDetail}
        onRecorded={handleRecorded}
      />
    );
  }

  const callSubject =
    callSubjectId && board.alerted
      ? findBoardSubject(board, callSubjectId)
      : null;

  return (
    <TodayWorkspaceContext.Provider value={{ openDetail, openCallGuide }}>
      {children}
      {callSubject && (
        <>
          <CallGuideDialog
            open={callPhase === "guide"}
            onClose={closeCall}
            onCallPlaced={() => setCallPhase("result")}
            name={callSubject.name}
            age={callSubject.age}
            livesAlone={callSubject.livesAlone}
            grade={callSubject.grade}
            phone={callSubject.phone}
            address={callSubject.roadAddress ?? callSubject.address}
          />
          <CallResultSheet
            open={callPhase === "result"}
            onClose={closeCall}
            name={callSubject.name}
            age={callSubject.age}
            livesAlone={callSubject.livesAlone}
            grade={callSubject.grade}
            phone={callSubject.phone}
            address={callSubject.roadAddress ?? callSubject.address}
            onSave={handleCallSaved}
          />
        </>
      )}
    </TodayWorkspaceContext.Provider>
  );
}
